begin;
alter table public.siparisler add column if not exists sales_invoiced_tonnage numeric(18,6);
alter table public.siparisler add column if not exists sales_invoiced_total numeric(18,2);
alter table public.siparisler add column if not exists sales_invoice_history jsonb not null default '[]';
-- Existing invoices were issued for the whole order. Preserve that accounting history.
update public.siparisler set sales_invoiced_tonnage=coalesce(nullif("teslimOlanTonaj",0),"siparisTonaj",0), sales_invoiced_total=round(coalesce(nullif("bayiSatisToplam",0),"pesinSatisFiyati"*coalesce(nullif("teslimOlanTonaj",0),"siparisTonaj"),0),2), sales_invoice_history=jsonb_build_array(jsonb_build_object('id',sales_invoice_id,'invoice_no',sales_invoice_no,'tons',coalesce(nullif("teslimOlanTonaj",0),"siparisTonaj",0),'amount',coalesce(nullif("bayiSatisToplam",0),"pesinSatisFiyati"*coalesce(nullif("teslimOlanTonaj",0),"siparisTonaj"),0),'state','legacy','created_at',sales_invoice_created_at)) where sales_invoice_id is not null and sales_invoiced_tonnage is null;
update public.siparisler set sales_invoiced_tonnage=0,sales_invoiced_total=0 where sales_invoiced_tonnage is null;
create table if not exists public.order_sales_invoice_parts (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.siparisler(id),
 tons numeric(18,6) not null check(tons>0), amount numeric(18,2) not null check(amount>0),
 customer_id text not null, fingerprint text not null, sales_invoice_id text unique, invoice_no text,
 state text not null default 'creating' check(state in('creating','created','issued','needs_review','failed')),
 created_at timestamptz not null default now()
);
create index if not exists order_sales_invoice_parts_order_idx on public.order_sales_invoice_parts(order_id);
alter table public.order_sales_invoice_parts enable row level security;
revoke all on public.order_sales_invoice_parts from public,anon,authenticated;
grant select,insert,update on public.order_sales_invoice_parts to service_role;
create or replace function public.reserve_order_sales_part(p_order_id uuid,p_tons numeric,p_amount numeric,p_customer_id text,p_fingerprint text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare ord public.siparisler%rowtype; tons numeric; total numeric; remaining numeric; expected numeric; result uuid;
begin
 select * into ord from public.siparisler where id=p_order_id for update;
 if not found then raise exception 'Sipariş bulunamadı.'; end if;
 if exists(select 1 from public.order_sales_invoice_parts where order_id=p_order_id and state in('creating','created','needs_review')) then raise exception 'Önceki fatura işlemi kontrol bekliyor. Paraşüt üzerinde kontrol edin; tekrar fatura oluşturulmadı.'; end if;
 tons:=coalesce(ord."teslimOlanTonaj",0);
 total:=round(coalesce(ord."pesinSatisFiyati"*tons,0),2);
 remaining:=tons-coalesce(ord.sales_invoiced_tonnage,0);
 if p_tons is null or p_tons<=0 or p_tons<>round(p_tons,6) or p_tons>remaining or tons<=0 then raise exception 'Kesilecek tonaj kalan sipariş tonajını aşamaz.'; end if;
 expected:=case when p_tons=remaining then total-coalesce(ord.sales_invoiced_total,0) else round(total*p_tons/tons,2) end;
 if expected<=0 or p_amount is null or abs(p_amount-expected)>0.05 or p_amount>total-coalesce(ord.sales_invoiced_total,0) then raise exception 'Kesilecek fatura tutarı kalan sipariş tutarını aşamaz veya önizlemeyle uyuşmuyor.'; end if;
 insert into public.order_sales_invoice_parts(order_id,tons,amount,customer_id,fingerprint) values(p_order_id,p_tons,p_amount,p_customer_id,p_fingerprint) returning id into result;
 return result;
end $$;
create or replace function public.record_order_sales_part(p_part_id uuid,p_invoice_id text,p_invoice_no text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare part public.order_sales_invoice_parts%rowtype; ord public.siparisler%rowtype;
begin
 select * into part from public.order_sales_invoice_parts where id=p_part_id;
 if not found then raise exception 'Fatura takip kaydı bulunamadı.'; end if;
 select * into ord from public.siparisler where id=part.order_id for update;
 select * into part from public.order_sales_invoice_parts where id=p_part_id for update;
 if part.state<>'creating' then
  if part.sales_invoice_id=p_invoice_id then return to_jsonb(ord); end if;
  raise exception 'Fatura takip kaydı zaten işlendi.';
 end if;
 if p_invoice_id is null or p_invoice_id='' then raise exception 'Fatura kimliği eksik.'; end if;
 update public.order_sales_invoice_parts set state='created',sales_invoice_id=p_invoice_id,invoice_no=p_invoice_no where id=p_part_id;
 update public.siparisler set sales_invoice_id=p_invoice_id,sales_invoice_no=p_invoice_no,sales_invoice_created_at=now(),sales_invoiced_tonnage=coalesce(sales_invoiced_tonnage,0)+part.tons,sales_invoiced_total=coalesce(sales_invoiced_total,0)+part.amount,sales_invoice_history=sales_invoice_history||jsonb_build_array(jsonb_build_object('id',p_invoice_id,'invoice_no',p_invoice_no,'tons',part.tons,'amount',part.amount,'state','created','created_at',now())) where id=part.order_id returning * into ord;
 return to_jsonb(ord);
end $$;
create or replace function public.finish_order_sales_part(p_part_id uuid,p_state text) returns void
language plpgsql security invoker set search_path='' as $$
declare part public.order_sales_invoice_parts%rowtype;
begin
 select * into part from public.order_sales_invoice_parts where id=p_part_id;
 if not found or p_state not in('issued','needs_review','failed') then raise exception 'Fatura durumu geçersiz.'; end if;
 perform 1 from public.siparisler where id=part.order_id for update;
 select * into part from public.order_sales_invoice_parts where id=p_part_id for update;
 if (p_state='failed' and part.state<>'creating') or (p_state in('issued','needs_review') and part.state<>'created') then raise exception 'Fatura durum geçişi geçersiz.'; end if;
 update public.order_sales_invoice_parts set state=p_state where id=p_part_id;
 update public.siparisler set sales_invoice_history=(select coalesce(jsonb_agg(case when item->>'id'=part.sales_invoice_id then jsonb_set(item,'{state}',to_jsonb(p_state)) else item end),'[]') from jsonb_array_elements(sales_invoice_history) item) where id=part.order_id;
end $$;
revoke execute on function public.reserve_order_sales_part(uuid,numeric,numeric,text,text),public.record_order_sales_part(uuid,text,text),public.finish_order_sales_part(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_order_sales_part(uuid,numeric,numeric,text,text),public.record_order_sales_part(uuid,text,text),public.finish_order_sales_part(uuid,text) to service_role;
create table if not exists public.parasut_response_cache(cache_key text primary key,payload jsonb,expires_at timestamptz not null default now(),locked_until timestamptz not null default now());
alter table public.parasut_response_cache enable row level security;
revoke all on public.parasut_response_cache from public,anon,authenticated;
grant select,insert,update on public.parasut_response_cache to service_role;
create or replace function public.claim_parasut_cache(p_key text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 insert into public.parasut_response_cache(cache_key,locked_until) values(p_key,now()+interval '30 seconds') on conflict(cache_key) do update set locked_until=now()+interval '30 seconds' where public.parasut_response_cache.expires_at<=now() and public.parasut_response_cache.locked_until<=now();
 return found;
end $$;
revoke execute on function public.claim_parasut_cache(text) from public,anon,authenticated;
grant execute on function public.claim_parasut_cache(text) to service_role;
commit;
