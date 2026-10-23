begin;
set local lock_timeout='10s';
set local statement_timeout='60s';
-- Remove only the invoice-count restriction. Preserve all source/history/quantity checks.
do $$
declare definition text; signature regprocedure;
begin
 signature:=to_regprocedure('public.reserve_order_sales_lines_part(uuid,numeric,numeric,text,text,jsonb)');
 if signature is null then raise exception 'Gerekli fatura fonksiyonu bulunamadi. Islem uygulanmadi.'; end if;
 definition:=pg_get_functiondef(signature);
 if strpos(definition,'jsonb_array_length(initial_matches)<2 or ')>0 then
  execute replace(definition,'jsonb_array_length(initial_matches)<2 or ','');
 elsif strpos(definition,'if abs(tracked_billed-ord.sales_invoiced_tonnage)')=0 then
  raise exception 'Fonksiyon beklenen surumde degil. Islem uygulanmadi.';
 end if;
end $$;
notify pgrst, 'reload schema';
commit;
select 'Ayni faturanin kalan kaleminden secim guncellendi.' as sonuc;
