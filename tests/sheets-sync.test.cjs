const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');const root=path.resolve(__dirname,'..');
function load(file,mocks={},env={}){const exports={};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,require:n=>n in mocks?mocks[n]:require(n),process:{env},Request,Response,Buffer,Uint8Array});return exports;}
const lib=load('lib/orders/sheets.ts');const secret='UNIT-TEST-ONLY-NOT-A-REAL-SECRET-123456';
const row={rowNumber:2,values:{satisId:'S-1',bayi:'Demo',urun:'8.20.0',siparisTonaj:27,pesinSatisFiyati:19000}};
function route(options={}){const calls=[];return {calls,post:load('app/api/integrations/sheets/orders/route.ts',{'@/lib/orders/sheets':lib,'next/server':{NextResponse:{json:Response.json}},'@supabase/supabase-js':{createClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return options.dbError?{error:{message:'private detail'}}:{data:{status:args.p_dry_run?'updated':'inserted'},error:null}}})}},{SHEETS_SYNC_SECRET:secret,SHEETS_SYNC_SOURCE_ID:'test',SHEETS_SYNC_ENABLED:'true',...options.env}).POST};}
const req=(body={},token=secret)=>new Request('http://localhost/api/integrations/sheets/orders',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({sourceId:'test',snapshotAt:new Date().toISOString(),dryRun:true,rows:[row],...body})});
test('secret comparisons and fail-closed configuration',async()=>{assert.equal(lib.validSecret(secret,secret),true);assert.equal(lib.validSecret('wrong',secret),false);const r=route({env:{SHEETS_SYNC_SECRET:''}});assert.equal((await r.post(req())).status,503);assert.equal(r.calls.length,0);});
test('unauthorized, wrong source, expired timestamps and disabled writes never reach database',async()=>{for(const [options,body,token,status] of [[{}, {},'wrong',401],[{},{sourceId:'other'},secret,403],[{},{snapshotAt:'2000-01-01'},secret,400],[{env:{SHEETS_SYNC_ENABLED:'false'}},{dryRun:false},secret,409]]){const r=route(options);assert.equal((await r.post(req(body,token))).status,status);assert.equal(r.calls.length,0);}});
test('Turkish numeric and date validation; empty cells preserved; invoice fields rejected',()=>{assert.equal(lib.parseNumber('19.500,25'),19500.25);assert.equal(lib.parseNumber(27.5),27.5);assert.equal(lib.validateValues({satisId:'A',plaka:''}).plaka,undefined);assert.throws(()=>lib.validateValues({satisId:'A',sales_invoice_id:'bad'}));assert.throws(()=>lib.validateValues({satisId:'A',satisTarihi:'2026-02-30'}));assert.throws(()=>lib.validateValues({satisId:'A',gts:'maybe'}));});
test('duplicate batch IDs rejected before any database write',async()=>{const r=route();assert.equal((await r.post(req({rows:[row,row],dryRun:false}))).status,400);assert.equal(r.calls.length,0);});
test('dry run flag reaches transactional RPC; invalid row does not abort other valid rows',async()=>{const r=route();const response=await r.post(req({rows:[{rowNumber:4,values:{satisId:'BAD',fatura:'Kesildi'}},row]}));const body=await response.json();assert.equal(body.results[0].status,'invalid');assert.equal(r.calls.length,1);assert.equal(r.calls[0].args.p_dry_run,true);assert.equal(r.calls[0].name,'sync_order_from_sheet');});
test('database failure returns retryable error without leaking database error or secret',async()=>{const r=route({dbError:true});const response=await r.post(req());assert.equal(response.status,503);const text=await response.text();assert.equal(text.includes('private detail'),false);assert.equal(text.includes(secret),false);});
test('stream limit enforced without Content-Length',async()=>{const r=route();assert.equal((await r.post(req({extra:'x'.repeat(256001)}))).status,413);assert.equal(r.calls.length,0);});
const script={console,Date,Set,Utilities:{formatDate:()=> '2026-10-01'}};vm.createContext(script);vm.runInContext(fs.readFileSync(path.join(root,'integrations/google-sheets/Code.gs'),'utf8'),script);
const sheet=matrix=>[[],...matrix.map((cells,index)=>[...cells,index===0?'Satış Tarihi':'2026-10-01'])];
test('Apps Script maps existing Excel headings, ignores invoice/payment columns, normalizes statuses',()=>{const rows=script.nReadRows(sheet([['Satış ID','Bayi','Ürün','Sipariş','Peşin Satış Fiyatı','Plaka','Sevk Durumu','GTS','Fatura No','Yapılan Ödeme'],['A','Demo','8.20.0',27,19000,'33 DEM 123','Evet','Çıkış yapıldı','DO-NOT-SEND',300]]));assert.equal(rows[0].values.sevkDurumu,'Sevk Edildi');assert.equal(rows[0].values.gts,'Girildi');assert.equal(rows[0].values.faturaNo,undefined);assert.equal(rows[0].values.yapilanOdeme,undefined);});
test('Apps Script refuses duplicate IDs across complete sheet and duplicate mapped headings',()=>{const h=['Satış ID','Bayi','Ürün','Sipariş','Peşin Satış Fiyatı'];const r=['A','Demo','DAP',27,19000];assert.throws(()=>script.nReadRows(sheet([h,r,r])));assert.throws(()=>script.nReadRows(sheet([[...h,'Miktar'],[...r,27]])));});

test('read-only Sheets API preserves numeric/date values and skips sparse trailing cells',()=>{
  const calls=[];
  script.Sheets={Spreadsheets:{Values:{get:(id,range,opts)=>{calls.push({id,range,opts});return {values:[[],['Satış ID','Bayi','Ürün','Sipariş','Peşin Satış Fiyatı','Satış Tarihi','Not'],['A','Demo','DAP',27.5,19000,46296]]}}}}};
  const rows=script.nLoadRows('test-file',"Satış'lar");
  assert.equal(calls[0].range,"'Satış''lar'");assert.equal(calls[0].opts.valueRenderOption,'UNFORMATTED_VALUE');
  assert.equal(rows[0].values.siparisTonaj,27.5);assert.equal(rows[0].values.satisTarihi,'2026-10-01');assert.equal(rows[0].values.not,undefined);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'integrations/google-sheets/appsscript.json'),'utf8'));
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'));
  assert.ok(!manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets.readonly'));
});

test('second-row headings retain actual sheet row numbers and duplicate locations',()=>{
  const headers=['Satış ID','Bayi','Ürün','Sipariş','Peşin Satış Fiyatı','Satış Tarihi'];
  const values=['A','Demo','DAP',27,19000,'2026-10-01'];
  const rows=script.nReadRows([['title'],headers,values]);assert.equal(rows[0].rowNumber,3);
  assert.throws(()=>script.nReadRows([['title'],headers,values,values]),/Satır 3 ve 4/);
});
test('number diagnostic matches server validation and masks values without transmitting',()=>{
  for(const value of [27,0,-1,1e13,true,'19.500,25','27.5','-','Dahil','27 ton','%2','',null,undefined]) {
    let bad=false;try{lib.validateValues({satisId:'A',nakliye:value})}catch{bad=true}
    assert.equal(Boolean(script.nNumberProblem(value)),bad,String(value));
  }
  const report=script.nNumberReport([{rowNumber:3,values:{nakliye:'GizliBilgi',vadeFarki:'%9',alisFiyati:12345.67}}]);
  assert.equal(report.sorunluSutunlar.Nakliye,1);assert.equal(report.ornekler[0].satir,3);
  assert.ok(!JSON.stringify(report).includes('GizliBilgi'));assert.ok(!JSON.stringify(report).includes('12345'));
});
