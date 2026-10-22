// Run with PGLITE_MODULE_PATH pointing to an installed @electric-sql/pglite module.
const {PGlite}=require(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite');
const fs=require('node:fs'), assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table public.siparisler(id uuid primary key,"satisId" text,"alisFiyati" numeric,"teslimOlanTonaj" numeric,"pesinSatisFiyati" numeric,"siparisTonaj" numeric,"bayiSatisToplam" numeric,"tedarikciyeOdenecekTutar" numeric,"gelenFatura" text,matched_purchase_invoice_id text,matched_purchase_invoice_no text,matched_purchase_invoice_total numeric,matched_purchase_allocated_amount numeric,matched_purchase_invoice_at timestamptz,sales_invoice_id text,sales_invoice_no text,sales_invoice_created_at timestamptz);
 `);
 for(const file of ['integrations/invoice-allocation/setup.sql','integrations/partial-sales/setup.sql','integrations/partial-sales/delivered-quantities.sql','integrations/invoice-differences/setup.sql','integrations/invoice-differences/refund-sales.sql','integrations/partial-sales/purchase-lines.sql','integrations/partial-sales/source-part-quantities.sql','integrations/partial-sales/multiple-source-lines.sql','integrations/multiple-purchase-invoices/setup.sql','integrations/multiple-purchase-invoices/source-lines.sql']) await db.exec(fs.readFileSync(file,'utf8'));
 const one='00000000-0000-0000-0000-000000000001',two='00000000-0000-0000-0000-000000000002';
 await db.query(`insert into public.siparisler(id,"alisFiyati","teslimOlanTonaj","pesinSatisFiyati") values($1,100,10,150),($2,100,10,150)`,[one,two]);
 await db.exec(`insert into public.purchase_invoice_pool(e_invoice_id,purchase_bill_id,invoice_no,supplier_id,total,state) values ('e4293','b4293','AGR4293','supplier',400,'ready'),('e4418','b4418','AGR4418','supplier',650,'ready'),('extra','extra','EXTRA','supplier',100,'ready');`);
 const allocate=(order,invoice,mode,available,expected)=>db.query('select public.allocate_purchase_invoice_difference($1,$2,$3,$4,$5) as result',[order,invoice,mode,available,expected]);
 const current=async id=>(await db.query('select * from public.siparisler where id=$1',[id])).rows[0];
 await assert.rejects(allocate(one,'e4293','keep',400,1000),/Eksik/);
 await allocate(one,'e4293','accept',400,1000);
 let order=await current(one);assert.equal(order.matched_purchase_invoice_id,'b4293');assert.equal(Number(order.matched_purchase_allocated_amount),400);
 await assert.rejects(allocate(one,'e4293','accept',400,600),/zaten/);
 await assert.rejects(allocate(one,'e4418','refund',650,1000),/değişti/);
 await allocate(one,'e4418','refund',650,600);
 order=await current(one);assert.equal(order.matched_purchase_invoice_id,'b4293');assert.equal(order.matched_purchase_invoice_no,'AGR4293');assert.equal(order.purchase_invoice_matches.length,2);assert.equal(Number(order.matched_purchase_allocated_amount),1000);assert.equal(order.purchase_invoice_matches[0].allocatedAmount,400);assert.equal(order.purchase_invoice_matches[1].allocatedAmount,600);assert.equal(order.purchase_invoice_matches[1].refundAmount,50);assert.equal(order.purchase_difference_invoice_id,'b4418');
 await assert.rejects(allocate(two,'e4418','accept',650,1000),/kalmadı/);
 await assert.rejects(db.query('update public.siparisler set "teslimOlanTonaj"=11 where id=$1',[one]),/değiştirilemez/);
 await db.query('select public.reserve_purchase_difference_refund($1,50)',[one]);
 await assert.rejects(db.query('select public.reserve_purchase_difference_refund($1,50)',[one]),/Önceki/);
 order=await current(one);assert.equal(Number(order.matched_purchase_allocated_amount),1000);assert.equal(order.purchase_invoice_matches[0].allocatedAmount,400);assert.equal(order.purchase_invoice_matches[1].refundState,'creating');
 await assert.rejects(allocate(one,'extra','refund',100,0),/iade işlemi/);
 await db.query("update public.siparisler set purchase_refund_state='verified',purchase_refund_id='refund-1',purchase_refund_issue_state='submitted' where id=$1",[one]);
 await allocate(one,'extra','refund',100,0);order=await current(one);assert.equal(order.purchase_invoice_matches.length,3);assert.equal(order.purchase_invoice_matches[1].refundId,'refund-1');assert.equal(order.purchase_invoice_matches[2].refundAmount,100);assert.equal(Number(order.matched_purchase_allocated_amount),1000);
 // Account for multiple source bills and sharing another order's secondary bill.
 const lines=JSON.stringify([{id:'line-a',tons:4},{id:'b4418:line-b',tons:6}]);
 const reserve=(id,tons,ls)=>db.query("select public.reserve_order_sales_lines_part($1,$2,$3,'customer','fingerprint',$4::jsonb) as id",[id,tons,tons*150,ls]);
 const part=(await reserve(one,5,lines)).rows[0].id;
 await assert.rejects(reserve(one,1,lines),/Önceki fatura/);
 const third='00000000-0000-0000-0000-000000000003';
 await db.query(`insert into public.siparisler(id,"alisFiyati","teslimOlanTonaj","pesinSatisFiyati",matched_purchase_invoice_id,purchase_difference_mode,matched_purchase_allocated_amount) values($1,100,10,150,'b4418','accept',0)`,[third]);
 await assert.rejects(reserve(third,4,JSON.stringify([{id:'line-b',tons:6}])),/kalan miktarı/);
 await assert.rejects(reserve(third,3,JSON.stringify([{id:'line-b',tons:6}])),/Toplu alış/);

 // Allocate a fresh bill to another order, then share source capacity via that primary.
 await db.exec("insert into public.purchase_invoice_pool(e_invoice_id,purchase_bill_id,invoice_no,supplier_id,total,state) values('shared','shared','SHARED','supplier',1000,'ready')");
 await allocate(two,'shared','keep',1000,1000);
 await assert.rejects(reserve(two,1,JSON.stringify([{id:'b4418:line-b',tons:6}])),/bağlı değil/);
 await db.query("update public.order_sales_invoice_parts set state='issued' where id=$1",[part]);
 await db.query('update public.siparisler set sales_invoiced_tonnage=5,sales_invoiced_total=750 where id=$1',[one]);
 await assert.rejects(reserve(one,5,JSON.stringify([{id:'b4418:line-b',tons:6}])),/değiştirilemez/);
 await reserve(one,5,lines);
 // Functions remain unavailable to public clients.
 assert.equal((await db.query("select has_function_privilege('anon','public.allocate_purchase_invoice_difference(uuid,text,text,numeric,numeric)','execute') as allowed")).rows[0].allowed,false);
 await db.close();console.log('PASS PostgreSQL: preserve first match, append second, remaining balance, duplicate/stale rejection, per-source refund reservation/history, zero remaining refund, price/delivery locks, source membership, partial source mix and permissions.');
})().catch(error=>{console.error(error.message);process.exit(1)});
