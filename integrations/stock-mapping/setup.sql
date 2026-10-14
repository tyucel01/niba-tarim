begin;
-- Keep the confirmed source-to-stock mapping with its original purchase invoice.
-- The pool already has RLS and is only accessed through the authorized server.
alter table public.purchase_invoice_pool
  add column if not exists stock_line_mappings jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
commit;
