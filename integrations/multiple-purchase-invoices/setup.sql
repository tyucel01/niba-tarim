begin;
alter table public.siparisler add column if not exists purchase_invoice_matches jsonb not null default '[]'::jsonb;
alter table public.siparisler add column if not exists purchase_difference_invoice_id text;

-- No backfill overwrites historical matches. Materialize the old match only on append.
create or replace function public.purchase_matches(ord public.siparisler) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when jsonb_array_length(ord.purchase_invoice_matches)>0 then ord.purchase_invoice_matches
 when ord.matched_purchase_invoice_id is null then '[]'::jsonb
 else jsonb_build_array(jsonb_build_object('purchaseBillId',ord.matched_purchase_invoice_id,'invoiceNo',ord.matched_purchase_invoice_no,'total',ord.matched_purchase_invoice_total,
 'allocatedAmount',public.purchase_delivery_allocation(ord),'differenceMode',ord.purchase_difference_mode,'differenceAmount',ord.purchase_difference_amount,
 'refundAmount',case when ord.purchase_difference_mode='refund' then greatest(coalesce(ord.purchase_difference_amount,0),0) else 0 end,
 'refundId',ord.purchase_refund_id,'refundState',ord.purchase_refund_state,'refundIssueState',ord.purchase_refund_issue_state)) end;
$$;

create or replace function public.allocate_purchase_invoice_difference(p_order_id uuid,p_e_invoice_id text,p_mode text,p_confirmed_available numeric,p_confirmed_expected numeric) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare bill public.purchase_invoice_pool%rowtype; ord public.siparisler%rowtype; used numeric; amount numeric; available numeric; difference numeric; expected numeric; previous_amount numeric; matches jsonb;
begin
 if p_mode is null or p_mode not in ('keep','accept','refund') then raise exception 'Fark işlemi geçersiz.'; end if;
 select * into bill from public.purchase_invoice_pool where e_invoice_id=p_e_invoice_id for update;
 if not found or bill.state <> 'ready' then raise exception 'Fatura kaydı hazır değil.'; end if;
 select * into ord from public.siparisler where id=p_order_id for update;
 if not found then raise exception 'Sipariş bulunamadı.'; end if;
 matches:=public.purchase_matches(ord);
 if exists(select 1 from jsonb_array_elements(matches) m where m->>'purchaseBillId'=bill.purchase_bill_id or m->>'eInvoiceId'=p_e_invoice_id) then raise exception 'Bu fatura zaten bu satışa bağlı. Tekrar eklenmedi.'; end if;
 if (ord.purchase_difference_mode='refund' or ord.purchase_refund_id is not null) and coalesce(ord.purchase_difference_amount,0)>0 and ord.purchase_refund_issue_state is distinct from 'submitted' then raise exception 'Önceki faturanın iade işlemi tamamlanmadan yeni fatura bağlanamaz.'; end if;
 if bill.currency not in ('TRY','TRL') then raise exception 'Döviz faturası otomatik paylaştırılamaz.'; end if;
 if coalesce(ord."alisFiyati",0)<=0 or coalesce(ord."teslimOlanTonaj",0)<=0 then raise exception 'Teslim olan tonaj ve alış fiyatı girilmeden alış faturası eşleştirilemez.'; end if;
 select coalesce(sum((m->>'allocatedAmount')::numeric),0) into previous_amount from jsonb_array_elements(matches) m;
 expected:=greatest(0,round(ord."alisFiyati"*ord."teslimOlanTonaj"-previous_amount,2));
 select coalesce(sum((m->>'allocatedAmount')::numeric+coalesce((m->>'refundAmount')::numeric,0)),0) into used
 from public.siparisler s cross join lateral jsonb_array_elements(public.purchase_matches(s)) m where m->>'purchaseBillId'=bill.purchase_bill_id;
 available:=round(bill.total-used,2); difference:=available-expected;
 if available is null or available<=0 then raise exception 'Faturanın kullanılabilir tutarı kalmadı.'; end if;
 if p_confirmed_available is null or p_confirmed_expected is null or round(p_confirmed_available,2)<>available or round(p_confirmed_expected,2)<>expected then raise exception 'Fatura bakiyesi veya siparişin kalan alış tutarı değişti. Listeyi yenileyip tekrar onaylayın.'; end if;
 if p_mode='keep' and difference<0 then raise exception 'Eksik tutarı kabul etmek için fark onayı gerekiyor.'; end if;
 if p_mode='keep' and expected=0 then raise exception 'Satışın alış tutarı zaten karşılanmış. Fazla tutarı kabul edin veya iade için ayırın.'; end if;
 if p_mode='refund' and difference<=0 then raise exception 'İade için pozitif fatura farkı gerekiyor.'; end if;
 amount:=case when p_mode='accept' then available else expected end;
 matches:=matches||jsonb_build_array(jsonb_build_object('eInvoiceId',p_e_invoice_id,'purchaseBillId',bill.purchase_bill_id,'invoiceNo',bill.invoice_no,'total',bill.total,
 'allocatedAmount',amount,'differenceMode',p_mode,'differenceAmount',difference,'refundAmount',case when p_mode='refund' then difference else 0 end,'matchedAt',now()));
 update public.siparisler set purchase_invoice_matches=case when matched_purchase_invoice_id is null then '[]'::jsonb else matches end,
 matched_purchase_invoice_id=coalesce(matched_purchase_invoice_id,bill.purchase_bill_id),matched_purchase_invoice_no=coalesce(matched_purchase_invoice_no,bill.invoice_no),
 matched_purchase_invoice_total=coalesce(matched_purchase_invoice_total,bill.total),matched_purchase_allocated_amount=previous_amount+amount,matched_purchase_invoice_at=coalesce(matched_purchase_invoice_at,now()),
 "gelenFatura"=(select string_agg(m->>'invoiceNo',', ') from jsonb_array_elements(matches) m),
 purchase_difference_invoice_id=bill.purchase_bill_id,purchase_difference_mode=p_mode,purchase_difference_amount=difference,purchase_difference_expected=expected,purchase_difference_confirmed_at=now(),
 purchase_refund_state=case when p_mode='refund' then 'pending' else null end,purchase_refund_id=null,purchase_refund_at=null,purchase_refund_source=null,purchase_refund_issue_state=null
 where id=p_order_id returning * into ord;
 return jsonb_build_object('order',to_jsonb(ord),'allocatedAmount',amount,'remainingAmount',case when p_mode in ('accept','refund') then 0 else difference end,'differenceAmount',difference);
end $$;

create or replace function public.purchase_delivery_allocation(ord public.siparisler) returns numeric language sql stable security invoker set search_path='' as $$
 select case when jsonb_array_length(ord.purchase_invoice_matches)>0 then (select coalesce(sum((m->>'allocatedAmount')::numeric),0) from jsonb_array_elements(ord.purchase_invoice_matches) m)
 when ord.purchase_difference_mode in ('accept','refund') then coalesce(ord.matched_purchase_allocated_amount,0)
 when coalesce(ord."teslimOlanTonaj",0)<=0 or (ord.sales_invoice_id is not null and (jsonb_array_length(ord.sales_invoice_history)=0 or exists(select 1 from jsonb_array_elements(ord.sales_invoice_history) h where h->>'state'='legacy'))) then coalesce(ord.matched_purchase_allocated_amount,ord.matched_purchase_invoice_total,0)
 else round(coalesce(ord."alisFiyati",0)*ord."teslimOlanTonaj",2) end;
$$;

create or replace function public.allocate_purchase_invoice(p_order_id uuid,p_e_invoice_id text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare bill public.purchase_invoice_pool%rowtype; ord public.siparisler%rowtype; used numeric; expected numeric;
begin
 select * into bill from public.purchase_invoice_pool where e_invoice_id=p_e_invoice_id for update;
 if not found or bill.state<>'ready' then raise exception 'Fatura kaydı hazır değil.'; end if;
 select * into ord from public.siparisler where id=p_order_id for update;
 if not found then raise exception 'Sipariş bulunamadı.'; end if;
 if ord.matched_purchase_invoice_id is not null then raise exception 'Ek faturayı siparişin Fatura adımında fark onayıyla bağlayın.'; end if;
 expected:=round(coalesce(ord."alisFiyati"*ord."teslimOlanTonaj",0),2);
 select coalesce(sum((m->>'allocatedAmount')::numeric+coalesce((m->>'refundAmount')::numeric,0)),0) into used from public.siparisler o cross join lateral jsonb_array_elements(public.purchase_matches(o)) m where m->>'purchaseBillId'=bill.purchase_bill_id;
 return public.allocate_purchase_invoice_difference(p_order_id,p_e_invoice_id,'keep',bill.total-used,expected);
end $$;

-- Refunds update only the invoice that caused the current difference.
create or replace function public.sync_purchase_match_refund() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_array_length(new.purchase_invoice_matches)=0 or new.purchase_difference_invoice_id is null then return new; end if;
 if new.purchase_refund_state is distinct from old.purchase_refund_state or new.purchase_refund_id is distinct from old.purchase_refund_id or new.purchase_refund_issue_state is distinct from old.purchase_refund_issue_state then
 new.purchase_invoice_matches:=(select jsonb_agg(case when m->>'purchaseBillId'=new.purchase_difference_invoice_id then m||jsonb_build_object(
 'refundId',new.purchase_refund_id,'refundState',new.purchase_refund_state,'refundIssueState',new.purchase_refund_issue_state,
 'refundAmount',case when new.purchase_difference_mode='refund' then greatest(new.purchase_difference_amount,0) else 0 end,
 'allocatedAmount',case when new.purchase_difference_mode='refund' then new.purchase_difference_expected else (m->>'allocatedAmount')::numeric end) else m end order by n)
 from jsonb_array_elements(new.purchase_invoice_matches) with ordinality x(m,n));
 new.matched_purchase_allocated_amount:=(select sum((m->>'allocatedAmount')::numeric) from jsonb_array_elements(new.purchase_invoice_matches) m);
 end if;
 return new;
end $$;
drop trigger if exists sync_purchase_match_refund on public.siparisler;
create trigger sync_purchase_match_refund before update on public.siparisler for each row execute function public.sync_purchase_match_refund();

create or replace function public.reserve_purchase_difference_refund(p_order_id uuid,p_amount numeric) returns void
language plpgsql security invoker set search_path='' as $$
declare ord public.siparisler%rowtype; bill_id text;
begin
 select coalesce(purchase_difference_invoice_id,matched_purchase_invoice_id) into bill_id from public.siparisler where id=p_order_id;
 perform 1 from public.purchase_invoice_pool where purchase_bill_id=bill_id for update;
 select * into ord from public.siparisler where id=p_order_id for update;
 if not found or coalesce(ord.purchase_difference_mode,'') not in ('accept','refund') or coalesce(ord.purchase_difference_amount,0)<=0 or p_amount is null or p_amount<>ord.purchase_difference_amount then raise exception 'İade edilecek fark değişmiş veya geçersiz.'; end if;
 if ord.purchase_refund_id is not null or coalesce(ord.purchase_refund_state,'pending')<>'pending' then raise exception 'Önceki iade işlemi kontrol bekliyor veya tamamlandı. Tekrar oluşturulmadı.'; end if;
 update public.siparisler set purchase_difference_mode='refund',matched_purchase_allocated_amount=case when jsonb_array_length(purchase_invoice_matches)>0 then matched_purchase_allocated_amount-p_amount else purchase_difference_expected end,purchase_refund_state='creating' where id=p_order_id;
end $$;

-- Freeze confirmed multi-invoice allocations just like approved differences.
create or replace function public.protect_purchase_difference() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (old.purchase_difference_mode in ('accept','refund') or jsonb_array_length(old.purchase_invoice_matches)>1) and
 (new."alisFiyati" is distinct from old."alisFiyati" or new."teslimOlanTonaj" is distinct from old."teslimOlanTonaj" or new.matched_purchase_invoice_id is distinct from old.matched_purchase_invoice_id) then
 raise exception 'Onaylanmış fatura eşleşmesi bulunan siparişin alış fiyatı, teslim tonajı veya alış faturası değiştirilemez.';
 end if;
 return new;
end $$;

revoke execute on function public.purchase_matches(public.siparisler),public.sync_purchase_match_refund() from public,anon,authenticated;
grant execute on function public.purchase_matches(public.siparisler) to service_role;
-- Existing allocator/refund functions retain their service_role-only permissions.
commit;
