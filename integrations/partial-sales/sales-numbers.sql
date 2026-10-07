begin;
create function public.sync_order_sales_number(p_order_id uuid,p_invoice_id text,p_number text) returns void language plpgsql security invoker set search_path='' as $$
declare ord public.siparisler%rowtype;
begin
 select * into ord from public.siparisler where id=p_order_id for update;
 if not found or p_number is null or trim(p_number)='' or p_number=p_invoice_id then raise exception 'Fatura numarası geçersiz.'; end if;
 if ord.sales_invoice_id is distinct from p_invoice_id and not exists(select 1 from jsonb_array_elements(ord.sales_invoice_history) h where h->>'id'=p_invoice_id) then raise exception 'Fatura bu siparişe ait değil.'; end if;
 update public.siparisler set sales_invoice_no=case when sales_invoice_id=p_invoice_id then p_number else sales_invoice_no end,sales_invoice_history=(select coalesce(jsonb_agg(case when h->>'id'=p_invoice_id then jsonb_set(h,'{invoice_no}',to_jsonb(p_number)) else h end),'[]'::jsonb) from jsonb_array_elements(sales_invoice_history) h) where id=p_order_id;
 update public.order_sales_invoice_parts set invoice_no=p_number where order_id=p_order_id and sales_invoice_id=p_invoice_id;
end $$;
revoke execute on function public.sync_order_sales_number(uuid,text,text) from public,anon,authenticated;
grant execute on function public.sync_order_sales_number(uuid,text,text) to service_role;
commit;
