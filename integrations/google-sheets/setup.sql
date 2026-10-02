-- Niba Tarım project: yurhfnikfxkkywogpopw. Contains no secrets.
-- Review and install once before enabling SHEETS_SYNC_ENABLED. No existing order is changed here.
begin;
create schema if not exists order_sync;
revoke all on schema order_sync from public, anon, authenticated;
grant usage on schema order_sync to service_role;
create table if not exists order_sync.sources (
  source text not null,
  external_key text not null,
  order_id uuid not null,
  snapshot_at timestamptz not null,
  last_values jsonb not null,
  primary key (source, external_key)
);
alter table order_sync.sources enable row level security;
revoke all on order_sync.sources from public, anon, authenticated;
grant select, insert, update on order_sync.sources to service_role;

create or replace function public.sync_order_from_sheet(
  p_source text, p_key text, p_values jsonb, p_snapshot timestamptz, p_dry_run boolean default true
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  old_row public.siparisler%rowtype;
  next_row public.siparisler%rowtype;
  state order_sync.sources%rowtype;
  row_count integer;
  k text;
  allowed text[] := ARRAY['satisId','satisTarihi','bayi','tedarikciler','siparisAlan','urun','marka','alisFiyati','pesinSatisFiyati','siparisTonaj','teslimOlanTonaj','satisTuru','vadeTarihi','vadeFarki','vadeSuresi','not','nakliye','plaka','sevkYeri','sevkDurumu','sevkNo','gts'];
  dispatch text[] := ARRAY['plaka','sevkYeri','sevkDurumu','sevkNo','gts','teslimOlanTonaj'];
  values_to_save jsonb;
  result_status text;
  protected boolean;
begin
  if p_source is null or length(p_source) not between 1 and 200 or p_key is null or length(p_key) not between 1 and 100
    or p_snapshot is null or p_dry_run is null or jsonb_typeof(p_values) is distinct from 'object'
    or p_values->>'satisId' is distinct from p_key then
    return jsonb_build_object('status','invalid','message','Kaynak veya Satış ID geçersiz.');
  end if;
  for k in select jsonb_object_keys(p_values) loop
    if not (k = any(allowed)) or p_values->k = 'null'::jsonb then
      return jsonb_build_object('status','invalid','message','İzin verilmeyen veya boş alan.');
    end if;
  end loop;
  -- Serialize sync retries; acquire a row lock as well against concurrent panel updates.
  perform pg_advisory_xact_lock(hashtextextended('niba-sheet-order:' || p_key, 0));
  select * into state from order_sync.sources where source=p_source and external_key=p_key for update;
  if found and p_snapshot <= state.snapshot_at then
    return jsonb_build_object('status',case when p_snapshot=state.snapshot_at and p_values <@ state.last_values then 'unchanged' else 'stale' end,
      'message','Bu sürüm daha önce işlendi veya daha yeni veri mevcut.');
  end if;
  select count(*) into row_count from public.siparisler where "satisId"=p_key;
  if row_count > 1 then return jsonb_build_object('status','conflict','message','Panelde aynı Satış ID birden fazla kez var.'); end if;
  if state.order_id is not null and (row_count=0 or not exists(select 1 from public.siparisler where id=state.order_id and "satisId"=p_key)) then
    return jsonb_build_object('status','conflict','message','Eşleşen sipariş silinmiş veya numarası değiştirilmiş.');
  end if;
  if row_count=1 then
    select * into old_row from public.siparisler where "satisId"=p_key for update;
    protected := coalesce(old_row.sales_invoice_id,'')<>'' or coalesce(old_row.sales_invoice_no,'')<>'' or lower(coalesce(old_row.fatura,''))='kesildi';
    for k in select jsonb_object_keys(p_values) loop
      if protected and not (k=any(dispatch)) and p_values->k is distinct from to_jsonb(old_row)->k then
        return jsonb_build_object('status','review','message','Faturalı siparişin ticari bilgileri farklı. Otomatik değiştirilmedi.');
      end if;
      if state.last_values ? k and to_jsonb(old_row)->k is distinct from state.last_values->k and p_values->k is distinct from to_jsonb(old_row)->k then
        return jsonb_build_object('status','conflict','message','Panelde ayrıca değiştirilen alan var; kontrol gerekli.');
      end if;
    end loop;
    values_to_save := to_jsonb(old_row) || p_values;
    result_status := 'updated';
    if p_values <@ to_jsonb(old_row) then result_status := 'unchanged'; end if;
  else
    if coalesce(p_values->>'bayi','')='' or coalesce(p_values->>'urun','')='' or coalesce((p_values->>'siparisTonaj')::numeric,0)<=0 or coalesce((p_values->>'pesinSatisFiyati')::numeric,0)<=0 then
      return jsonb_build_object('status','invalid','message','Yeni siparişte bayi, ürün, pozitif tonaj ve satış fiyatı zorunlu.');
    end if;
    values_to_save := jsonb_build_object('sevkDurumu','Bekliyor','gts','Yok','gelenFatura','Bekliyor','fatura','Kesilecek') || p_values;
    result_status := 'inserted';
  end if;
  next_row := jsonb_populate_record(null::public.siparisler, values_to_save);
  -- Recalculate only when commercial inputs change, preserving existing invoice-era totals.
  if not coalesce(protected,false) and (row_count=0 or p_values ?| ARRAY['siparisTonaj','pesinSatisFiyati','alisFiyati']) then
    next_row."bayiSatisToplam" := coalesce(next_row."siparisTonaj",0)*coalesce(next_row."pesinSatisFiyati",0);
    next_row."tedarikciyeOdenecekTutar" := coalesce(next_row."siparisTonaj",0)*coalesce(next_row."alisFiyati",0);
  end if;
  if p_dry_run then return jsonb_build_object('status',result_status,'message','Deneme: hiçbir kayıt değiştirilmedi.'); end if;
  if row_count=0 then
    insert into public.siparisler ("satisId","satisTarihi","bayi","tedarikciler","siparisAlan","urun","marka","alisFiyati","pesinSatisFiyati","siparisTonaj","teslimOlanTonaj","satisTuru","vadeTarihi","vadeFarki","vadeSuresi","not","nakliye","plaka","sevkYeri","sevkDurumu","sevkNo","gts","bayiSatisToplam","tedarikciyeOdenecekTutar","gelenFatura","fatura") values (next_row."satisId",next_row."satisTarihi",next_row."bayi",next_row."tedarikciler",next_row."siparisAlan",next_row."urun",next_row."marka",next_row."alisFiyati",next_row."pesinSatisFiyati",next_row."siparisTonaj",next_row."teslimOlanTonaj",next_row."satisTuru",next_row."vadeTarihi",next_row."vadeFarki",next_row."vadeSuresi",next_row."not",next_row."nakliye",next_row."plaka",next_row."sevkYeri",next_row."sevkDurumu",next_row."sevkNo",next_row."gts",next_row."bayiSatisToplam",next_row."tedarikciyeOdenecekTutar",next_row."gelenFatura",next_row.fatura) returning * into old_row;
  elsif result_status<>'unchanged' then
    update public.siparisler set "satisTarihi"=next_row."satisTarihi","bayi"=next_row."bayi","tedarikciler"=next_row."tedarikciler","siparisAlan"=next_row."siparisAlan","urun"=next_row."urun","marka"=next_row."marka","alisFiyati"=next_row."alisFiyati","pesinSatisFiyati"=next_row."pesinSatisFiyati","siparisTonaj"=next_row."siparisTonaj","teslimOlanTonaj"=next_row."teslimOlanTonaj","satisTuru"=next_row."satisTuru","vadeTarihi"=next_row."vadeTarihi","vadeFarki"=next_row."vadeFarki","vadeSuresi"=next_row."vadeSuresi","not"=next_row."not","nakliye"=next_row."nakliye","plaka"=next_row."plaka","sevkYeri"=next_row."sevkYeri","sevkDurumu"=next_row."sevkDurumu","sevkNo"=next_row."sevkNo","gts"=next_row."gts","bayiSatisToplam"=next_row."bayiSatisToplam","tedarikciyeOdenecekTutar"=next_row."tedarikciyeOdenecekTutar" where id=old_row.id;
  end if;
  insert into order_sync.sources(source,external_key,order_id,snapshot_at,last_values)
  values(p_source,p_key,old_row.id,p_snapshot,coalesce(state.last_values,'{}'::jsonb)||p_values)
  on conflict(source,external_key) do update set snapshot_at=excluded.snapshot_at,last_values=excluded.last_values;
  return jsonb_build_object('status',result_status);
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
  return jsonb_build_object('status','invalid','message','Sayı veya tarih biçimi geçersiz.');
end;
$$;
revoke all on function public.sync_order_from_sheet(text,text,jsonb,timestamptz,boolean) from public, anon, authenticated;
grant execute on function public.sync_order_from_sheet(text,text,jsonb,timestamptz,boolean) to service_role;
commit;
