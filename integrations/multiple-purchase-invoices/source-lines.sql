begin;
create or replace function public.reserve_order_sales_part(p_order_id uuid,p_tons numeric,p_amount numeric,p_customer_id text,p_fingerprint text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare ord public.siparisler%rowtype; tons numeric; total numeric; remaining numeric; expected numeric; result uuid; bill public.purchase_invoice_pool%rowtype; used numeric; invoice_id text; initial_matches jsonb;
begin
 select public.purchase_matches(o) into initial_matches from public.siparisler o where id=p_order_id;
 perform 1 from public.purchase_invoice_pool where purchase_bill_id in(select m->>'purchaseBillId' from jsonb_array_elements(initial_matches) m) order by purchase_bill_id for update;
 select * into ord from public.siparisler where id=p_order_id for update;
 if not found then raise exception 'Sipariş bulunamadı.'; end if;
 if initial_matches is distinct from public.purchase_matches(ord) then raise exception 'Alış faturası eşleşmesi değişti. Önizlemeyi yenileyin.'; end if;
 if jsonb_array_length(initial_matches)=0 or (select count(*) from public.purchase_invoice_pool where purchase_bill_id in(select m->>'purchaseBillId' from jsonb_array_elements(initial_matches) m))<>jsonb_array_length(initial_matches) then raise exception 'Alış faturası takip kaydı bulunamadı.'; end if;
 if exists(select 1 from public.order_sales_invoice_parts where order_id=p_order_id and state in('creating','created','needs_review')) then raise exception 'Önceki fatura işlemi kontrol bekliyor. Paraşüt üzerinde kontrol edin; tekrar fatura oluşturulmadı.'; end if;
 tons:=coalesce(ord."teslimOlanTonaj",0);
 total:=round(coalesce(ord."pesinSatisFiyati"*tons,0),2);
 for bill in select * from public.purchase_invoice_pool where purchase_bill_id in(select m->>'purchaseBillId' from jsonb_array_elements(initial_matches) m) loop
   select coalesce(sum((m->>'allocatedAmount')::numeric+coalesce((m->>'refundAmount')::numeric,0)),0) into used from public.siparisler o cross join lateral jsonb_array_elements(public.purchase_matches(o)) m where m->>'purchaseBillId'=bill.purchase_bill_id;
   if used>bill.total or public.purchase_delivery_allocation(ord)<=0 then raise exception 'Toplu alış faturasının tutarı teslim edilen siparişleri karşılamıyor. Alış faturası eşleşmelerini kontrol edin.'; end if;
 end loop;
 remaining:=tons-coalesce(ord.sales_invoiced_tonnage,0);
 if p_tons is null or p_tons<=0 or p_tons<>round(p_tons,6) or p_tons>remaining or tons<=0 then raise exception 'Kesilecek tonaj kalan sipariş tonajını aşamaz.'; end if;
 expected:=case when p_tons=remaining then total-coalesce(ord.sales_invoiced_total,0) else round(total*p_tons/tons,2) end;
 if expected<=0 or p_amount is null or abs(p_amount-expected)>0.05 or p_amount>total-coalesce(ord.sales_invoiced_total,0) then raise exception 'Kesilecek fatura tutarı kalan sipariş tutarını aşamaz veya önizlemeyle uyuşmuyor.'; end if;
 insert into public.order_sales_invoice_parts(order_id,tons,amount,customer_id,fingerprint) values(p_order_id,p_tons,p_amount,p_customer_id,p_fingerprint) returning id into result;
 return result;
end $$;

-- Canonical IDs allow a secondary bill to be shared with another sale's primary bill.
create or replace function public.purchase_source_line_key(p_bill text,p_line text) returns text
language sql immutable security invoker set search_path='' as $$
 select case when strpos(p_line,':')>0 then p_line else p_bill||':'||p_line end;
$$;
create or replace function public.reserve_order_sales_lines_part(p_order_id uuid,p_tons numeric,p_amount numeric,p_customer_id text,p_fingerprint text,p_lines jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare ord public.siparisler%rowtype; previous public.order_purchase_line_assignments%rowtype; bill_id text; used numeric; reservation uuid; item jsonb; total numeric; normalized jsonb; source_bill text; source_key text; initial_matches jsonb;
begin
 select public.purchase_matches(o),o.matched_purchase_invoice_id into initial_matches,bill_id from public.siparisler o where id=p_order_id;
 perform 1 from public.purchase_invoice_pool where purchase_bill_id in(select m->>'purchaseBillId' from jsonb_array_elements(initial_matches) m) order by purchase_bill_id for update;
 select * into ord from public.siparisler where id=p_order_id for update;
 if not found then raise exception 'Sipariş bulunamadı.'; end if;
 if initial_matches is distinct from public.purchase_matches(ord) then raise exception 'Alış faturası eşleşmesi değişti. Önizlemeyi yenileyin.'; end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'Alış faturası kalemleri doğrulanamadı.'; end if;
 if exists(select 1 from jsonb_array_elements(p_lines) l where coalesce(l->>'id','')='' or (l->>'tons') is null or (l->>'tons')::numeric<=0 or (l->>'tons')::numeric::text in ('NaN','Infinity','-Infinity')) then raise exception 'Alış kalemi miktarı geçersiz.'; end if;
 if (select count(distinct public.purchase_source_line_key(bill_id,l->>'id')) from jsonb_array_elements(p_lines) l)<>jsonb_array_length(p_lines) then raise exception 'Aynı kalem birden fazla seçilemez.'; end if;
 select jsonb_agg(jsonb_build_object('id',l->>'id','tons',(l->>'tons')::numeric) order by l->>'id'),sum((l->>'tons')::numeric) into normalized,total from jsonb_array_elements(p_lines) l;
 select * into previous from public.order_purchase_line_assignments where order_id=p_order_id;
 if found and coalesce(ord.sales_invoiced_tonnage,0)>0 and (previous.purchase_bill_id<>bill_id or normalized<>(select jsonb_agg(l order by l->>'id') from jsonb_array_elements(public.purchase_assignment_lines(previous)) l)) then raise exception 'Kısmen faturalanmış siparişin kalemleri değiştirilemez.'; end if;
 for item in select * from jsonb_array_elements(normalized) loop
   source_bill:=case when strpos(item->>'id',':')>0 then split_part(item->>'id',':',1) else bill_id end;
   source_key:=public.purchase_source_line_key(bill_id,item->>'id');
   if not exists(select 1 from jsonb_array_elements(public.purchase_matches(ord)) m where m->>'purchaseBillId'=source_bill) then raise exception 'Seçilen kalemin alış faturası bu satışa bağlı değil.'; end if;
   if exists(select 1 from public.siparisler o where exists(select 1 from jsonb_array_elements(public.purchase_matches(o)) m where m->>'purchaseBillId'=source_bill) and (o.sales_invoice_id is not null or coalesce(o.sales_invoiced_tonnage,0)>0 or exists(select 1 from public.order_sales_invoice_parts p where p.order_id=o.id and p.state='creating')) and not exists(select 1 from public.order_purchase_line_assignments a where a.order_id=o.id)) then raise exception 'Geçmiş satışların kullanılan kalemleri doğrulanamadı.'; end if;
   select coalesce(sum((coalesce(o.sales_invoiced_tonnage,0)+(select coalesce(sum(p.tons),0) from public.order_sales_invoice_parts p where p.order_id=o.id and p.state='creating'))*(l->>'tons')::numeric/(select sum((x->>'tons')::numeric) from jsonb_array_elements(public.purchase_assignment_lines(a)) x)),0) into used
   from public.order_purchase_line_assignments a join public.siparisler o on o.id=a.order_id cross join lateral jsonb_array_elements(public.purchase_assignment_lines(a)) l
   where public.purchase_source_line_key(a.purchase_bill_id,l->>'id')=source_key;
   if used+p_tons*(item->>'tons')::numeric/total>(item->>'tons')::numeric+.000001 then raise exception 'Seçilen alış kaleminin kalan miktarı yetersiz.'; end if;
 end loop;
 reservation:=public.reserve_order_sales_part(p_order_id,p_tons,p_amount,p_customer_id,p_fingerprint);
 insert into public.order_purchase_line_assignments(order_id,purchase_bill_id,line_id,source_tons,lines) values(p_order_id,bill_id,normalized->0->>'id',total,normalized)
 on conflict(order_id) do update set purchase_bill_id=excluded.purchase_bill_id,line_id=excluded.line_id,source_tons=excluded.source_tons,lines=excluded.lines;
 return reservation;
end $$;
revoke execute on function public.purchase_source_line_key(text,text) from public,anon,authenticated;
grant execute on function public.purchase_source_line_key(text,text) to service_role;
commit;
