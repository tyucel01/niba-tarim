// Run with PGLITE_MODULE_PATH pointing to an installed @electric-sql/pglite module.
const {PGlite}=require(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite');
const fs=require('node:fs'), assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table public.siparisler(id uuid primary key,"satisId" text,"alisFiyati" numeric,"teslimOlanTonaj" numeric,"pesinSatisFiyati" numeric,"siparisTonaj" numeric,"bayiSatisToplam" numeric,"tedarikciyeOdenecekTutar" numeric,"gelenFatura" text,matched_purchase_invoice_id text,matched_purchase_invoice_no text,matched_purchase_invoice_total numeric,matched_purchase_allocated_amount numeric,matched_purchase_invoice_at timestamptz,sales_invoice_id text,sales_invoice_no text,sales_invoice_created_at timestamptz);
 `);
 for(const file of ['integrations/invoice-allocation/setup.sql','integrations/partial-sales/setup.sql','integrations/partial-sales/delivered-quantities.sql','integrations/invoice-differences/setup.sql','integrations/invoice-differences/refund-sales.sql','integrations/partial-sales/purchase-lines.sql','integrations/partial-sales/source-part-quantities.sql','integrations/partial-sales/multiple-source-lines.sql','integrations/multiple-purchase-invoices/setup.sql','integrations/multiple-purchase-invoices/source-lines.sql']) await db.exec(fs.readFileSync(file,'utf8'));

 const one='00000000-0000-0000-0000-000000000001';
 await db.query(`insert into public.siparisler(id,"alisFiyati","teslimOlanTonaj","pesinSatisFiyati") values($1,100,54,150)`,[one]);
 await db.exec(`insert into public.purchase_invoice_pool(e_invoice_id,purchase_bill_id,invoice_no,supplier_id,total,state) values('first-e','first','FIRST','supplier',2700,'ready'),('second-e','second','SECOND','supplier',2700,'ready')`);
 await db.query("select public.allocate_purchase_invoice_difference($1,'first-e','accept',2700,5400)",[one]);
 const reserve=(tons,lines)=>db.query("select public.reserve_order_sales_lines_part($1,$2,$3,'customer','fingerprint',$4::jsonb) as id",[one,tons,tons*150,JSON.stringify(lines)]);
 const firstLines=[{id:'a',tons:27}],secondLines=[{id:'second:b',tons:27}];
 const original=(await reserve(27,firstLines)).rows[0].id;
 await db.query("select public.record_order_sales_part($1,'invoice-1','INV-1')",[original]);
 await db.query("select public.finish_order_sales_part($1,'issued')",[original]);
 await db.query("select public.allocate_purchase_invoice_difference($1,'second-e','keep',2700,2700)",[one]);
 // This is the reported bug on the deployed old function.
 await assert.rejects(reserve(27,secondLines),/değiştirilemez/);
 await db.exec(fs.readFileSync('integrations/partial-source-snapshots/setup.sql','utf8'));
 const sourceUsage=async key=>Number((await db.query('select public.purchase_source_used_tons($1) as tons',[key])).rows[0].tons);
 assert.equal(await sourceUsage('first:a'),27);assert.equal(await sourceUsage('second:b'),0);
 const firstSnapshot=(await db.query('select source_lines from public.order_sales_invoice_parts where id=$1',[original])).rows[0].source_lines;
 assert.deepEqual(firstSnapshot,[{id:'first:a',tons:27}]);
 // Retry-safe migration and immutable issued source attribution.
 await db.exec(fs.readFileSync('integrations/partial-source-snapshots/setup.sql','utf8'));
 await assert.rejects(db.query("update public.order_sales_invoice_parts set source_lines='[]' where id=$1",[original]),/değiştirilemez/);
 await assert.rejects(reserve(27,firstLines),/kalan miktarı/);
 const next=(await reserve(27,secondLines)).rows[0].id;
 assert.equal(await sourceUsage('first:a'),27);assert.equal(await sourceUsage('second:b'),27);
 await assert.rejects(reserve(1,secondLines),/kalan miktarı|Önceki fatura/);
 await db.query("select public.finish_order_sales_part($1,'failed')",[next]);
 assert.equal(await sourceUsage('first:a'),27);assert.equal(await sourceUsage('second:b'),0);
 const retry=(await reserve(27,secondLines)).rows[0].id;
 await db.query("select public.record_order_sales_part($1,'invoice-2','INV-2')",[retry]);
 await db.query("select public.finish_order_sales_part($1,'issued')",[retry]);
 assert.equal(await sourceUsage('first:a'),27);assert.equal(await sourceUsage('second:b'),27);
 assert.deepEqual((await db.query('select source_lines from public.order_sales_invoice_parts where id=$1',[original])).rows[0].source_lines,firstSnapshot);
 assert.equal(Number((await db.query('select sales_invoiced_tonnage from public.siparisler where id=$1',[one])).rows[0].sales_invoiced_tonnage),54);
 assert.equal((await db.query("select has_function_privilege('anon','public.purchase_source_used_tons(text)','execute') as allowed")).rows[0].allowed,false);
 console.log('PASS PostgreSQL: reproduced 27+27 locked-source bug, migrated old source snapshots, selected second 27 without reallocating first, duplicate/quantity locks, immutable snapshots, failed retry, completed 54 tons, service-only permissions.');
 await db.close();
})().catch(error=>{console.error(error.message);process.exit(1)});
