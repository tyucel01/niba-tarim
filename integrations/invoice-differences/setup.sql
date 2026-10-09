begin;
alter table public.siparisler add column if not exists purchase_difference_mode text;
alter table public.siparisler add column if not exists purchase_difference_amount numeric(18,2);
alter table public.siparisler add column if not exists purchase_difference_expected numeric(18,2);
alter table public.siparisler add column if not exists purchase_difference_confirmed_at timestamptz;
alter table public.siparisler add column if not exists purchase_refund_id text;
alter table public.siparisler add column if not exists purchase_refund_state text;
alter table public.siparisler add column if not exists purchase_refund_at timestamptz;

create or replace function public.purchase_delivery_allocation(ord public.siparisler) returns numeric language sql stable security invoker set search_path='' as $$
 select case when ord.purchase_difference_mode in ('accept','refund') then coalesce(ord.matched_purchase_allocated_amount,0)
 when coalesce(ord."teslimOlanTonaj",0)<=0 or (ord.sales_invoice_id is not null and (jsonb_array_length(ord.sales_invoice_history)=0 or exists(select 1 from jsonb_array_elements(ord.sales_invoice_history) h where h->>'state'='legacy'))) then coalesce(ord.matched_purchase_allocated_amount,ord.matched_purchase_invoice_total,0)
 else round(coalesce(ord."alisFiyati",0)*ord."teslimOlanTonaj",2) end;
$$;

create or replace function public.allocate_purchase_invoice_difference(p_order_id uuid,p_e_invoice_id text,p_mode text,p_confirmed_available numeric,p_confirmed_expected numeric) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare bill public.purchase_invoice_pool%rowtype; ord public.siparisler%rowtype; used numeric; amount numeric; available numeric; difference numeric; expected numeric;
begin
 if p_mode is null or p_mode not in ('keep','accept','refund') then raise exception 'Fark işlemi geçersiz.'; end if;
 select * into bill from public.purchase_invoice_pool where e_invoice_id=p_e_invoice_id for update;
 if not found or bill.state <> 'ready' then raise exception 'Fatura kaydı hazır değil.'; end if;
 select * into ord from public.siparisler where id=p_order_id for update;
 if not found then raise exception 'Sipariş bulunamadı.'; end if;
 if ord.matched_purchase_invoice_id is not null then raise exception 'Sipariş zaten bir faturaya bağlı.'; end if;
 if bill.currency not in ('TRY','TRL') then raise exception 'Döviz faturası otomatik paylaştırılamaz.'; end if;
 expected:=round(coalesce(ord."alisFiyati"*ord."teslimOlanTonaj",0),2);
 select coalesce(sum(public.purchase_delivery_allocation(s)+case when s.purchase_difference_mode='refund' then coalesce(s.purchase_difference_amount,0) else 0 end),0) into used from public.siparisler s where matched_purchase_invoice_id=bill.purchase_bill_id;
 available:=round(bill.total-used,2); difference:=available-expected;
 if expected<=0 or available is null or available<=0 then raise exception 'Fatura veya sipariş tutarı geçersiz.'; end if;
 if p_confirmed_available is null or p_confirmed_expected is null or round(p_confirmed_available,2)<>available or round(p_confirmed_expected,2)<>expected then raise exception 'Fatura bakiyesi veya sipariş tutarı değişti. Listeyi yenileyip tekrar onaylayın.'; end if;
 if p_mode='keep' and difference<0 then raise exception 'Eksik tutarı kabul etmek için fark onayı gerekiyor.'; end if;
 if p_mode='refund' and difference<=0 then raise exception 'İade için pozitif fatura farkı gerekiyor.'; end if;
 amount:=case when p_mode='accept' then available else expected end;
 update public.siparisler set matched_purchase_invoice_id=bill.purchase_bill_id,matched_purchase_invoice_no=bill.invoice_no,matched_purchase_invoice_total=bill.total,
 matched_purchase_allocated_amount=amount,matched_purchase_invoice_at=now(),"gelenFatura"=bill.invoice_no,
 purchase_difference_mode=p_mode,purchase_difference_amount=difference,purchase_difference_expected=expected,purchase_difference_confirmed_at=now(),
 purchase_refund_state=case when p_mode='refund' then 'pending' else null end
 where id=p_order_id returning * into ord;
 return jsonb_build_object('order',to_jsonb(ord),'allocatedAmount',amount,'remainingAmount',case when p_mode in ('accept','refund') then 0 else difference end,'differenceAmount',difference);
end $$;
revoke execute on function public.allocate_purchase_invoice_difference(uuid,text,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.allocate_purchase_invoice_difference(uuid,text,text,numeric,numeric) to service_role;

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
 amount := round(coalesce(ord."alisFiyati"*ord."teslimOlanTonaj",0),2);
 if amount is null or amount <= 0 then raise exception 'Sipariş alış tutarı geçersiz.'; end if;
 select coalesce(sum(public.purchase_delivery_allocation(s)+case when s.purchase_difference_mode='refund' then coalesce(s.purchase_difference_amount,0) else 0 end),0) into used
 from public.siparisler s where matched_purchase_invoice_id=bill.purchase_bill_id;
 if bill.total is null or amount > bill.total-used then raise exception 'Faturanın kalan tutarı sipariş için yetersiz.'; end if;
 update public.siparisler set matched_purchase_invoice_id=bill.purchase_bill_id,
 matched_purchase_invoice_no=bill.invoice_no, matched_purchase_invoice_total=bill.total,
 matched_purchase_allocated_amount=amount, matched_purchase_invoice_at=now(), "gelenFatura"=bill.invoice_no
 where id=p_order_id returning * into ord;
 return jsonb_build_object('order',to_jsonb(ord),'allocatedAmount',amount,'remainingAmount',bill.total-used-amount);
end;
$$;

-- Protect the approved amounts and pending refunds from later delivery/price edits.
create or replace function public.protect_purchase_difference() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.purchase_difference_mode in ('accept','refund') and
 (new."alisFiyati" is distinct from old."alisFiyati" or new."teslimOlanTonaj" is distinct from old."teslimOlanTonaj" or new.matched_purchase_invoice_id is distinct from old.matched_purchase_invoice_id) then
 raise exception 'Onaylanmış fatura farkı bulunan siparişin alış fiyatı, teslim tonajı veya alış faturası değiştirilemez.';
 end if;
 return new;
end $$;
revoke execute on function public.protect_purchase_difference() from public,anon,authenticated;
drop trigger if exists protect_purchase_difference on public.siparisler;
create trigger protect_purchase_difference before update on public.siparisler for each row execute function public.protect_purchase_difference();
create or replace function public.reserve_purchase_difference_refund(p_order_id uuid,p_amount numeric) returns void
language plpgsql security invoker set search_path='' as $$
declare ord public.siparisler%rowtype; bill_id text;
begin
 select matched_purchase_invoice_id into bill_id from public.siparisler where id=p_order_id;
 perform 1 from public.purchase_invoice_pool where purchase_bill_id=bill_id for update;
 select * into ord from public.siparisler where id=p_order_id for update;
 if not found or coalesce(ord.purchase_difference_mode,'') not in ('accept','refund') or coalesce(ord.purchase_difference_amount,0)<=0 or p_amount is null or p_amount<>ord.purchase_difference_amount then raise exception 'İade edilecek fark değişmiş veya geçersiz.'; end if;
 if ord.purchase_refund_id is not null or coalesce(ord.purchase_refund_state,'pending')<>'pending' then raise exception 'Önceki iade işlemi kontrol bekliyor veya tamamlandı. Tekrar oluşturulmadı.'; end if;
 update public.siparisler set purchase_difference_mode='refund',matched_purchase_allocated_amount=purchase_difference_expected,purchase_refund_state='creating' where id=p_order_id;
end $$;
revoke execute on function public.reserve_purchase_difference_refund(uuid,numeric) from public,anon,authenticated;
grant execute on function public.reserve_purchase_difference_refund(uuid,numeric) to service_role;
commit;
