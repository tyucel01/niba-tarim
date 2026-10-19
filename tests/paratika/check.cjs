const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, fetch) {const exports = {};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,process,URL,URLSearchParams,AbortSignal,fetch,Date,Intl});return exports;}
(async()=>{
const g=load('lib/paratika/gateway.ts');
assert.equal(g.toMinor('26,50'),2650);assert.equal(g.money(2650),'26.50');
for(const v of ['0','-1','1.234','1e4','Infinity','1,000.00'])assert.throws(()=>g.toMinor(v));
assert.equal(g.posConfig({}).enabled,false);assert.equal(g.posConfig({PARATIKA_MODE:'live',PARATIKA_ENABLED:'true'}).enabled,false);
assert.throws(()=>g.checkoutUrl({mode:'live',session_token:'https://evil.test'}));
const p={merchant_payment_id:'NIBA-test',merchant:'10013929',customer_id:'123',amount_minor:2650,currency:'TRY'};
const sale={transactionType:'SALE',transactionStatus:'AP',pgOrderId:'10013929-NIBA-test',customerId:'123',amount:'26.50',currency:'TRY',pgTranId:'abc123',timeCreated:'2026-10-19 14:00:00.000'};
const query=(s=sale)=>({responseCode:'00',totalTransactionCount:1,transactionList:[s]});
assert.equal(g.verifyQuery(p,query()).status,'paid');
for(const change of [{amount:'26.51'},{customerId:'124'},{currency:'USD'},{pgOrderId:'other'},{pgTranId:''},{timeCreated:'2026-02-30'}])assert.equal(g.verifyQuery(p,query({...sale,...change})).status,'review');
assert.equal(g.verifyQuery(p,{responseCode:'00',transactionList:[]}).status,'pending');
assert.equal(g.verifyQuery(p,{responseCode:'00',transactionList:[sale,sale]}).status,'review');
assert.equal(g.verifyQuery(p,{responseCode:'00',transactionList:[sale,{transactionType:'REFUND',transactionStatus:'AP'}]}).status,'review');
assert.equal(g.verifyQuery(p,{responseCode:'00',totalTransactionCount:2,transactionList:[sale]}).status,'review');
assert.equal(g.verifyQuery(p,{responseCode:'99',transactionList:[sale]}).status,'pending');
const calls=[];process.env.PARASUT_COMPANY_ID='1';process.env.PARASUT_ACCOUNT_ID='2';
const ledger=load('lib/parasut/card-ledger.ts',async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});return {ok:true,json:async()=>url.includes('oauth')?{access_token:'mock'}:{data:{id:'mock-id'}}};});
await ledger.createCardLedgerTransaction({contactId:'3',transactionType:'collection',date:'2026-10-19',amount:26.5});
assert.match(calls[1].url,/contact_credit_transactions$/);assert.equal(calls[1].body.data.attributes.account_id,2);assert.equal(calls[1].body.data.attributes.amount,26.5);
await ledger.createCardLedgerTransaction({contactId:'3',transactionType:'payment',date:'2026-10-19',amount:10,accountId:'4'});
assert.match(calls[3].url,/contact_debit_transactions$/);assert.equal(calls[3].body.data.attributes.account_id,4);
console.log('Paratika doğrulama ve mevcut Paraşüt kayıt yönleri: başarılı. Dış servise istek gönderilmedi.');
})().catch(e=>{console.error(e);process.exitCode=1});
