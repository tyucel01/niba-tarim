const {test}=require('node:test'); const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app/api/admin/parasut/sales-invoice/create-from-order/route.ts'),'utf8');
const fn=source.slice(source.indexOf('function buildSalesInvoicePayload('),source.indexOf('async function createEInvoice'));
const ctx={exports:{},clean:v=>String(v??'').trim(),toNumber:v=>Number(v||0),today:()=> '2026-10-07'};vm.createContext(ctx);vm.runInContext(ts.transpile(fs.readFileSync(path.join(__dirname,"../lib/orders/sales-progress.ts"),"utf8")).replace(/export /g,""),ctx);vm.runInContext(ts.transpile(fn),ctx);
function build(allocated=4000,vat=0) {return ctx.buildSalesInvoicePayload({customerId:'test',sourceLineId:'line-a',order:{id:'test',siparisTonaj:4,teslimOlanTonaj:2,alisFiyati:allocated/2,pesinSatisFiyati:2500,bayiSatisToplam:5000,matched_purchase_allocated_amount:allocated},purchaseBill:{data:{attributes:{currency:'TRL',net_total:10000}},included:[{type:'purchase_bill_details',id:'line-a',attributes:{description:'Gübre',quantity:2000,unit:'kg',unit_price:5,net_total:10000,vat_rate:vat}}]}})}
test('shared bill uses delivered quantity and preserves zero VAT with order selling total',()=>{const result=build();assert.equal(result.preview.details[0].quantity,2000);assert.equal(result.preview.details[0].vat_rate,0);assert.equal(result.preview.vatTotal,0);assert.equal(result.preview.estimatedTotal,5000);assert.equal(result.preview.sourceShare,.4)});
test('VAT is included in selling total and original rate is preserved',()=>{const result=build(4000,20);assert.equal(result.preview.details[0].vat_rate,20);assert.equal(result.preview.estimatedTotal,5000)});
test('invalid allocation blocks invoice creation',()=>{assert.throws(()=>build(0),/ayrılan/);assert.throws(()=>build(12000),/ayrılan/)});
test('reusable list omits exhausted bills and totals multiple allocations',async()=>{
 const pool=[{e_invoice_id:'a',purchase_bill_id:'a',total:100000},{e_invoice_id:'b',purchase_bill_id:'b',total:100000}];const orders=[{matched_purchase_invoice_id:'a',matched_purchase_allocated_amount:40000},{matched_purchase_invoice_id:'a',matched_purchase_allocated_amount:20000},{matched_purchase_invoice_id:'b',matched_purchase_allocated_amount:100000}];
 const db={from:table=>{const q={select:()=>q,eq:()=>q,order:async()=>({data:pool}),in:()=>q,range:async()=>({data:orders})};return q}};
 const module={exports:{}};const code=ts.transpile(fs.readFileSync(path.join(__dirname,'../lib/parasut/invoice-pool.ts'),'utf8'),{module:ts.ModuleKind.CommonJS});const sandbox={module,exports:module.exports,require:name=>name.includes("sales-progress")?{purchaseAllocation:ctx.purchaseAllocation}:({createClient:()=>db}),process:{env:{}}};vm.createContext(sandbox);vm.runInContext(code,sandbox);const result=await sandbox.exports.reusableInvoices();assert.equal(result.length,1);assert.equal(result[0].allocated_amount,60000);assert.equal(result[0].remaining_amount,40000);
});
test('54 tons can be invoiced as 27 plus 27 with unchanged unit price and zero VAT',()=>{
 const bill={data:{attributes:{currency:'TRL',net_total:540000}},included:[{type:'purchase_bill_details',id:'line-a',attributes:{description:'Gübre',quantity:54000,unit:'kg',unit_price:10,net_total:540000,vat_rate:0}}]};
 const order={siparisTonaj:60,teslimOlanTonaj:54,alisFiyati:10000,pesinSatisFiyati:20000,bayiSatisToplam:1200000,matched_purchase_allocated_amount:540000};
 const first=ctx.buildSalesInvoicePayload({order,customerId:'test',sourceLineId:'line-a',purchaseBill:bill,invoiceTons:27});
 assert.equal(first.preview.estimatedTotal,540000);assert.equal(first.preview.details[0].quantity,27000);assert.equal(first.preview.details[0].unit_price,20);assert.equal(first.preview.remainingTons,27);
 const nextOrder={...order,sales_invoiced_tonnage:27,sales_invoiced_total:540000};
 const second=ctx.buildSalesInvoicePayload({order:nextOrder,customerId:'test',sourceLineId:'line-a',purchaseBill:bill,invoiceTons:27});assert.equal(second.preview.estimatedTotal,540000);assert.equal(second.preview.remainingTotal,0);assert.equal(second.preview.details[0].unit_price,20);
 assert.throws(()=>ctx.buildSalesInvoicePayload({order:nextOrder,customerId:'test',sourceLineId:'line-a',purchaseBill:bill,invoiceTons:28}),/aşamaz/);
 assert.throws(()=>ctx.salesPart({...nextOrder,sales_invoiced_tonnage:54,sales_invoiced_total:1080000},1),/aşamaz/);
});
test('partial final invoice consumes rounding remainder and rejects excess monetary value',()=>{
 const order={siparisTonaj:5,teslimOlanTonaj:3,pesinSatisFiyati:100/3,bayiSatisToplam:500,sales_invoiced_tonnage:2,sales_invoiced_total:66.66};assert.equal(ctx.salesPart(order,1).invoiceAmount,33.34);
 assert.throws(()=>ctx.salesPart({...order,sales_invoiced_total:99},.5),/tutarı/);
});

test('order totals are ignored and delivery determines sale, purchase and available invoice balance',()=>{
 const order={siparisTonaj:54,teslimOlanTonaj:27,pesinSatisFiyati:20000,alisFiyati:10000,bayiSatisToplam:1080000,tedarikciyeOdenecekTutar:540000,matched_purchase_allocated_amount:540000};
 assert.equal(ctx.salesPart(order,27).invoiceAmount,540000);assert.equal(ctx.purchaseAllocation(order),270000);
 assert.throws(()=>ctx.salesPart({...order,teslimOlanTonaj:0},1),/Teslim/);
 assert.equal(ctx.purchaseAllocation({...order,sales_invoice_id:'historical',sales_invoice_history:[{state:'legacy'}]}),540000);
});

test('selected source line invoices only its product, quantity and VAT',()=>{
 const order={teslimOlanTonaj:27,alisFiyati:10000,pesinSatisFiyati:20000};
 const bill={data:{attributes:{currency:'TRL',net_total:1080000}},included:[{id:'a',type:'purchase_bill_details',attributes:{description:'Üre',quantity:27000,unit:'kg',net_total:270000,vat_rate:0}},{id:'b',type:'purchase_bill_details',attributes:{description:'DAP',quantity:54000,unit:'kg',net_total:810000,vat_rate:20}}]};
 const result=ctx.buildSalesInvoicePayload({order,customerId:'test',purchaseBill:bill,invoiceTons:13.5,sourceLineId:'a'});
 assert.equal(result.preview.details.length,1);assert.equal(result.preview.details[0].product_name,'Üre');assert.equal(result.preview.details[0].quantity,13500);assert.equal(result.preview.vatTotal,0);assert.equal(result.preview.estimatedTotal,270000);
 assert.throws(()=>ctx.buildSalesInvoicePayload({order,customerId:'test',purchaseBill:bill,invoiceTons:13.5}),/kalemi seç/);
 assert.throws(()=>ctx.buildSalesInvoicePayload({order,customerId:'test',purchaseBill:bill,invoiceTons:13.5,sourceLineId:'missing'}),/bulunamadı/);
 const choices=ctx.buildSalesInvoicePayload({order,customerId:'',purchaseBill:bill,sourceOnly:true});assert.equal(choices.preview.sourceLines.length,2);
});
