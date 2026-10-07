"use client";

import { salesProgress } from "@/lib/orders/sales-progress";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function FaturaKesPage() {
  const [sourceLines, setSourceLines] = useState<any[]>([]);
  const [sourceLineId, setSourceLineId] = useState("");
  const [lineError, setLineError] = useState("");
  const [lineLocked, setLineLocked] = useState(false);
  const [linesLoading, setLinesLoading] = useState(false);
  const [invoiceTons, setInvoiceTons] = useState("");
  const [siparisId, setSiparisId] = useState("");
  const [order, setOrder] = useState<any | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [preview, setPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [contactError, setContactError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("siparisId") || "";
    setSiparisId(id);
  }, []);

  useEffect(() => {
    if (!siparisId) return;
    loadData();
  }, [siparisId]);

  useEffect(() => {
    if (!order || contacts.length === 0) return;

    const match = findBestContactMatch(order.bayi, contacts);

    if (match?.contact?.id) {
      setSelectedCustomerId(String(match.contact.id));
      setCustomerSearch(getContactName(match.contact));
      return;
    }

    if (order?.bayi) {
      setCustomerSearch(order.bayi);
    }
  }, [order, contacts]);

  async function loadData() {
    try {
      setLoading(true);
      setContactError("");

      const orderRes = await fetch(
        `/api/admin/siparisler?id=${encodeURIComponent(siparisId)}`,
        { cache: "no-store" }
      );

      const orderData = await orderRes.json();

      if (!orderData.success) {
        alert("Sipariş alınamadı.");
        return;
      }

      const foundOrder =
        orderData.row ||
        orderData.order ||
        orderData.data ||
        (orderData.rows || []).find(
          (x: any) => String(x.id) === String(siparisId)
        );

      setOrder(foundOrder || null);
      if (foundOrder) setInvoiceTons(String(salesProgress(foundOrder).remainingTons));

      let contactsRes = await fetch("/api/admin/parasut/contacts", {
        cache: "no-store",
      });

      if (contactsRes.status === 429) {
        await sleep(1600);
        contactsRes = await fetch("/api/admin/parasut/contacts", {
          cache: "no-store",
        });
      }

      const contactsData = await contactsRes.json().catch(() => null);

      if (!contactsRes.ok || !contactsData?.success) {
        setContactError(
          contactsRes.status === 429
            ? "Paraşüt cari kart servisi çok sık çağrıldı. Biraz bekleyip tekrar yenile."
            : contactsData?.error || "Cari kartlar alınamadı."
        );
        setContacts([]);
        return;
      }

      const rawContacts =
        contactsData.contacts ||
        contactsData.items ||
        contactsData.data ||
        contactsData.rows ||
        [];

      setContacts(Array.isArray(rawContacts) ? rawContacts : []);
    } catch (err: any) {
      alert(err?.message || "Veriler alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSourceLines() {
    if (!order?.id || !order?.matched_purchase_invoice_id) return;
    setLinesLoading(true); setLineError(""); setPreview(null);
    try {
      const res = await fetch("/api/admin/parasut/sales-invoice/create-from-order", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siparisId:order.id,sourceOnly:true})});
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Alış faturası kalemleri alınamadı.");
      setSourceLines(data.sourceLines || []); setSourceLineId(data.selectedLineId || ""); setLineLocked(Boolean(data.selectionLocked)); setLineError(data.warning || "");
    } catch (err: any) { setSourceLines([]); setSourceLineId(""); setLineError(err.message); }
    finally { setLinesLoading(false); }
  }
  useEffect(() => { if (order?.matched_purchase_invoice_id && !salesProgress(order).complete) loadSourceLines(); }, [order]);

  async function createPreview() {
    if (!order?.id) return;

    if (!selectedCustomerId) {
      alert("Önce Paraşüt müşteri cari kartı seç.");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch(
        "/api/admin/parasut/sales-invoice/create-from-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            siparisId: order.id,
            customerId: selectedCustomerId,
            sourceLineId,
            invoiceTons: Number(invoiceTons.replace(",", ".")),
            confirm: false,
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        if (data.salesInvoiceId) { setPreview(null); await loadData(); }
        alert(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error || data, null, 2)
        );
        return;
      }

      setPreview(data.preview);
    } catch (err: any) {
      alert(err?.message || "Önizleme oluşturulamadı.");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => { setPreview(null); }, [selectedCustomerId, invoiceTons, sourceLineId]);

  async function createSalesInvoice() {
    if (!preview || creating) return;
    if (!order?.id) return;

    if (!selectedCustomerId) {
      alert("Önce Paraşüt müşteri cari kartı seç.");
      return;
    }

    const ok = window.confirm(
      `Müşteri: ${getContactName(selectedCustomer)}\nKesilecek: ${preview.invoiceTons} ton · Kalan: ${preview.remainingTons} ton\nKDV dahil toplam: ${formatMoney(preview.estimatedTotal)}\n${preview.details.length} kalem için satış faturası oluşturmayı onaylıyor musunuz?`
    );

    if (!ok) return;

    try {
      setCreating(true);

      const res = await fetch(
        "/api/admin/parasut/sales-invoice/create-from-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            siparisId: order.id,
            customerId: selectedCustomerId,
            sourceLineId,
            invoiceTons: Number(invoiceTons.replace(",", ".")),
            confirm: true,
            previewFingerprint: preview.fingerprint,
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        if (data.salesInvoiceId) { setPreview(null); await loadData(); }
        alert(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error || data, null, 2)
        );
        return;
      }

      setPreview(null);
      await loadData();
      alert(
        `✅ Satış faturası oluşturuldu.\n\nFatura ID: ${
          data.salesInvoiceId || "-"
        }\nFatura No: ${data.salesInvoiceNo || "-"}`
      );
    } catch (err: any) {
      alert(err?.message || "Satış faturası oluşturulamadı.");
    } finally {
      setCreating(false);
    }
  }

const progress = order ? salesProgress(order) : null;
const selectedTons = Number(invoiceTons.replace(",", "."));
const amountForPart = progress && selectedTons > 0 ? selectedTons === progress.remainingTons ? progress.remainingTotal : Math.round(progress.total * selectedTons / progress.tons * 100) / 100 : 0;
const invalidPart = !progress || !Number.isFinite(selectedTons) || selectedTons <= 0 || selectedTons > progress.remainingTons || amountForPart > progress.remainingTotal || progress.blocked;
const selectedCustomer = contacts.find(
  (c) => String(c.id) === String(selectedCustomerId)
);



  const bestMatch = useMemo(() => {
    if (!order || contacts.length === 0) return null;
    return findBestContactMatch(order.bayi, contacts);
  }, [order, contacts]);

  const searchedContacts = useMemo(() => {
    const q = normalizeText(customerSearch);

    if (!q) return contacts.slice(0, 80);

    return contacts
      .filter((c) => {
        const text = normalizeText(
          `${getContactName(c)} ${getContactTaxNo(c)} ${c.email || ""}`
        );

        const qWords = q.split(" ").filter((x) => x.length > 1);

        return text.includes(q) || qWords.some((w) => text.includes(w));
      })
      .slice(0, 80);
  }, [contacts, customerSearch]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#eef1ea] p-6">
        <div className="mx-auto max-w-5xl rounded-[28px] bg-white p-6 font-black text-slate-600">
          Fatura kes ekranı yükleniyor...
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-[#eef1ea] p-6">
        <div className="mx-auto max-w-5xl rounded-[28px] bg-white p-6">
          <p className="font-black text-red-600">Sipariş bulunamadı.</p>
          <Link
            href="/admin/siparisler"
            className="mt-4 inline-flex font-black text-emerald-700"
          >
            ← Siparişlere dön
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef1ea] p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <Link
          href="/admin/siparisler"
          prefetch={false}
          className="font-black text-emerald-800"
        >
          ← Siparişlere Dön
        </Link>

        <section className="rounded-[32px] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
            Paraşüt Satış Faturası
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Fatura Kes
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Satış faturası sipariş verisi üzerinden önizlenir ve onay sonrası Paraşüt üzerinde oluşturulur.
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Sipariş Bilgileri
            </p>

            <div className="mt-4 space-y-3">
              <InfoRow label="Sipariş No" value={order.satisId || order.id} />
              <InfoRow label="Bayi" value={order.bayi} />
              <InfoRow
                label="Ürün"
                value={`${order.urun || "-"} ${order.marka ? `/ ${order.marka}` : ""}`}
              />
              <InfoRow label="Sipariş Tonajı" value={`${formatNumber(numberValue(order.siparisTonaj))} ton`} />
              <InfoRow
                label="Teslim Olan Tonaj"
                value={`${formatNumber(numberValue(order.teslimOlanTonaj))} ton`}
              />
              <InfoRow
                label="Satış Fiyatı"
                value={formatMoney(numberValue(order.pesinSatisFiyati))}
              />
              <InfoRow
                label="Teslime Göre Satış Toplamı"
                value={formatMoney(progress?.total)}
              />
              <InfoRow
                label="Eşleşmiş Alış Faturası"
                value={order.matched_purchase_invoice_no || "-"}
              />
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Paraşüt Müşteri Cari Kartı
            </p>

            {contactError && (
              <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 ring-1 ring-red-100">
                {contactError}
              </div>
            )}

            {bestMatch?.contact ? (
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                <p className="text-xs font-black text-emerald-700">
                  Önerilen Cari Kart
                </p>
                <p className="mt-1 text-sm font-black text-emerald-950">
                  {getContactName(bestMatch.contact)}
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-800">
                  VKN/TCKN: {getContactTaxNo(bestMatch.contact) || "-"} · Skor: %{bestMatch.score}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId(String(bestMatch.contact.id));
                    setCustomerSearch(getContactName(bestMatch.contact));
                  }}
                  className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white"
                >
                  Bu cari kartı kullan
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800 ring-1 ring-amber-100">
                Otomatik cari eşleşmesi bulunamadı. Aşağıdan bayi adı veya VKN ile manuel seç.
              </div>
            )}

            <div className="mt-4">
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                Cari Kart Ara / Değiştir
              </label>

              <p className="mb-2 text-xs font-bold text-slate-400">
                Yüklenen cari kart sayısı: {contacts.length} · Filtrelenen: {searchedContacts.length}
              </p>

              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Bayi adı veya VKN yaz..."
                className="mb-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400"
              />

              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400"
              >
                <option value="">Müşteri cari kartı seç</option>

                {searchedContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getContactName(c)} {getContactTaxNo(c) ? `- ${getContactTaxNo(c)}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomer && (
              <div className="mt-3 rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-300">
                  Seçili Cari Kart
                </p>
                <p className="mt-1 text-sm font-black">
                  {getContactName(selectedCustomer)}
                </p>
                <p className="mt-1 text-xs font-semibold text-white/60">
                  VKN/TCKN: {getContactTaxNo(selectedCustomer) || "-"}
                </p>
              </div>
            )}
          </div>
        </section>

        {progress && <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xl font-black">{progress.blocked ? "Fatura kontrolü bekliyor" : progress.complete ? "Faturalandı" : progress.billedTons > 0 ? "Kısmi faturalandı" : "Satış faturası kesilecek miktar"}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">{[["Teslim edilen",progress.tons,progress.total],["Faturalanan",progress.billedTons,progress.billedTotal],["Kalan",progress.remainingTons,progress.remainingTotal]].map(([label,tons,amount])=><div key={String(label)} className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-1 font-black">{formatNumber(Number(tons))} ton · {formatMoney(amount)}</p></div>)}</div>
          {!progress.complete && <div className="mt-5 rounded-2xl border border-slate-200 p-5"><h3 className="font-bold text-lg">Alış faturasından kalemi seç</h3><p className="mt-1 text-sm text-slate-500">Bu müşteriye ait ürünü seçin. Satış faturasında yalnız bu kalem yer alır; miktar teslim tonajına göre hesaplanır.</p>{linesLoading && <p className="mt-3">Kalemler yükleniyor…</p>}{lineError && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{lineError}</p>}<div className="mt-4 grid gap-3">{sourceLines.map(line => <div key={line.id} className={`rounded-xl border p-4 ${sourceLineId===line.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}><p className="font-bold">{line.name}</p><p className="mt-1 text-sm text-slate-600">Alış miktarı: {formatNumber(line.tons)} ton · KDV: %{line.vatRate} · Tutar: {formatMoney(line.amount)}</p><p className="mt-1 text-sm">Kalan: {formatNumber(line.remainingTons)} ton</p><button type="button" disabled={Boolean(lineError) || (lineLocked && sourceLineId!==line.id) || Number(order.teslimOlanTonaj)>line.availableForOrder+.000001} onClick={()=>setSourceLineId(line.id)} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{sourceLineId===line.id ? "Seçili kalem" : "Kalemi seç"}</button>{Number(order.teslimOlanTonaj)>line.availableForOrder+.000001 && <p className="mt-2 text-sm text-amber-800">Bu kalem siparişin teslim tonajını karşılamıyor.</p>}</div>)}</div><button type="button" onClick={loadSourceLines} disabled={linesLoading} className="mt-3 text-sm font-bold text-emerald-700 underline">Kalemleri yeniden yükle</button></div>}
          {!progress.complete && <div className="mt-5"><label className="block text-sm font-bold">Bu faturada kesilecek tonaj<input type="number" min="0.000001" max={progress.remainingTons} step="0.000001" value={invoiceTons} onChange={e=>setInvoiceTons(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 sm:max-w-xs" /></label><p className="mt-3 font-bold text-emerald-800">Kesilecek tutar (KDV dahil): {formatMoney(amountForPart)}</p><p className="mt-1 text-sm text-slate-500">Tutar siparişin satış fiyatına göre hesaplanır; kalan tonaj ve tutar aşılamaz.</p>{invalidPart && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">{progress.blocked ? progress.overbilled ? "Kayıtlı faturalar teslim tonajını veya tutarını aşıyor. Teslim bilgilerini ve mevcut faturaları kontrol edin; yeni fatura oluşturulamaz." : "Önceki faturanın resmileştirmesi kontrol bekliyor. Paraşüt üzerinde kontrol edin; yeniden kesmeyin." : `Kesilecek tonaj 0'dan büyük ve en fazla ${formatNumber(progress.remainingTons)} ton olmalı. Fatura tutarı ${formatMoney(progress.remainingTotal)} sınırını aşamaz.`}</p>}</div>}
          {progress.history.length>0 && <div className="mt-5 space-y-2"><h3 className="font-bold">Bu siparişin satış faturaları</h3>{progress.history.map((row:any)=><div key={row.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-100 p-3 text-sm"><span className="font-bold">{row.invoice_no || row.id}</span><span>{formatNumber(Number(row.tons))} ton · {formatMoney(row.amount)}</span><span className={row.state==='needs_review'||row.state==='created' ? "text-amber-800" : "text-emerald-800"}>{row.state==='needs_review'||row.state==='created' ? "Resmileştirme kontrolü bekliyor" : row.state==='legacy' ? "Kayıtlı fatura" : "Resmileştirme başlatıldı"}</span></div>)}</div>}
        </section>}
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Satış Faturası Önizleme
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Oluşturmadan önce kontrol et
              </h2>
            </div>

            <button
              type="button"
              onClick={createPreview}
              disabled={creating || !selectedCustomerId || invalidPart || !sourceLineId || Boolean(lineError) || linesLoading}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {creating ? "Hazırlanıyor..." : "Önizleme Oluştur"}
            </button>
          </div>

          {preview && (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-sm font-black text-slate-950">
                  Bayi: {preview.bayi || "-"}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Alış Faturası: {preview.matchedPurchaseInvoiceNo || "-"}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Müşteri carisi: {getContactName(selectedCustomer)} · VKN/TCKN: {getContactTaxNo(selectedCustomer) || "—"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[ ["KDV hariç tutar", preview.subtotal], ["KDV toplamı", preview.vatTotal], ["Ödenecek tutar · KDV dahil", preview.estimatedTotal] ].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-emerald-50 p-5"><p className="text-sm font-bold text-emerald-800">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{formatMoney(value)}</p></div>)}
              </div>
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Bu fatura: {formatNumber(preview.invoiceTons)} ton · Sonrasında kalan: {formatNumber(preview.remainingTons)} ton / {formatMoney(preview.remainingTotal)}<br />{preview.pricingNote}</p>
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="p-3">Ürün</th>
                      <th className="p-3">Açıklama</th>
                      <th className="p-3">Miktar</th>
                      <th className="p-3">Birim</th>
                      <th className="p-3">Birim Fiyat</th>
                      <th className="p-3">KDV oranı</th><th className="p-3">KDV tutarı</th><th className="p-3">KDV dahil toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.details || []).map((d: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="p-3 font-bold text-slate-800">
                          {d.product_name || "-"}
                        </td>
                        <td className="p-3 font-bold text-slate-800">
                          {d.description}
                        </td>
                        <td className="p-3 font-bold">
                          {formatNumber(numberValue(d.quantity))}
                        </td>
                        <td className="p-3 font-bold">{d.unit || "-"}</td>
                        <td className="p-3 font-bold">
                          {formatMoney(numberValue(d.unit_price))}
                        </td>
                        <td className="p-3 font-bold">
                          %{formatNumber(numberValue(d.vat_rate))}
                        </td><td className="p-3 font-bold">{formatMoney(d.vat_amount)}</td><td className="p-3 font-bold">{formatMoney(numberValue(d.subtotal) + numberValue(d.vat_amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800 ring-1 ring-amber-100">
                Seçilen alış kalemi ve KDV oranı aktarıldı. Müşteri, miktar, satış fiyatı ve KDV dahil toplamı kontrol ederek onaylayın.
              </div>

              <button
                type="button"
                onClick={createSalesInvoice}
                disabled={creating}
                className="w-full rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white disabled:opacity-50"
              >
                {creating
                  ? "Oluşturuluyor..."
                  : "Onayla ve Paraşüt’te Satış Faturası Oluştur"}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function findBestContactMatch(bayiName: string, contacts: any[]) {
  const bayi = normalizeText(bayiName || "");

  if (!bayi || !contacts.length) return null;

  let best: { contact: any; score: number } | null = null;

  for (const contact of contacts) {
    const name = normalizeText(getContactName(contact));

    if (!name || name === "-") continue;

    const bayiWords = bayi.split(" ").filter((x) => x.length > 2);
    const nameWords = name.split(" ").filter((x) => x.length > 2);
    const commonWords = bayiWords.filter((w) => nameWords.includes(w));

    let score = 0;

    if (name === bayi) {
      score = 100;
    } else if (name.includes(bayi)) {
      score = 92;
    } else if (bayi.includes(name)) {
      score = 88;
    } else if (commonWords.length > 0) {
      score = Math.round(
        (commonWords.length / Math.max(bayiWords.length, 1)) * 85
      );
    } else {
      score = similarityScore(bayi, name);
    }

    if (!best || score > best.score) {
      best = { contact, score };
    }
  }

  if (!best || best.score < 25) return null;

  return best;
}

function similarityScore(a: string, b: string) {
  const aa = normalizeText(a).split(" ").filter(Boolean);
  const bb = normalizeText(b).split(" ").filter(Boolean);

  if (!aa.length || !bb.length) return 0;

  const matches = aa.filter((x) => bb.includes(x)).length;
  return Math.round((matches / Math.max(aa.length, bb.length)) * 100);
}

function getContactName(c: any) {
  return (
    c?.name ||
    c?.display_name ||
    c?.company_name ||
    c?.attributes?.name ||
    c?.attributes?.display_name ||
    c?.attributes?.company_name ||
    c?.attributes?.account_name ||
    c?.raw?.attributes?.name ||
    c?.raw?.attributes?.display_name ||
    c?.email ||
    c?.id ||
    "-"
  );
}

function getContactTaxNo(c: any) {
  return onlyDigits(
    c?.tax_number ||
      c?.tax_no ||
      c?.vkn ||
      c?.tckn ||
      c?.identity_number ||
      c?.attributes?.tax_number ||
      c?.attributes?.tax_no ||
      c?.attributes?.vkn ||
      c?.attributes?.tckn ||
      c?.attributes?.identity_number ||
      c?.raw?.attributes?.tax_number ||
      c?.raw?.attributes?.tax_no ||
      c?.raw?.attributes?.vkn ||
      ""
  );
}

function onlyDigits(value: any) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value: any) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberValue(value: any) {
  if (typeof value === "number") return value;

  const raw = String(value || "").trim();

  if (!raw) return 0;

  if (/^-?\d+\.\d+$/.test(raw)) {
    return Number(raw);
  }

  const normalized = raw
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: any) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(numberValue(value));
}

function formatMoney(value: any) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(numberValue(value));
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-right text-sm font-black text-slate-900">
        {value || "-"}
      </p>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
