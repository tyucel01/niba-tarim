"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { orderStage, stageLabels, type OrderRow, type OrderStage } from "@/lib/orders/workflow";

type Filter = "all" | OrderStage;

export default function SiparislerPage() {
  const [loading, setLoading] = useState(true);
  const [siparisler, setSiparisler] = useState<OrderRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = 25;

  async function loadSiparisler() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch(`/api/admin/siparisler?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!data.success) {
        setMessage("❌ Siparişler alınamadı: " + JSON.stringify(data.error));
        setSiparisler([]);
        return;
      }

      setSiparisler(data.rows || []);
      setPage(1);
    } catch (err) {
      setMessage("❌ Hata: " + String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => void loadSiparisler(), 0);
    return () => clearTimeout(timeout);
  }, []);


  const filtered = useMemo(() => {
    return siparisler.filter((s) => {
      const text = JSON.stringify(s).toLowerCase();
      const matchSearch = text.includes(search.toLowerCase());
      if (filter !== "all") return matchSearch && orderStage(s) === filter;

      return matchSearch;
    });
  }, [siparisler, search, filter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const counts = siparisler.reduce<Record<OrderStage, number>>((acc, s) => { acc[orderStage(s)]++; return acc; }, {sevk: 0, fatura: 0, done: 0, cancelled: 0});
  return (
    <main className="min-h-screen bg-[#f5f7f4] p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/admin" prefetch={false} className="text-sm font-semibold text-emerald-800">← Admin Panel</Link>
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Niba Tarım</p><h1 className="mt-1 text-3xl font-bold">Siparişler</h1><p className="mt-2 text-sm text-slate-500">Alış–satış bilgilerini kaydet, araç belli olduğunda sevki tamamla.</p></div>
          <Link href="/admin/siparisler/yeni-siparis" prefetch={false} className="rounded-xl bg-emerald-700 px-5 py-3 text-center font-bold text-white hover:bg-emerald-800">+ Yeni sipariş</Link>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm font-semibold"><Link href="/admin/siparisler/import" prefetch={false} className="text-slate-500">Excel’den aktar</Link><button onClick={loadSiparisler} disabled={loading} className="min-h-11 text-emerald-800 disabled:opacity-50">Yenile</button></div>
        </div>
        {message && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{message}</p>}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-4 border-b border-slate-100 p-4 md:p-5">
            <label className="block"><span className="sr-only">Sipariş ara</span><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Bayi, tedarikçi, sipariş no, ürün veya plaka ara…" className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
            <div className="flex flex-wrap gap-2" aria-label="Sipariş durumu">
              {(['all', 'sevk', 'fatura', 'done', 'cancelled'] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); }} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${filter === value ? 'bg-emerald-700 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>{value === 'all' ? 'Tümü' : stageLabels[value]} <span className="ml-1 opacity-70">{value === 'all' ? siparisler.length : counts[value]}</span></button>)}
            </div>
          </div>
          <div className="hidden grid-cols-[1.4fr_1fr_0.7fr_1.5fr_0.9fr_1.1fr] gap-4 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-400 lg:grid"><span>Sipariş / Bayi</span><span>Ürün</span><span>Tonaj</span><span>Tedarikçi / Fatura tutarı</span><span>Durum</span><span className="text-right">İşlem</span></div>
          {loading ? <p className="p-10 text-center text-slate-500">Siparişler yükleniyor…</p> : !filtered.length ? <p className="p-10 text-center text-slate-500">Bu görünümde sipariş bulunamadı.</p> : paginated.map((s) => {
            const stage = orderStage(s);
            const id = String(s.id || s.satisId);
            const detail = `/admin/siparisler/${encodeURIComponent(id)}`;
            const actionHref = `${detail}#${stage === 'fatura' || stage === 'done' ? 'fatura' : 'sevk'}`;
            return <article key={id} className="grid gap-4 border-t border-slate-100 p-5 first:border-t-0 lg:grid-cols-[1.4fr_1fr_0.7fr_1.5fr_0.9fr_1.1fr] lg:items-center">
              <div className="min-w-0"><Link href={`${detail}#satis`} prefetch={false} className="font-bold text-slate-900 hover:text-emerald-700">{String(s.bayi || 'Bayi belirtilmedi')}</Link><p className="mt-1 text-xs text-slate-500">#{String(s.satisId || s.id)} · {formatDate(s.satisTarihi)}</p></div>
              <div className="min-w-0"><p className="font-semibold">{String(s.urun || '—')}</p><p className="mt-1 text-xs text-slate-500">{String(s.marka || '')}{s.plaka ? ` · ${s.plaka}` : ''}</p></div>
              <div><p className="font-semibold">{formatNumber(numberValue(s.siparisTonaj))} ton</p><p className="mt-1 text-xs text-slate-500">{s.sevkYeri ? String(s.sevkYeri) : 'Sevk yeri bekleniyor'}</p></div>
              <div className="min-w-0"><p className="text-xs text-slate-500 lg:hidden">Tedarikçi / Fatura tutarı</p><p className="font-semibold">{String(s.tedarikciler || 'Tedarikçi belirtilmedi')}</p><p className="mt-1 font-bold text-emerald-800">{formatNumber(s.matched_purchase_invoice_total != null ? Number(s.matched_purchase_invoice_total) : numberValue(s.tedarikciyeOdenecekTutar) || numberValue(s.alisFiyati) * numberValue(s.siparisTonaj))} TL</p><p className="mt-1 text-xs text-slate-500">{s.matched_purchase_invoice_total != null ? String(s.matched_purchase_invoice_no || 'Alış faturası') : 'Beklenen fatura tutarı'}</p>{s.matched_purchase_allocated_amount != null && Number(s.matched_purchase_allocated_amount) !== Number(s.matched_purchase_invoice_total) && <p className="mt-1 text-xs text-slate-500">Bu siparişe ayrılan: {formatNumber(Number(s.matched_purchase_allocated_amount))} TL</p>}</div>
              <div><span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${stage === 'done' ? 'bg-emerald-50 text-emerald-700' : stage === 'fatura' ? 'bg-blue-50 text-blue-700' : stage === 'cancelled' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-800'}`}>{stageLabels[stage]}</span></div>
              <Link href={actionHref} prefetch={false} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-center text-sm font-bold text-emerald-800 hover:bg-emerald-100">{stage === 'sevk' ? 'Sevk bilgilerini gir →' : stage === 'fatura' ? 'Faturayı incele →' : 'Siparişi aç →'}</Link>
            </article>;
          })}
          {!loading && filtered.length > 0 && <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-4 text-sm"><span className="text-slate-500">{filtered.length} sipariş · {page} / {totalPages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(p => Math.max(p - 1, 1))} className="min-h-11 rounded-lg bg-slate-100 px-3 disabled:opacity-40">Önceki</button><button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(p + 1, totalPages))} className="min-h-11 rounded-lg bg-slate-100 px-3 disabled:opacity-40">Sonraki</button></div></div>}
        </section>
      </div>
    </main>
  );
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value;

  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: unknown) {
  if (!value) return "-";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("tr-TR");
}
