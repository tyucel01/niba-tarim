const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
function fixture(){const values={SHEETS_SYNC_SOURCE_ID:'test',SPREADSHEET_ID:'file',SHEET_NAME:'Sales',REPORT_SECRET:'TEST-SECRET-ONLY-12345678901234567890'};let failWrite=false,failSend=false;const sent=[],triggers=[];const p={getProperty:k=>values[k]??null,getProperties:()=>({...values}),setProperties:parts=>{if(failWrite)throw Error('storage unavailable');Object.assign(values,parts)},setProperty:(k,v)=>{values[k]=v},deleteProperty:k=>{delete values[k]}};const ctx={console:{log:()=>{}},Date,Set,Map,ScriptApp:{getProjectTriggers:()=>[...triggers],deleteTrigger:t=>{const i=triggers.indexOf(t);if(i>=0)triggers.splice(i,1)},newTrigger:name=>{const t={getHandlerFunction:()=>name};const builder={timeBased:()=>builder,after:()=>builder,create:()=>{triggers.push(t);return t}};return builder;}},PropertiesService:{getScriptProperties:()=>p},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_algo,text)=>Array.from(crypto.createHash('sha256').update(text).digest()),getUuid:()=>crypto.randomUUID()},UrlFetchApp:{fetch:(_url,options)=>{sent.push(JSON.parse(options.payload));return {getResponseCode:()=>failSend?503:200,getContentText:()=>JSON.stringify({success:!failSend})}}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../integrations/google-sheets/Code.gs'),'utf8'),ctx);return {ctx,values,sent,triggers,failWrite:v=>failWrite=v,failSend:v=>failSend=v,pending:()=>Object.keys(values).filter(k=>k.startsWith('NIBA_MAIL_')).length};}
const row=(rowNumber=5,price=100)=>({rowNumber,values:{satisId:'P-TEST',bayi:'Demo',urun:'DAP',pesinSatisFiyati:price}});const update=(before=90,after=100,rowNumber=5)=>({rowNumber,status:'updated',changes:[{field:'pesinSatisFiyati',before,after}]});const issue=(rowNumber=5)=>({rowNumber,status:'invalid',message:'Sevk durumu tanınmıyor.'});
test('same actual change mails once across runs, including moved rows; new change mails again',()=>{const f=fixture();f.ctx.nQueueBatchReports([update()],[row()]);f.ctx.nFlushMail();assert.equal(f.sent.length,1);f.ctx.nQueueBatchReports([update()],[row()]);f.ctx.nFlushMail();assert.equal(f.sent.length,1);f.ctx.nQueueBatchReports([update(90,100,99)],[row(99)]);f.ctx.nFlushMail();assert.equal(f.sent.length,1);f.ctx.nQueueBatchReports([update(100,110)],[row(5,110)]);f.ctx.nFlushMail();assert.equal(f.sent.length,2);});
test('same unresolved row error mails once; after resolution recurrence is a new notification',()=>{const f=fixture();f.ctx.nQueueBatchReports([issue()],[row()]);f.ctx.nFlushMail();f.ctx.nQueueBatchReports([issue()],[row()]);f.ctx.nFlushMail();assert.equal(f.sent.length,1);f.ctx.nQueueBatchReports([{rowNumber:5,status:'unchanged'}],[row()]);f.ctx.nQueueBatchReports([issue()],[row()]);f.ctx.nFlushMail();assert.equal(f.sent.length,2);});
test('unchanged rows and numeric formatting differences never generate mail',()=>{const f=fixture();f.ctx.nQueueBatchReports([{rowNumber:5,status:'unchanged'}],[row()]);f.ctx.nQueueBatchReports([update(100,'100')],[row()]);f.ctx.nQueueBatchReports([update(1000,'1.000')],[row()]);f.ctx.nFlushMail();assert.equal(f.sent.length,0);assert.equal(f.pending(),0);});
test('failed queuing does not mark notification seen, allowing a safe retry',()=>{const f=fixture();f.failWrite(true);assert.throws(()=>f.ctx.nQueueBatchReports([update()],[row()]));f.failWrite(false);f.ctx.nQueueBatchReports([update()],[row()]);f.ctx.nFlushMail();assert.equal(f.sent.length,1);});
test('failed delivery retains exactly one queued report; retries preserve the same report ID',()=>{const f=fixture();f.ctx.nQueueBatchReports([update()],[row()]);const pending=f.pending();f.failSend(true);assert.throws(()=>f.ctx.nFlushMail());f.ctx.nQueueBatchReports([update()],[row()]);assert.equal(f.pending(),pending);f.failSend(false);f.ctx.nFlushMail();assert.equal(f.sent.length,2);assert.equal(f.sent[0].id,f.sent[1].id);assert.equal(f.pending(),0);});
test('repeated transfer error is deduplicated; manual email test can explicitly force a notification',()=>{const f=fixture();f.ctx.nQueueMail('Aktarım tamamlanamadı.');f.ctx.nFlushMail();f.ctx.nQueueMail('Aktarım tamamlanamadı.');f.ctx.nFlushMail();assert.equal(f.sent.length,1);f.ctx.nQueueMail('Test',null,true);f.ctx.nFlushMail();f.ctx.nQueueMail('Test',null,true);f.ctx.nFlushMail();assert.equal(f.sent.length,3);});
test('provided date range and scheduled transfer times are retained',()=>{const s=fs.readFileSync(require('node:path').join(__dirname,'../integrations/google-sheets/Code.gs'),'utf8');assert.ok(s.includes("NIBA_SYNC_START_DATE = '2023-09-14'"));assert.ok(s.includes('[12,20]'));assert.ok(s.includes('summary.fatura=nInvoiceStatuses(!live)'));});

test('updated result with no field detail is reported, not silently discarded',()=>{
 const f=fixture();f.ctx.nQueueBatchReports([{rowNumber:5,status:'updated',changes:[]}],[row()]);f.ctx.nFlushMail();assert.equal(f.sent.length,1);assert.match(JSON.stringify(f.sent[0]),/Sipariş güncellendi/);
});
test('legacy reference flag cannot mute normal update emails',()=>{
 const f=fixture();f.values.NIBA_NOTICE_BASELINE_V1='true';f.ctx.nQueueBatchReports([update()],[row()]);f.ctx.nFlushMail();assert.equal(f.sent.length,1);
});
test('read-only reference never consumes update notifications and preserves existing pending reports',()=>{
 const f=fixture();f.ctx.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};
 f.ctx.nQueueMail('Queued real change');const pending=f.pending();
 f.ctx.nRunCore=(dry,reference)=>{assert.equal(dry,true);assert.equal(reference,true);f.ctx.nQueueBatchReports([update()],[row()],true);return {complete:true};};
 f.ctx.mevcutBildirimleriReferansAl();assert.equal(f.pending(),pending);assert.equal(f.sent.length,0);
 f.ctx.nFlushMail();f.ctx.nQueueBatchReports([update()],[row()]);f.ctx.nFlushMail();assert.equal(f.sent.length,2);
});
function coreFixture(reference=false){
 const f=fixture();f.values.DRY_RUN='false';f.values.SHEETS_SYNC_SECRET='TEST-ONLY-SECRET-12345678901234567890';
 f.ctx.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};f.ctx.Utilities.newBlob=text=>({getBytes:()=>Buffer.from(text)});
 const rows=Array.from({length:1176},(_,i)=>({rowNumber:i+3,values:{satisId:'P-'+i,satisTarihi:'2023-09-14',not:'old'}}));
 f.ctx.nLoadRows=()=>rows;f.ctx.nInvoiceStatuses=()=>({});const visited=[],dryFlags=[];
 f.ctx.UrlFetchApp.fetch=(url,opt)=>{
  if(url.includes('rapor.')) {f.sent.push(JSON.parse(opt.payload));return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({success:true})};}
  const b=JSON.parse(opt.payload);visited.push(...b.rows.map(r=>r.values.satisId));dryFlags.push(b.dryRun);
  return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({success:true,dryRun:b.dryRun,results:b.rows.map(r=>({rowNumber:r.rowNumber,status:reference?'updated':'unchanged',changes:[]}))})};
 };
 return {...f,rows,visited,dryFlags};
}
test('normal sync finishes all 1176 rows automatically, newest first, without resetting on value edits',()=>{
 const f=coreFixture();f.values.NIBA_NOTICE_BASELINE_V1='true';let summary;
 for(let i=0;i<6;i++){
  if(i===1)f.rows[0].values.not='changed during pass';summary=f.ctx.nRun(false);
  if(i<5){assert.equal(summary.complete,false);assert.equal(f.triggers.filter(t=>t.getHandlerFunction()==='nSiparisAktarimiDevam').length,1);}
 }
 assert.equal(summary.processed,1176);assert.equal(summary.complete,true);assert.equal(f.visited[0],'P-1175');assert.equal(f.visited.length,1176);assert.equal(new Set(f.visited).size,1176);assert.ok(f.dryFlags.every(v=>v===false));assert.equal(f.triggers.length,0);
});
test('reference sends dry-run requests for every row and does not swallow later real changes',()=>{
 const f=coreFixture(true);let summary;
 for(let i=0;i<6;i++)summary=f.ctx.mevcutBildirimleriReferansAl();
 assert.equal(summary.complete,true);assert.ok(f.dryFlags.every(v=>v===true));assert.equal(f.sent.length,0);
 f.ctx.nQueueBatchReports([update()],[row()]);f.ctx.nFlushMail();assert.equal(f.sent.length,1);
});
test('mail delivery failure cannot block order transfer or continuation',()=>{
 const f=fixture();f.values.DRY_RUN='false';f.ctx.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};
 f.ctx.nQueueMail('Old pending report');f.failSend(true);let calls=0;
 f.ctx.nRunCore=()=>{calls++;f.ctx.nQueueBatchReports([update()],[row()]);return {complete:false,processed:200}};f.ctx.nInvoiceStatuses=()=>({});
 f.ctx.nRun(false);assert.equal(calls,1);assert.ok(f.pending()>0);assert.equal(f.triggers.filter(t=>t.getHandlerFunction()==='nSiparisAktarimiDevam').length,1);
});
