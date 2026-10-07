begin;
alter table public.siparisler add column if not exists matched_purchase_allocated_amount numeric(18,2);
create table if not exists public.purchase_invoice_pool (
  e_invoice_id text primary key,
  purchase_bill_id text unique,
  invoice_no text,
  supplier_id text not null,
  supplier_name text,
  supplier_tax_no text,
  total numeric(18,2),
  currency text not null default 'TRL',
  issue_date date,
  state text not null default 'importing' check (state in ('importing','ready','failed')),
  created_at timestamptz not null default now()
);
alter table public.purchase_invoice_pool enable row level security;
revoke all on public.purchase_invoice_pool from public, anon, authenticated;
grant select,insert,update on public.purchase_invoice_pool to service_role;
-- Historical sales used the whole source bill; do not release any of that bill again.
update public.siparisler set matched_purchase_allocated_amount = case
 when sales_invoice_id is not null then matched_purchase_invoice_total
 else least(matched_purchase_invoice_total, coalesce(nullif("tedarikciyeOdenecekTutar",0), "alisFiyati" * "siparisTonaj",matched_purchase_invoice_total)) end
where matched_purchase_invoice_id is not null and matched_purchase_allocated_amount is null and matched_purchase_invoice_total > 0;
create or replace function public.allocate_purchase_invoice(p_order_id uuid,p_e_invoice_id text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 bill public.purchase_invoice_pool%rowtype;
 ord public.siparisler%rowtype;
 used numeric;
 amount numeric;
begin
 select * into bill from public.purchase_invoice_pool where e_invoice_id=p_e_invoice_id for update;
 if not found or bill.state <> 'ready' then raise exception 'Fatura kaydı hazır değil.'; end if;
 select * into ord from public.siparisler where id=p_order_id for update;
 if not found then raise exception 'Sipariş bulunamadı.'; end if;
 if ord.matched_purchase_invoice_id is not null then raise exception 'Sipariş zaten bir faturaya bağlı.'; end if;
 if bill.currency not in ('TRY','TRL') then raise exception 'Döviz faturası otomatik paylaştırılamaz.'; end if;
 amount := round(coalesce(nullif(ord."tedarikciyeOdenecekTutar",0),ord."alisFiyati"*ord."siparisTonaj"),2);
 if amount is null or amount <= 0 then raise exception 'Sipariş alış tutarı geçersiz.'; end if;
 select coalesce(sum(coalesce(matched_purchase_allocated_amount,matched_purchase_invoice_total)),0) into used
 from public.siparisler where matched_purchase_invoice_id=bill.purchase_bill_id;
 if bill.total is null or amount > bill.total-used then raise exception 'Faturanın kalan tutarı sipariş için yetersiz.'; end if;
 update public.siparisler set matched_purchase_invoice_id=bill.purchase_bill_id,
 matched_purchase_invoice_no=bill.invoice_no, matched_purchase_invoice_total=bill.total,
 matched_purchase_allocated_amount=amount, matched_purchase_invoice_at=now(), "gelenFatura"=bill.invoice_no
 where id=p_order_id returning * into ord;
 return jsonb_build_object('order',to_jsonb(ord),'allocatedAmount',amount,'remainingAmount',bill.total-used-amount);
end;
$$;
revoke execute on function public.allocate_purchase_invoice(uuid,text) from public,anon,authenticated;
grant execute on function public.allocate_purchase_invoice(uuid,text) to service_role;
commit;
