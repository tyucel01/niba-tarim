"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, RefreshCw, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Invoice = { id: string; remaining_amount?: number; supplier_name?: string; attributes?: { invoice_no?: string; issue_date?: string; net_total?: string | number | null; currency?: string } };
export default function PendingInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newIds, setNewIds] = useState<string[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    let running = false;
    const controller = new AbortController();
    async function load() {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const { data: session } = await supabase.auth.getSession();
        const response = await fetch("/api/admin/parasut/gelen-faturalar", { cache: "no-store", signal: controller.signal, headers: session.session ? { Authorization: `Bearer ${session.session.access_token}` } : {} });
        let data = await response.json();
        if (!response.ok || !data.success) throw new Error("Bekleyen faturalar alınamadı.");
        let pages = 1;
        while (data.nextPage && pages < 20) {
          const nextResponse = await fetch(`/api/admin/parasut/gelen-faturalar?page=${data.nextPage}`, { cache: "no-store", signal: controller.signal, headers: session.session ? { Authorization: `Bearer ${session.session.access_token}` } : {} });
          const next = await nextResponse.json();
          if (!nextResponse.ok || !next.success) throw new Error("Faturalar kontrol edilemedi.");
          data = { ...data, invoices: [...data.invoices, ...(next.invoices || [])], incomingInvoices: [...(data.incomingInvoices || data.invoices), ...(next.incomingInvoices || next.invoices || [])], nextPage: next.nextPage };
          pages++;
        }
        if (!active) return;
        const rows: Invoice[] = Array.from(new Map<string, Invoice>((data.invoices || []).map((row: Invoice) => [String(row.id), row])).values()).filter(isDashboardInvoice);
        const incoming: Invoice[] = (data.incomingInvoices || rows).filter(isDashboardInvoice);
        setInvoices(rows);
        setHasMore(Boolean(data.nextPage));
        setTotal(data.nextPage ? null : rows.length);
        setError("");
        try {
          const key = `niba-invoice-seen:${session.session?.user.id || "admin"}`;
          const saved = localStorage.getItem(key);
          if (saved) {
            const known: string[] = JSON.parse(saved);
            if (Array.isArray(known)) setNewIds(incoming.filter(row => !known.includes(String(row.id))).map(row => String(row.id)));
          } else { localStorage.setItem(key, JSON.stringify(incoming.map(row => String(row.id)))); }
        } catch { /* List remains usable when local storage is unavailable. */ }
      } catch (cause) {
        if (active && !controller.signal.aborted) setError("Faturalar şu anda kontrol edilemiyor. Yeniden deneyin.");
      } finally { running = false; if (active) setLoading(false); }
    }
    void load();
    const timer = window.setInterval(load, 60000);
    document.addEventListener("visibilitychange", load);
    return () => { active = false; controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", load); };
  }, [refresh]);
  async function markRead() {
    try {
      const { data } = await supabase.auth.getSession();
      const key = `niba-invoice-seen:${data.session?.user.id || "admin"}`;
      const previous = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify([...new Set([...(Array.isArray(previous) ? previous : []), ...invoices.map(row => String(row.id))])].slice(-2000)));
      setNewIds([]);
    } catch { /* Optional device-local read state. */ }
  }
  return <section aria-labelledby="pending-invoices-title" className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-amber-50 p-2 text-amber-700"><FileText size={21} aria-hidden="true" /></span><div><h2 id="pending-invoices-title" className="text-lg font-bold">Bekleyen faturalar <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-sm">{loading ? "…" : error && !invoices.length ? "—" : total ?? `${invoices.length}${hasMore ? "+" : ""}`}</span></h2><p className="text-sm text-slate-500">200.000 TL ve üzerindeki alış faturaları</p></div></div>
      <button type="button" onClick={() => setRefresh(value => value + 1)} aria-label="Bekleyen faturaları yenile" className="rounded-xl border border-slate-200 p-3 text-slate-600 hover:bg-slate-50"><RefreshCw size={18} aria-hidden="true" /></button>
    </div>
    {newIds.length > 0 && <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-800"><p>{newIds.length} adet yeni gelen fatura var</p><button type="button" onClick={markRead} className="underline">Görüldü olarak işaretle</button></div>}
    {error && <p role="alert" className="px-5 py-3 text-sm text-red-700">{error}</p>}
    {loading ? <p className="p-5 text-slate-500">Faturalar yükleniyor…</p> : !invoices.length && !error ? <p className="p-5 text-slate-500">200.000 TL ve üzerinde bekleyen alış faturası yok.</p> : invoices.length > 0 && <div className="max-h-96 overflow-auto"><div className="divide-y divide-slate-100 sm:hidden">{invoices.map(invoice => <article key={invoice.id} className="px-5 py-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm text-slate-500">{date(invoice.attributes?.issue_date)}</p><p className="font-bold text-slate-900">{money(invoice.attributes?.net_total, invoice.attributes?.currency)}</p></div><p className="mt-2 font-semibold">{invoice.supplier_name || "Cari bilgisi alınamadı"}</p>{invoice.remaining_amount != null && <p className="mt-1 text-sm font-semibold text-emerald-800">Kalan: {money(invoice.remaining_amount, invoice.attributes?.currency)}</p>}<p className="mt-1 text-sm text-slate-500">{invoice.attributes?.invoice_no || invoice.id}{newIds.includes(String(invoice.id)) && <span className="ml-2 font-bold text-emerald-700">Yeni</span>}</p></article>)}</div><table className="hidden w-full text-left text-sm sm:table"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th scope="col" className="px-5 py-3">Fatura tarihi</th><th scope="col" className="px-5 py-3">Cari / faturayı kesen firma</th><th scope="col" className="px-5 py-3 text-right">Fatura tutarı</th></tr></thead><tbody>{invoices.map(invoice => <tr key={invoice.id} className="border-t border-slate-100"><td className="whitespace-nowrap px-5 py-4">{date(invoice.attributes?.issue_date)}</td><td className="min-w-40 px-5 py-4"><p className="font-semibold text-slate-900">{invoice.supplier_name || "Cari bilgisi alınamadı"}</p><p className="mt-1 text-sm text-slate-500">{invoice.attributes?.invoice_no || invoice.id}{newIds.includes(String(invoice.id)) && <span className="ml-2 font-bold text-emerald-700">Yeni</span>}</p></td><td className="whitespace-nowrap px-5 py-4 text-right font-bold">{money(invoice.attributes?.net_total, invoice.attributes?.currency)}{invoice.remaining_amount != null && <p className="mt-1 text-sm font-normal text-emerald-800">Kalan: {money(invoice.remaining_amount, invoice.attributes?.currency)}</p>}</td></tr>)}</tbody></table></div>}
    <div className="border-t border-slate-100 px-5 py-3"><Link href="/admin/parasut/gelen-faturalar" prefetch={false} className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800">Tüm gelen faturaları aç <ArrowRight size={16} aria-hidden="true" /></Link></div>
  </section>;
}
function date(value?: string) { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("tr-TR"); }
function money(value?: string | number | null, currency?: string) { if (value == null || value === "") return "Tutar bilgisi bekleniyor"; const amount = Number(value); if (!Number.isFinite(amount)) return "Tutar bilgisi bekleniyor"; const code = currency === "TRL" || !currency ? "TRY" : currency; return new Intl.NumberFormat("tr-TR", { style: "currency", currency: /^[A-Z]{3}$/.test(code) ? code : "TRY" }).format(amount); }

function isDashboardInvoice(invoice: Invoice) { const currency = invoice.attributes?.currency || "TRY"; const amount = Number(invoice.attributes?.net_total); return (currency === "TRY" || currency === "TRL") && Number.isFinite(amount) && amount >= 200000; }
