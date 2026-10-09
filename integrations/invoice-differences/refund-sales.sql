begin;
alter table public.siparisler add column if not exists purchase_refund_source jsonb;
alter table public.siparisler add column if not exists purchase_refund_issue_state text;
commit;
