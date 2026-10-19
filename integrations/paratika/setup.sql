-- Install in Niba after review. No existing order/payment is changed.
begin;
create table public.paratika_payments (
 id uuid primary key default gen_random_uuid(), idempotency_key uuid not null unique,
 merchant_payment_id text not null unique, merchant text not null, mode text not null check(mode in('test','live')),
 installment_count integer not null default 1 check(installment_count between 1 and 36), payment_system text not null default '',
 customer_id text not null, customer_name text not null, customer_email text not null, description text not null default '',
 amount_minor bigint not null check(amount_minor between 1 and 100000000000), currency text not null default 'TRY' check(currency='TRY'),
 status text not null default 'creating' check(status in('creating','ready','pending','paid','failed','review')),
 callback_hash text not null unique check(length(callback_hash)=64), session_token text,
 pg_transaction_id text unique, paid_date date, created_by uuid not null, created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '1 hour', last_checked_at timestamptz, check_note text,
 parasut_state text not null default 'not_required' check(parasut_state in('not_required','pending','posting','posted','review')),
 parasut_transaction_id text, parasut_claimed_at timestamptz, block_days integer not null default 3 check(block_days=3)
);
create index paratika_reconciliation on public.paratika_payments(last_checked_at nulls first,created_at) where status in('creating','ready','pending','review');
alter table public.paratika_payments enable row level security;
revoke all on public.paratika_payments from public,anon,authenticated;
grant select,insert,update on public.paratika_payments to service_role;
alter table public.parasut_card_transactions add column pos_payment_id uuid unique references public.paratika_payments(id);
create function public.reserve_paratika_payment(p_key uuid,p_customer text,p_name text,p_email text,p_minor bigint,p_mode text,p_merchant text,p_hash text,p_creator uuid,p_description text,p_installments integer,p_system text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare existing public.paratika_payments%rowtype; inserted boolean;
begin
 insert into public.paratika_payments(idempotency_key,merchant_payment_id,merchant,mode,customer_id,customer_name,customer_email,amount_minor,callback_hash,created_by,description,installment_count,payment_system)
 values(p_key,'NIBA-'||p_key::text,p_merchant,p_mode,p_customer,p_name,p_email,p_minor,p_hash,p_creator,p_description,p_installments,p_system)
 on conflict(idempotency_key) do nothing returning * into existing;
 inserted:=found;
 if not inserted then select * into existing from public.paratika_payments where idempotency_key=p_key for update; end if;
 if existing.customer_id is distinct from p_customer or existing.customer_name is distinct from p_name or existing.customer_email is distinct from p_email or existing.amount_minor is distinct from p_minor or existing.mode is distinct from p_mode or existing.merchant is distinct from p_merchant or existing.created_by is distinct from p_creator or existing.description is distinct from p_description or existing.installment_count is distinct from p_installments or existing.payment_system is distinct from p_system then raise exception 'Aynı işlem anahtarı farklı tahsilat bilgileriyle kullanılamaz.'; end if;
 return jsonb_build_object('created',inserted,'payment',to_jsonb(existing));
end $$;
create function public.record_paratika_check(p_id uuid,p_status text,p_transaction text,p_note text,p_paid_date date) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item public.paratika_payments%rowtype;
begin
 select * into item from public.paratika_payments where id=p_id for update;
 if not found or p_status not in('pending','paid','failed','review') then raise exception 'Ödeme sonucu geçersiz.'; end if;
 if item.status='paid' then return to_jsonb(item); end if;
 if p_status='paid' and (coalesce(p_transaction,'')='' or p_paid_date is null) then raise exception 'Banka işlem numarası gerekli.'; end if;
 update public.paratika_payments set status=p_status,paid_date=case when p_status='paid' then p_paid_date else paid_date end,pg_transaction_id=case when p_status='paid' then p_transaction else pg_transaction_id end,last_checked_at=now(),check_note=left(p_note,300),
 parasut_state=case when p_status='paid' and mode='live' then 'pending' else parasut_state end where id=p_id returning * into item;
 return to_jsonb(item);
end $$;
create function public.claim_paratika_ledger(p_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item public.paratika_payments%rowtype;
begin
 update public.paratika_payments set parasut_state='posting',parasut_claimed_at=now() where id=p_id and mode='live' and status='paid' and parasut_state='pending' returning * into item;
 if not found then return null; end if;
 return to_jsonb(item);
end $$;
create function public.finish_paratika_ledger(p_id uuid,p_transaction text) returns void
language plpgsql security invoker set search_path='' as $$
declare item public.paratika_payments%rowtype;
begin
 select * into item from public.paratika_payments where id=p_id for update;
 if not found or coalesce(p_transaction,'')='' then raise exception 'Tahsilat kaydı doğrulanamadı.'; end if;
 if item.parasut_state='posted' and item.parasut_transaction_id=p_transaction then return; end if;
 if item.status<>'paid' or item.mode<>'live' or item.parasut_state<>'posting' then raise exception 'Bu ödeme için muhasebe kaydı oluşturulamaz.'; end if;
 insert into public.parasut_card_transactions(party_type,transaction_type,parasut_contact_id,company_name,transaction_date,amount,description,payment_channel,status,parasut_transaction_id,parasut_response,pos_payment_id)
 values('customer','collection',item.customer_id,item.customer_name,item.paid_date,item.amount_minor::numeric/100,'Paratika '||item.merchant_payment_id,'Paratika Sanal POS','parasut_processed',p_transaction,jsonb_build_object('source','paratika','payment_id',item.merchant_payment_id),item.id);
 update public.paratika_payments set parasut_state='posted',parasut_transaction_id=p_transaction where id=p_id;
end $$;
revoke execute on function public.reserve_paratika_payment(uuid,text,text,text,bigint,text,text,text,uuid,text,integer,text),public.record_paratika_check(uuid,text,text,text,date),public.claim_paratika_ledger(uuid),public.finish_paratika_ledger(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_paratika_payment(uuid,text,text,text,bigint,text,text,text,uuid,text,integer,text),public.record_paratika_check(uuid,text,text,text,date),public.claim_paratika_ledger(uuid),public.finish_paratika_ledger(uuid,text) to service_role;
commit;
