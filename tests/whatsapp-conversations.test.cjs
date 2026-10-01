const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => name in mocks ? mocks[name] : require(name),
    Request, Response, URL, AbortSignal, process: { env: { WHATSAPP_TOKEN: 'test-only-token', ...mocks.env } },
    fetch: mocks.fetch, console });
  return exports;
}
const messages = load('lib/whatsapp/messages.ts');
const id = '11111111-1111-1111-1111-111111111111';
const version = { last_message_at: '2026-10-01T10:00:00.000', unread_count: 1 };

function db(results) {
  const calls = [];
  return { calls, from(table) {
    const call = { table, filters: [], update: null }; calls.push(call);
    const result = results.shift();
    const chain = {
      select() { return chain; }, eq(k, v) { call.filters.push([k,v]); return chain; },
      order() { return chain; }, limit() { return chain; }, update(value) { call.update=value; return chain; },
      maybeSingle() { return Promise.resolve(result); },
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    }; return chain;
  } };
}
function routes(database, denied = null, fetch) {
  const mocks = {
    '@/lib/whatsapp/admin': { whatsappAdmin: () => database, authorizeWhatsApp: async () => denied, isUuid: (s) => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s) },
    '@/lib/whatsapp/messages': messages,
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } }, fetch,
  };
  return { chat: load('app/api/admin/whatsapp/conversations/messages/route.ts', mocks), media: load('app/api/admin/whatsapp/conversations/media/route.ts', mocks) };
}
const post = (body) => new Request('http://localhost/messages', { method:'POST', body: JSON.stringify(body), headers:{'Content-Type':'application/json'} });

test('image, PDF and sticker metadata retained; payload and tokens excluded', () => {
  for (const type of ['image','document','sticker']) {
    const output = messages.toChatMessage({ id, message_type:type, raw_payload:{ [type]:{ id:'123',filename:'teklif.pdf',mime_type:type==='document'?'application/pdf':'image/webp' }, secret:'hidden' } });
    assert.equal(output.attachment.id,'123'); assert.equal(output.attachment.filename,'teklif.pdf');
    assert.equal('raw_payload' in output,false); assert.equal('secret' in output,false);
  }
  assert.equal(messages.getAttachment('image',{image:{id:'https://malicious.test'}}),null);
});
test('Unicode emoji and removed reactions are preserved without invented thumbs-up', () => {
  const row = {message_type:'reaction',raw_payload:{reaction:{emoji:'❤️'}}};
  assert.equal(messages.toChatMessage(row).reaction,'❤️');
  row.raw_payload.reaction.emoji=''; assert.equal(messages.toChatMessage(row).reaction,'');
  assert.equal(messages.toChatMessage({message_type:'text',message_text:'Merhaba 👋😊'}).message_text,'Merhaba 👋😊');
});
test('in-progress webhook never acknowledges message not yet inserted', () => {
  assert.equal(messages.readableVersion(version,[]),null);
  assert.equal(messages.readableVersion(version,[{direction:'inbound',created_at:'2026-10-01T09:59:59'}]),null);
  assert.equal(messages.readableVersion(version,[{direction:'inbound',created_at:'2026-10-01T10:00:00.001'}]).unread_count,1);
});
test('read clears only observed unread count, never status or archive', async () => {
  const database=db([{data:[{id}],error:null}]);
  const result=await routes(database).chat.POST(post({conversationId:id,readVersion:version}));
  assert.equal((await result.json()).markedRead,true);
  assert.equal(JSON.stringify(database.calls[0].update),JSON.stringify({unread_count:0}));
  assert.equal(JSON.stringify(database.calls[0].filters),JSON.stringify([['id',id],['last_message_at',version.last_message_at],['unread_count',1]]));
});
test('concurrent incoming message prevents stale acknowledgement', async () => {
  const result=await routes(db([{data:[],error:null}])).chat.POST(post({conversationId:id,readVersion:version}));
  assert.equal((await result.json()).markedRead,false);
});
test('unauthorized read and media access do not touch database', async () => {
  const database=db([]); const denied=Response.json({error:'Unauthorized'},{status:401});
  const handlers=routes(database,denied);
  assert.equal((await handlers.chat.POST(post({}))).status,401);
  assert.equal((await handlers.media.GET(new Request('http://localhost/media?messageId='+id))).status,401);
  assert.equal(database.calls.length,0);
});
test('invalid read version is rejected', async () => {
  const database=db([]);
  assert.equal((await routes(database).chat.POST(post({conversationId:id,readVersion:{last_message_at:'bad',unread_count:-1}}))).status,400);
  assert.equal(database.calls.length,0);
});
test('message fetch supplies actual attachments and read snapshot, no mutation', async () => {
  const database=db([{data:version,error:null},{data:[{id,conversation_id:id,direction:'inbound',message_type:'document',created_at:'2026-10-01T10:00:00.002',raw_payload:{document:{id:'123',filename:'fiyat.pdf',mime_type:'application/pdf'}}}],error:null}]);
  const response=await routes(database).chat.GET(new Request('http://localhost/messages?conversationId='+id));
  const data=await response.json(); assert.equal(data.messages[0].attachment.filename,'fiyat.pdf'); assert.equal(data.readVersion.unread_count,1);
  assert.ok(database.calls.every((call)=>call.update===null));
});
test('media resolves a fresh URL and streams protected bytes without exposing token', async () => {
  const database=db([{data:{message_type:'document',raw_payload:{document:{id:'123',mime_type:'application/pdf',filename:'teklif.pdf'}}},error:null},{data:null,error:null}]);
  const requests=[];
  const fetch=async (url,options)=>{requests.push([String(url),options]);return requests.length===1?Response.json({url:'https://lookaside.fbsbx.com/whatsapp/test'}):new Response('%PDF-1.4 test',{headers:{'Content-Type':'application/pdf'}})};
  const response=await routes(database,null,fetch).media.GET(new Request('http://localhost/media?messageId='+id));
  assert.equal(response.status,200); assert.match(await response.text(),/^%PDF/);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(requests.length,2); assert.equal(requests[1][1].headers.Authorization,'Bearer test-only-token');
  assert.equal(requests[1][1].redirect,'error');
});
test('untrusted media URL blocked; expired media returns readable error', async () => {
  for(const url of ['http://lookaside.fbsbx.com/file','https://fbsbx.com.evil.test/file']) {
    let requests=0;
    const database=db([{data:{message_type:'image',raw_payload:{image:{id:'123'}}},error:null},{data:null,error:null}]);
    const response=await routes(database,null,async()=>{requests++;return Response.json({url})}).media.GET(new Request('http://localhost/media?messageId='+id));
    assert.equal(response.status,502);assert.equal(requests,1);
  }
  const database=db([{data:{message_type:'image',raw_payload:{image:{id:'123'}}},error:null},{data:null,error:null}]);
  const response=await routes(database,null,async()=>new Response('',{status:404})).media.GET(new Request('http://localhost/media?messageId='+id));
  assert.equal(response.status,502); assert.match((await response.json()).error,/süresi/);
});


test('real authorization rejects missing, invalid, anonymous and non-admin sessions', async () => {
  const auth=load('lib/whatsapp/admin.ts', {
    'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
    env:{ADMIN_EMAILS:'admin@example.test'},
  });
  const request=new Request('http://localhost/media',{headers:{Authorization:'Bearer session-token'}});
  let called=false;
  const client={auth:{getUser:async()=>{called=true;return {data:{user:{email:'visitor@example.test'}},error:null}}}};
  assert.equal((await auth.authorizeWhatsApp(new Request('http://localhost/media'),client)).status,401);
  assert.equal(called,false);
  assert.equal((await auth.authorizeWhatsApp(request,client)).status,403);
  client.auth.getUser=async()=>({data:{user:{email:'admin@example.test',is_anonymous:true}},error:null});
  assert.equal((await auth.authorizeWhatsApp(request,client)).status,401);
  client.auth.getUser=async()=>({data:{user:{email:'ADMIN@example.test'}},error:null});
  assert.equal(await auth.authorizeWhatsApp(request,client),null);
  client.auth.getUser=async()=>({data:{user:null},error:{message:'invalid'}});
  assert.equal((await auth.authorizeWhatsApp(request,client)).status,401);
});
