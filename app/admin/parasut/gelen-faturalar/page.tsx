"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function GelenFaturalarPage() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [debugRaw, setDebugRaw] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [matchingLoading, setMatchingLoading] = useState(false);

  const visibleInvoices = useMemo(() => {
    if (!onlyNeedsReview) return invoices;
    return invoices.filter((invoice) => (invoice.match?.score || 0) < 70);
  }, [invoices, onlyNeedsReview]);

  async function loadOrders() {
    const { data, error } = await supabase
      .from("siparisler")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!error) setOrders(data || []);
  }

  async function loadInvoices() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch(
        `/api/admin/parasut/gelen-faturalar?t=${Date.now()}`,
        { cache: "no-store" },
      );

      const data = await res.json();

      if (!data.success) {
        setMessage("❌ Gelen faturalar alınamadı: " + JSON.stringify(data.error));
        return;
      }

      setInvoices(data.invoices || []);
      setDebugRaw(data.raw || data);
      await loadOrders();
    } catch (err) {
      setMessage("❌ Hata: " + String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  async function handleManualMatch() {
    if (!selectedInvoice || !selectedOrderId) {
      alert("Lütfen fatura ve sipariş seç.");
      return;
    }

    try {
      setMatchingLoading(true);

      const res = await fetch("/api/admin/parasut/match-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eInvoiceId: selectedInvoice.id,
          invoiceNo: getInvoiceNo(selectedInvoice),
          invoiceUuid: getInvoiceUuid(selectedInvoice),
          supplierName: getSupplierName(selectedInvoice),
          supplierVkn: getSupplierVkn(selectedInvoice),
          siparisId: selectedOrderId,
          invoiceTotal: getInvoiceTotal(selectedInvoice),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert("Eşleştirme başarısız: " + JSON.stringify(data.error || data));
        return;
      }

      alert("Fatura siparişle eşleştirildi.");

      setSelectedInvoice(null);
      setSelectedOrderId("");
      await loadInvoices();
    } catch (err) {
      alert("Eşleştirme hatası: " + String(err));
    } finally {
      setMatchingLoading(false);
    }
  }

  const autoMatchedCount = invoices.filter(
    (invoice) => (invoice.match?.score || 0) >= 70,
  ).length;

  const reviewCount = invoices.filter((invoice) => {
    const score = invoice.match?.score || 0;
    return score > 0 && score < 70;
  }).length;

  const manualCount = invoices.filter(
    (invoice) => !invoice.match || (invoice.match?.score || 0) <= 0,
  ).length;

  return (
    <main className="min-h-screen bg-[#eef1ea] p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <Link href="/admin" prefetch={false} className="font-black text-emerald-800">
          ← Admin Panel
        </Link>

        <section className="rounded-[32px] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/10">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
                Paraşüt Entegrasyonu
              </p>
              <h1 className="mt-2 text-3xl font-black">Gelen Faturalar</h1>
              <p className="mt-2 text-sm text-white/60">
                İçeri alınmayı bekleyen e-faturaları siparişlerle eşleştir.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setOnlyNeedsReview((prev) => !prev)}
                className={`rounded-2xl px-5 py-3 text-sm font-black ring-1 ${
                  onlyNeedsReview
                    ? "bg-amber-400 text-slate-950 ring-amber-300"
                    : "bg-white/10 text-white ring-white/15"
                }`}
              >
                {onlyNeedsReview ? "Tümünü Göster" : "Kontrol Gerekenler"}
              </button>

              <button
                type="button"
                onClick={() => setShowDebug((prev) => !prev)}
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white ring-1 ring-white/15"
              >
                {showDebug ? "Debug Gizle" : "Debug"}
              </button>

              <button
                type="button"
                onClick={loadInvoices}
                disabled={loading}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-900 disabled:opacity-50"
              >
                {loading ? "Yükleniyor..." : "Yenile"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="Toplam" value={invoices.length} />
            <MiniStat label="Oto Eşleşti" value={autoMatchedCount} />
            <MiniStat label="Kontrol" value={reviewCount} />
            <MiniStat label="Manuel" value={manualCount} />
          </div>

          {message && (
            <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm font-bold ring-1 ring-white/15">
              {message}
            </div>
          )}
        </section>

        <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
          {loading ? (
            <div className="p-6 text-sm font-bold text-slate-500">
              Faturalar yükleniyor...
            </div>
          ) : visibleInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl">📄</div>
              <h2 className="mt-4 text-xl font-black text-slate-950">
                Fatura bulunamadı
              </h2>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleInvoices.map((invoice) => {
                const score = invoice.match?.score || 0;
                const previewUrl = getPreviewUrl(invoice);

                const matchStatus =
                  score >= 70
                    ? "Oto eşleşti"
                    : score > 0
                      ? "Kontrol gerekli"
                      : "Manuel eşleştir";

                const matchClass =
                  score >= 70
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                    : score > 0
                      ? "bg-amber-50 text-amber-700 ring-amber-100"
                      : "bg-slate-100 text-slate-600 ring-slate-200";

                return (
                  <div
                    key={invoice.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1.4fr_160px] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {getSupplierName(invoice)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Fatura No: {getInvoiceNo(invoice)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">
                          Tarih
                        </p>
                        <p className="text-sm font-black text-slate-800">
                          {getInvoiceDate(invoice)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">
                          Tutar
                        </p>
                        <p className="text-sm font-black text-emerald-700">
                          {formatMoney(getInvoiceTotal(invoice))}
                        </p>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${matchClass}`}
                          >
                            {matchStatus}
                          </span>

                          {score > 0 && (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                              Skor: %{Math.min(score, 100)}
                            </span>
                          )}
                        </div>

                        {invoice.match?.order && (
                          <p className="mt-2 text-xs font-bold text-slate-600">
                            Sipariş: #{invoice.match.order.satisId || invoice.match.order.id} ·{" "}
                            {invoice.match.order.bayi || "-"} ·{" "}
                            {invoice.match.order.urun || "-"} ·{" "}
                            {invoice.match.order.plaka || "Plaka yok"}
                          </p>
                        )}

                        {invoice.match?.reasons?.length > 0 && (
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                            {invoice.match.reasons.join(", ")}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end gap-2">
                        {previewUrl ? (
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white"
                          >
                            Faturayı Aç
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-black text-slate-400"
                          >
                            Faturayı Aç
                          </button>
                        )}

                        {score < 70 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setSelectedOrderId("");
                            }}
                            className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 ring-1 ring-amber-100"
                          >
                            Eşleştir
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                        Durum: {getInvoiceStatus(invoice)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                        VKN: {getSupplierVkn(invoice) || "-"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {showDebug && (
          <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <h2 className="text-lg font-black text-slate-950">
              Debug Paraşüt Cevabı
            </h2>
            <pre className="mt-4 max-h-[400px] overflow-auto rounded-2xl bg-black p-4 text-xs text-green-400">
              {JSON.stringify(debugRaw, null, 2)}
            </pre>
          </section>
        )}
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
                  Manuel Eşleştirme
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Faturayı Siparişle Eşleştir
                </h2>
                <p className="mt-2 text-sm font-bold text-slate-600">
                  {getSupplierName(selectedInvoice)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Fatura No: {getInvoiceNo(selectedInvoice)}
                </p>
                <p className="mt-1 text-lg font-black text-emerald-700">
                  {formatMoney(getInvoiceTotal(selectedInvoice))}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedInvoice(null);
                  setSelectedOrderId("");
                }}
                className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700"
              >
                Kapat
              </button>
            </div>

            <div className="mt-6">
              <label className="text-sm font-black text-slate-700">
                Sipariş Seç
              </label>

              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">Sipariş seçin</option>

                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    #{order.satisId || order.id} · {order.bayi || "-"} ·{" "}
                    {order.urun || "-"} · {order.plaka || "-"} ·{" "}
                    {formatMoney(Number(order.bayiSatisToplam || 0))}
                  </option>
                ))}
              </select>

              {orders.length === 0 && (
                <p className="mt-2 text-xs font-bold text-red-500">
                  Sipariş bulunamadı. Önce sipariş tablosunda kayıt olmalı.
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedInvoice(null);
                  setSelectedOrderId("");
                }}
                className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700"
              >
                Vazgeç
              </button>

              <button
                type="button"
                disabled={!selectedOrderId || matchingLoading}
                onClick={handleManualMatch}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {matchingLoading ? "Eşleştiriliyor..." : "Eşleştir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function getAttr(invoice: any) {
  return invoice?.attributes || {};
}

function getSupplierName(invoice: any) {
  const attr = getAttr(invoice);
  return (
    invoice.supplier_name ||
    attr.contact_name ||
    attr.supplier_name ||
    attr.from_vkn ||
    invoice.from_vkn ||
    "Tedarikçi"
  );
}

function getSupplierVkn(invoice: any) {
  const attr = getAttr(invoice);
  return attr.from_vkn || invoice.from_vkn || null;
}

function getInvoiceNo(invoice: any) {
  const attr = getAttr(invoice);
  return invoice.invoice_no || attr.invoice_no || attr.external_id || invoice.id || "-";
}

function getInvoiceUuid(invoice: any) {
  const attr = getAttr(invoice);
  return invoice.uuid || attr.uuid || null;
}

function getInvoiceDate(invoice: any) {
  const attr = getAttr(invoice);
  return invoice.issue_date || attr.issue_date || "-";
}

function getInvoiceTotal(invoice: any) {
  const attr = getAttr(invoice);
  return Number(
    invoice.total_amount ||
      invoice.net_total ||
      attr.total_amount ||
      attr.net_total ||
      0,
  );
}

function getInvoiceStatus(invoice: any) {
  const attr = getAttr(invoice);
  return invoice.status || attr.status || attr.response_type || "-";
}

function getPreviewUrl(invoice: any) {
  const attr = getAttr(invoice);
  return (
    invoice.pdf_url ||
    invoice.html_url ||
    attr.pdf_url ||
    attr.html_url ||
    attr.sharing_preview_url ||
    null
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
      <p className="text-xs font-bold text-white/55">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value || 0);
}