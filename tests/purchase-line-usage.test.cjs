const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/orders/purchase-line-usage.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject});
test('source usage counts actual invoices and in-flight reservations, not full delivered order quantity',()=>{const assignments=[{line_id:'line',source_tons:27,order_id:'other',siparisler:{matched_purchase_invoice_id:'bill',teslimOlanTonaj:54,sales_invoiced_tonnage:10}},{line_id:'line',source_tons:27,order_id:'own',siparisler:{matched_purchase_invoice_id:'bill',sales_invoiced_tonnage:5}},{line_id:'another',source_tons:100,order_id:'unrelated',siparisler:{matched_purchase_invoice_id:'bill',sales_invoiced_tonnage:100}}];const reservations=[{order_id:'other',state:'creating',tons:3},{order_id:'other',state:'created',tons:10},{order_id:'other',state:'failed',tons:20}];assert.equal(exportsObject.purchaseLineUsedTons(assignments,reservations,'bill','line','own'),13);});

test('multi-line consumption splits invoiced and pending tons without double counting',()=>{
 const a=[{order_id:'multi',lines:[{id:'a',tons:26.5},{id:'b',tons:26.5}],siparisler:{matched_purchase_invoice_id:'bill',sales_invoiced_tonnage:20}}];
 const r=[{order_id:'multi',state:'creating',tons:10}];
 assert.equal(exportsObject.purchaseLineUsedTons(a,r,'bill','a'),15);
 assert.equal(exportsObject.purchaseLineUsedTons(a,r,'bill','b'),15);
 assert.equal(exportsObject.purchaseLineUsedTons(a,r,'bill','a','multi'),0);
});

test('an issued first 27 tons stays on the first bill after selecting the second bill',()=>{
 const order={id:'sale',matched_purchase_invoice_id:'first',sales_invoiced_tonnage:27,purchase_invoice_matches:[{purchaseBillId:'first'},{purchaseBillId:'second'}]};
 const assignments=[{order_id:'sale',purchase_bill_id:'first',lines:[{id:'second:b',tons:27}],siparisler:order}];
 const parts=[{order_id:'sale',state:'issued',tons:27,source_lines:[{id:'first:a',tons:27}]},{order_id:'sale',state:'creating',tons:27,source_lines:[{id:'second:b',tons:27}]}];
 assert.equal(exportsObject.purchaseLineUsedTons(assignments,parts,'first','a'),27);assert.equal(exportsObject.purchaseLineUsedTons(assignments,parts,'first','second:b'),27);
 parts[1].state='failed';assert.equal(exportsObject.purchaseLineUsedTons(assignments,parts,'first','second:b'),0);assert.equal(exportsObject.purchaseLineUsedTons(assignments,parts,'first','a'),27);
 assert.equal(exportsObject.canChoosePurchaseSources(order,parts),true);
});
test('legacy sources stay locked without complete per-invoice attribution; tracked single-source choices can change',()=>{
 const order={id:'sale',sales_invoiced_tonnage:27,purchase_invoice_matches:[{purchaseBillId:'first'},{purchaseBillId:'second'}]};
 assert.equal(exportsObject.canChoosePurchaseSources(order,[]),false);
 const parts=[{order_id:'sale',state:'issued',tons:27,source_lines:[{id:'first:a',tons:27}]}];
 assert.equal(exportsObject.canChoosePurchaseSources(order,parts),true);
 assert.equal(exportsObject.canChoosePurchaseSources({...order,purchase_invoice_matches:[{purchaseBillId:'first'}]},parts),true);
 assert.equal(exportsObject.canChoosePurchaseSources(order,[...parts,{order_id:'sale',state:'creating',tons:1}]),false);
});
