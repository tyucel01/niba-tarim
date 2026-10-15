begin;
alter table public.order_purchase_line_assignments add column if not exists lines jsonb;
-- A fixed source mix keeps partial invoices and legacy single-line invoices compatible.
create or replace function public.purchase_assignment_lines(a public.order_purchase_line_assignments) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select coalesce(a.lines,jsonb_build_array(jsonb_build_object('id',a.line_id,'tons',a.source_tons)));
$$;
create or replace function public.reserve_order_sales_lines_part(p_order_id uuid,p_tons numeric,p_amount numeric,p_customer_id text,p_fingerprint text,p_lines jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare ord public.siparisler%rowtype; previous public.order_purchase_line_assignments%rowtype; bill_id text; used numeric; reservation uuid; item jsonb; total numeric; normalized jsonb;
begin
 select matched_purchase_invoice_id into bill_id from public.siparisler where id=p_order_id;
 perform 1 from public.purchase_invoice_pool where purchase_bill_id=bill_id for update;
 select * into ord from public.siparisler where id=p_order_id for update;
 if not found then raise exception 'Sipariş bulunamadı.'; end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'Alış faturası kalemleri doğrulanamadı.'; end if;
 if exists(select 1 from jsonb_array_elements(p_lines) l where coalesce(l->>'id','')='' or (l->>'tons') is null or (l->>'tons')::numeric<=0 or (l->>'tons')::numeric::text in ('NaN','Infinity','-Infinity')) then raise exception 'Alış kalemi miktarı geçersiz.'; end if;
 if (select count(distinct l->>'id') from jsonb_array_elements(p_lines) l)<>jsonb_array_length(p_lines) then raise exception 'Aynı kalem birden fazla seçilemez.'; end if;
 select jsonb_agg(jsonb_build_object('id',l->>'id','tons',(l->>'tons')::numeric) order by l->>'id'),sum((l->>'tons')::numeric) into normalized,total from jsonb_array_elements(p_lines) l;
 select * into previous from public.order_purchase_line_assignments where order_id=p_order_id;
 if found and coalesce(ord.sales_invoiced_tonnage,0)>0 and (previous.purchase_bill_id<>bill_id or normalized<>(select jsonb_agg(l order by l->>'id') from jsonb_array_elements(public.purchase_assignment_lines(previous)) l)) then raise exception 'Kısmen faturalanmış siparişin kalemleri değiştirilemez.'; end if;
 if exists(select 1 from public.siparisler o where o.matched_purchase_invoice_id=bill_id and (o.sales_invoice_id is not null or coalesce(o.sales_invoiced_tonnage,0)>0 or exists(select 1 from public.order_sales_invoice_parts p where p.order_id=o.id and p.state='creating')) and not exists(select 1 from public.order_purchase_line_assignments a where a.order_id=o.id)) then raise exception 'Geçmiş satışların kullanılan kalemleri doğrulanamadı.'; end if;
 for item in select * from jsonb_array_elements(normalized) loop
   select coalesce(sum((coalesce(o.sales_invoiced_tonnage,0)+(select coalesce(sum(p.tons),0) from public.order_sales_invoice_parts p where p.order_id=o.id and p.state='creating'))*(l->>'tons')::numeric/(select sum((x->>'tons')::numeric) from jsonb_array_elements(public.purchase_assignment_lines(a)) x)),0) into used
   from public.order_purchase_line_assignments a join public.siparisler o on o.id=a.order_id cross join lateral jsonb_array_elements(public.purchase_assignment_lines(a)) l
   where a.purchase_bill_id=bill_id and o.matched_purchase_invoice_id=bill_id and l->>'id'=item->>'id';
   if used+p_tons*(item->>'tons')::numeric/total>(item->>'tons')::numeric+.000001 then raise exception 'Seçilen alış kaleminin kalan miktarı yetersiz.'; end if;
 end loop;
 reservation:=public.reserve_order_sales_part(p_order_id,p_tons,p_amount,p_customer_id,p_fingerprint);
 insert into public.order_purchase_line_assignments(order_id,purchase_bill_id,line_id,source_tons,lines) values(p_order_id,bill_id,normalized->0->>'id',total,normalized)
 on conflict(order_id) do update set purchase_bill_id=excluded.purchase_bill_id,line_id=excluded.line_id,source_tons=excluded.source_tons,lines=excluded.lines;
 return reservation;
end $$;
-- The previous endpoint also uses the same checks during rolling deployments.
create or replace function public.reserve_order_sales_line_part(p_order_id uuid,p_tons numeric,p_amount numeric,p_customer_id text,p_fingerprint text,p_line_id text,p_source_tons numeric) returns uuid
language sql security invoker set search_path='' as $$
 select public.reserve_order_sales_lines_part(p_order_id,p_tons,p_amount,p_customer_id,p_fingerprint,jsonb_build_array(jsonb_build_object('id',p_line_id,'tons',p_source_tons)));
$$;
revoke execute on function public.purchase_assignment_lines(public.order_purchase_line_assignments),public.reserve_order_sales_lines_part(uuid,numeric,numeric,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.purchase_assignment_lines(public.order_purchase_line_assignments),public.reserve_order_sales_lines_part(uuid,numeric,numeric,text,text,jsonb) to service_role;
commit;
