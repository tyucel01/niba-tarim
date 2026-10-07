begin;
create or replace function public.purchase_delivery_allocation(ord public.siparisler) returns numeric language sql stable security invoker set search_path='' as $$
 select case when coalesce(ord."teslimOlanTonaj",0)<=0 or (ord.sales_invoice_id is not null and (jsonb_array_length(ord.sales_invoice_history)=0 or exists(select 1 from jsonb_array_elements(ord.sales_invoice_history) h where h->>'state'='legacy'))) then coalesce(ord.matched_purchase_allocated_amount,ord.matched_purchase_invoice_total,0) else round(coalesce(ord."alisFiyati",0)*ord."teslimOlanTonaj",2) end;
$$;
revoke execute on function public.purchase_delivery_allocation(public.siparisler) from public,anon,authenticated;
grant execute on function public.purchase_delivery_allocation(public.siparisler) to service_role;
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
 select coalesce(sum(public.purchase_delivery_allocation(s)),0) into used
 from public.siparisler s where matched_purchase_invoice_id=bill.purchase_bill_id;
 if bill.total is null or amount > bill.total-used then raise exception 'Faturanın kalan tutarı sipariş için yetersiz.'; end if;
 update public.siparisler set matched_purchase_invoice_id=bill.purchase_bill_id,
 matched_purchase_invoice_no=bill.invoice_no, matched_purchase_invoice_total=bill.total,
 matched_purchase_allocated_amount=amount, matched_purchase_invoice_at=now(), "gelenFatura"=bill.invoice_no
 where id=p_order_id returning * into ord;
 return jsonb_build_object('order',to_jsonb(ord),'allocatedAmount',amount,'remainingAmount',bill.total-used-amount);
end;
$$;
create or replace function public.reserve_order_sales_part(p_order_id uuid,p_tons numeric,p_amount numeric,p_customer_id text,p_fingerprint text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare ord public.siparisler%rowtype; tons numeric; total numeric; remaining numeric; expected numeric; result uuid; bill public.purchase_invoice_pool%rowtype; used numeric; invoice_id text;
begin
 select matched_purchase_invoice_id into invoice_id from public.siparisler where id=p_order_id;
 select * into bill from public.purchase_invoice_pool where purchase_bill_id=invoice_id for update;
 if not found then raise exception 'Alış faturası takip kaydı bulunamadı.'; end if;
 select * into ord from public.siparisler where id=p_order_id for update;
 if not found then raise exception 'Sipariş bulunamadı.'; end if;
 if exists(select 1 from public.order_sales_invoice_parts where order_id=p_order_id and state in('creating','created','needs_review')) then raise exception 'Önceki fatura işlemi kontrol bekliyor. Paraşüt üzerinde kontrol edin; tekrar fatura oluşturulmadı.'; end if;
 tons:=coalesce(ord."teslimOlanTonaj",0);
 total:=round(coalesce(ord."pesinSatisFiyati"*tons,0),2);
 if ord.matched_purchase_invoice_id is distinct from bill.purchase_bill_id then raise exception 'Alış faturası eşleşmesi değişti. Önizlemeyi yenileyin.'; end if;
 select coalesce(sum(public.purchase_delivery_allocation(o)),0) into used from public.siparisler o where matched_purchase_invoice_id=bill.purchase_bill_id;
 if used>bill.total or public.purchase_delivery_allocation(ord)<=0 then raise exception 'Toplu alış faturasının tutarı teslim edilen siparişleri karşılamıyor. Alış faturası eşleşmelerini kontrol edin.'; end if;
 remaining:=tons-coalesce(ord.sales_invoiced_tonnage,0);
 if p_tons is null or p_tons<=0 or p_tons<>round(p_tons,6) or p_tons>remaining or tons<=0 then raise exception 'Kesilecek tonaj kalan sipariş tonajını aşamaz.'; end if;
 expected:=case when p_tons=remaining then total-coalesce(ord.sales_invoiced_total,0) else round(total*p_tons/tons,2) end;
 if expected<=0 or p_amount is null or abs(p_amount-expected)>0.05 or p_amount>total-coalesce(ord.sales_invoiced_total,0) then raise exception 'Kesilecek fatura tutarı kalan sipariş tutarını aşamaz veya önizlemeyle uyuşmuyor.'; end if;
 insert into public.order_sales_invoice_parts(order_id,tons,amount,customer_id,fingerprint) values(p_order_id,p_tons,p_amount,p_customer_id,p_fingerprint) returning id into result;
 return result;
end $$;

create or replace function public.protect_invoiced_delivery() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new."teslimOlanTonaj" is distinct from old."teslimOlanTonaj" or new."pesinSatisFiyati" is distinct from old."pesinSatisFiyati" or new."alisFiyati" is distinct from old."alisFiyati" then
  if exists(select 1 from public.order_sales_invoice_parts where order_id=old.id and state in('creating','created','needs_review')) then raise exception 'Devam eden fatura işlemi varken tonaj ve fiyat değiştirilemez.'; end if;
  if coalesce(old.sales_invoiced_tonnage,0)>coalesce(new."teslimOlanTonaj",0) or coalesce(old.sales_invoiced_total,0)>round(coalesce(new."teslimOlanTonaj",0)*coalesce(new."pesinSatisFiyati",0),2)+0.05 then raise exception 'Teslim tonajı veya satış tutarı kesilmiş faturalardan düşük olamaz.'; end if;
 end if;
 return new;
end $$;
revoke execute on function public.protect_invoiced_delivery() from public,anon,authenticated;
drop trigger if exists protect_invoiced_delivery on public.siparisler;
create trigger protect_invoiced_delivery before update on public.siparisler for each row execute function public.protect_invoiced_delivery();
commit;
