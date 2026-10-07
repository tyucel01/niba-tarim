begin;
create table public.order_purchase_line_assignments (
 order_id uuid primary key references public.siparisler(id) on delete cascade,
 purchase_bill_id text not null,
 line_id text not null,
 source_tons numeric(18,6) not null check(source_tons>0),
 created_at timestamptz not null default now()
);
create index order_purchase_line_bill on public.order_purchase_line_assignments(purchase_bill_id,line_id);
alter table public.order_purchase_line_assignments enable row level security;
revoke all on public.order_purchase_line_assignments from public,anon,authenticated;
grant all on public.order_purchase_line_assignments to service_role;
create function public.reserve_order_sales_line_part(p_order_id uuid,p_tons numeric,p_amount numeric,p_customer_id text,p_fingerprint text,p_line_id text,p_source_tons numeric) returns uuid
language plpgsql security invoker set search_path='' as $$
declare ord public.siparisler%rowtype; previous public.order_purchase_line_assignments%rowtype; bill_id text; used numeric; reservation uuid;
begin
 select matched_purchase_invoice_id into bill_id from public.siparisler where id=p_order_id;
 perform 1 from public.purchase_invoice_pool where purchase_bill_id=bill_id for update;
 select * into ord from public.siparisler where id=p_order_id for update;
 if p_line_id is null or p_line_id='' or p_source_tons is null or p_source_tons<=0 then raise exception 'Alış faturası kalemi doğrulanamadı.'; end if;
 select * into previous from public.order_purchase_line_assignments where order_id=p_order_id;
 if found and coalesce(ord.sales_invoiced_tonnage,0)>0 and (previous.line_id<>p_line_id or previous.purchase_bill_id<>bill_id) then raise exception 'Kısmen faturalanmış siparişin kalemi değiştirilemez.'; end if;
 if exists(select 1 from public.siparisler o where o.matched_purchase_invoice_id=bill_id and (o.sales_invoice_id is not null or coalesce(o.sales_invoiced_tonnage,0)>0) and not exists(select 1 from public.order_purchase_line_assignments a where a.order_id=o.id)) then raise exception 'Geçmiş satışların kullanılan kalemleri doğrulanamadı. Paraşüt üzerinde kontrol edin.'; end if;
 select coalesce(sum(o."teslimOlanTonaj"),0) into used from public.order_purchase_line_assignments a join public.siparisler o on o.id=a.order_id where a.purchase_bill_id=bill_id and a.line_id=p_line_id and a.order_id<>p_order_id and o.matched_purchase_invoice_id=bill_id;
 if used+coalesce(ord."teslimOlanTonaj",0)>p_source_tons+.000001 then raise exception 'Seçilen kalemin kalan tonajı teslim edilen sipariş için yetersiz.'; end if;
 reservation:=public.reserve_order_sales_part(p_order_id,p_tons,p_amount,p_customer_id,p_fingerprint);
 insert into public.order_purchase_line_assignments(order_id,purchase_bill_id,line_id,source_tons) values(p_order_id,bill_id,p_line_id,p_source_tons) on conflict(order_id) do update set purchase_bill_id=excluded.purchase_bill_id,line_id=excluded.line_id,source_tons=excluded.source_tons;
 return reservation;
end $$;
revoke execute on function public.reserve_order_sales_line_part(uuid,numeric,numeric,text,text,text,numeric) from public,anon,authenticated;
grant execute on function public.reserve_order_sales_line_part(uuid,numeric,numeric,text,text,text,numeric) to service_role;
create function public.protect_purchase_line_delivery() returns trigger language plpgsql security invoker set search_path='' as $$
declare assignment public.order_purchase_line_assignments%rowtype; used numeric;
begin
 if new."teslimOlanTonaj" is not distinct from old."teslimOlanTonaj" and new.matched_purchase_invoice_id is not distinct from old.matched_purchase_invoice_id then return new; end if;
 select * into assignment from public.order_purchase_line_assignments where order_id=old.id;
 if not found then return new; end if;
 perform 1 from public.purchase_invoice_pool where purchase_bill_id=assignment.purchase_bill_id for update;
 if new.matched_purchase_invoice_id is distinct from assignment.purchase_bill_id then raise exception 'Kalemi ayrılmış siparişin alış faturası değiştirilemez.'; end if;
 select coalesce(sum(o."teslimOlanTonaj"),0) into used from public.order_purchase_line_assignments a join public.siparisler o on o.id=a.order_id where a.purchase_bill_id=assignment.purchase_bill_id and a.line_id=assignment.line_id and a.order_id<>old.id and o.matched_purchase_invoice_id=assignment.purchase_bill_id;
 if used+coalesce(new."teslimOlanTonaj",0)>assignment.source_tons+.000001 then raise exception 'Teslim tonajı alış kaleminin kalan miktarını aşamaz.'; end if;
 return new;
end $$;
revoke execute on function public.protect_purchase_line_delivery() from public,anon,authenticated;
create trigger protect_purchase_line_delivery before update on public.siparisler for each row execute function public.protect_purchase_line_delivery();
commit;
