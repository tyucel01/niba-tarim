const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/orders/purchase-line-usage.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject});
test('source usage counts actual invoices and in-flight reservations, not full delivered order quantity',()=>{const assignments=[{line_id:'line',source_tons:27,order_id:'other',siparisler:{matched_purchase_invoice_id:'bill',teslimOlanTonaj:54,sales_invoiced_tonnage:10}},{line_id:'line',source_tons:27,order_id:'own',siparisler:{matched_purchase_invoice_id:'bill',sales_invoiced_tonnage:5}},{line_id:'another',source_tons:100,order_id:'unrelated',siparisler:{matched_purchase_invoice_id:'bill',sales_invoiced_tonnage:100}}];const reservations=[{order_id:'other',state:'creating',tons:3},{order_id:'other',state:'created',tons:10},{order_id:'other',state:'failed',tons:20}];assert.equal(exportsObject.purchaseLineUsedTons(assignments,reservations,'bill','line','own'),13);});

test('multi-line consumption splits invoiced and pending tons without double counting',()=>{
 const a=[{order_id:'multi',lines:[{id:'a',tons:26.5},{id:'b',tons:26.5}],siparisler:{matched_purchase_invoice_id:'bill',sales_invoiced_tonnage:20}}];
 const r=[{order_id:'multi',state:'creating',tons:10}];
 assert.equal(exportsObject.purchaseLineUsedTons(a,r,'bill','a'),15);
 assert.equal(exportsObject.purchaseLineUsedTons(a,r,'bill','b'),15);
 assert.equal(exportsObject.purchaseLineUsedTons(a,r,'bill','a','multi'),0);
});
