begin;
alter table public.order_sales_invoice_parts add column if not exists source_lines jsonb;

-- Existing partial invoices used a fixed source mix. Preserve it before allowing future choices.
update public.order_sales_invoice_parts p set source_lines=(
 select jsonb_agg(jsonb_build_object('id',public.purchase_source_line_key(a.purchase_bill_id,l->>'id'),
 'tons',round(p.tons*(l->>'tons')::numeric/(select sum((x->>'tons')::numeric) from jsonb_array_elements(public.purchase_assignment_lines(a)) x),12)) order by l->>'id')
 from jsonb_array_elements(public.purchase_assignment_lines(a)) l
)
from public.order_purchase_line_assignments a
where p.order_id=a.order_id and p.source_lines is null and p.state in('creating','created','issued','needs_review');

create or replace function public.purchase_source_used_tons(p_key text) returns numeric
language sql stable security invoker set search_path='' as $$
 select
 coalesce((select sum((l->>'tons')::numeric) from public.order_sales_invoice_parts p cross join lateral jsonb_array_elements(coalesce(p.source_lines,'[]')) l where p.state in('creating','created','issued','needs_review') and l->>'id'=p_key),0)
 +coalesce((select sum((greatest(0,coalesce(o.sales_invoiced_tonnage,0)-(select coalesce(sum(p.tons),0) from public.order_sales_invoice_parts p where p.order_id=o.id and p.state in('created','issued','needs_review') and jsonb_array_length(coalesce(p.source_lines,'[]'))>0))
 +(select coalesce(sum(p.tons),0) from public.order_sales_invoice_parts p where p.order_id=o.id and p.state='creating' and jsonb_array_length(coalesce(p.source_lines,'[]'))=0))
 *(l->>'tons')::numeric/(select sum((x->>'tons')::numeric) from jsonb_array_elements(public.purchase_assignment_lines(a)) x))
 from public.order_purchase_line_assignments a join public.siparisler o on o.id=a.order_id cross join lateral jsonb_array_elements(public.purchase_assignment_lines(a)) l where public.purchase_source_line_key(a.purchase_bill_id,l->>'id')=p_key),0);
$$;

-- Once captured, a prior invoice's source cannot be reassigned by a later invoice.
create or replace function public.protect_sales_source_snapshot() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.source_lines is not null and new.source_lines is distinct from old.source_lines then raise exception 'Kesilmiş veya ayrılmış faturanın alış kalemleri değiştirilemez.'; end if;
 return new;
end $$;
drop trigger if exists protect_sales_source_snapshot on public.order_sales_invoice_parts;
create trigger protect_sales_source_snapshot before update on public.order_sales_invoice_parts for each row execute function public.protect_sales_source_snapshot();

create or replace function public.reserve_order_sales_lines_part(p_order_id uuid,p_tons numeric,p_amount numeric,p_customer_id text,p_fingerprint text,p_lines jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare ord public.siparisler%rowtype; previous public.order_purchase_line_assignments%rowtype; bill_id text; used numeric; reservation uuid; item jsonb; total numeric; normalized jsonb; source_bill text; source_key text; initial_matches jsonb; tracked_billed numeric;
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
 if found and coalesce(ord.sales_invoiced_tonnage,0)>0 and (previous.purchase_bill_id<>bill_id or normalized<>(select jsonb_agg(l order by l->>'id') from jsonb_array_elements(public.purchase_assignment_lines(previous)) l)) then
   select coalesce(sum(p.tons),0) into tracked_billed from public.order_sales_invoice_parts p where p.order_id=p_order_id and p.state in('created','issued','needs_review') and jsonb_array_length(coalesce(p.source_lines,'[]'))>0;
   if jsonb_array_length(initial_matches)<2 or abs(tracked_billed-ord.sales_invoiced_tonnage)>.000001 or exists(select 1 from public.order_sales_invoice_parts p where p.order_id=p_order_id and p.state in('creating','created','needs_review')) then raise exception 'Önceki faturanın kalem kullanımı doğrulanamadı veya işlem tamamlanmadı. Kalemler değiştirilemez.'; end if;
 end if;
 for item in select * from jsonb_array_elements(normalized) loop
   source_bill:=case when strpos(item->>'id',':')>0 then split_part(item->>'id',':',1) else bill_id end;
   source_key:=public.purchase_source_line_key(bill_id,item->>'id');
   if not exists(select 1 from jsonb_array_elements(public.purchase_matches(ord)) m where m->>'purchaseBillId'=source_bill) then raise exception 'Seçilen kalemin alış faturası bu satışa bağlı değil.'; end if;
   if exists(select 1 from public.siparisler o where exists(select 1 from jsonb_array_elements(public.purchase_matches(o)) m where m->>'purchaseBillId'=source_bill) and (o.sales_invoice_id is not null or coalesce(o.sales_invoiced_tonnage,0)>0 or exists(select 1 from public.order_sales_invoice_parts p where p.order_id=o.id and p.state='creating')) and not exists(select 1 from public.order_purchase_line_assignments a where a.order_id=o.id)) then raise exception 'Geçmiş satışların kullanılan kalemleri doğrulanamadı.'; end if;
   used:=public.purchase_source_used_tons(source_key);
   if used+p_tons*(item->>'tons')::numeric/total>(item->>'tons')::numeric+.000001 then raise exception 'Seçilen alış kaleminin kalan miktarı yetersiz.'; end if;
 end loop;
 reservation:=public.reserve_order_sales_part(p_order_id,p_tons,p_amount,p_customer_id,p_fingerprint);
 update public.order_sales_invoice_parts set source_lines=(select jsonb_agg(jsonb_build_object('id',public.purchase_source_line_key(bill_id,l->>'id'),'tons',round(p_tons*(l->>'tons')::numeric/total,12)) order by l->>'id') from jsonb_array_elements(normalized) l) where id=reservation;

 insert into public.order_purchase_line_assignments(order_id,purchase_bill_id,line_id,source_tons,lines) values(p_order_id,bill_id,normalized->0->>'id',total,normalized)
 on conflict(order_id) do update set purchase_bill_id=excluded.purchase_bill_id,line_id=excluded.line_id,source_tons=excluded.source_tons,lines=excluded.lines;
 return reservation;
end $$;
revoke execute on function public.purchase_source_used_tons(text),public.protect_sales_source_snapshot() from public,anon,authenticated;
grant execute on function public.purchase_source_used_tons(text) to service_role;
notify pgrst, 'reload schema';
commit;
