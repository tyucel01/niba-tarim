"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function FaturaKesPage() {
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

      const cachedContactsRaw = sessionStorage.getItem("parasut_contacts_cache");
      const cachedContactsAt = Number(
        sessionStorage.getItem("parasut_contacts_cache_at") || 0
      );
      const cacheAgeMs = Date.now() - cachedContactsAt;
      const cacheIsFresh = cachedContactsRaw && cacheAgeMs < 1000 * 60 * 30;

      if (cacheIsFresh) {
        try {
          const cachedContacts = JSON.parse(cachedContactsRaw);
          if (Array.isArray(cachedContacts)) {
            setContacts(cachedContacts);
            return;
          }
        } catch {
          sessionStorage.removeItem("parasut_contacts_cache");
          sessionStorage.removeItem("parasut_contacts_cache_at");
        }
      }

      let contactsRes = await fetch("/api/admin/parasut/contacts", {
        cache: "no-store",
      });

      if (contactsRes.status === 429) {
        await sleep(2500);
        contactsRes = await fetch("/api/admin/parasut/contacts", {
          cache: "no-store",
        });
      }

      const contactsData = await contactsRes.json().catch(() => null);

      if (!contactsRes.ok || !contactsData?.success) {
        if (cachedContactsRaw) {
          try {
            const staleContacts = JSON.parse(cachedContactsRaw);
            if (Array.isArray(staleContacts)) {
              setContacts(staleContacts);
              setContactError(
                "Paraşüt cari kart servisi şu an çok sık çağrıldı. Geçici olarak kayıtlı cari kart listesi kullanılıyor."
              );
              return;
            }
          } catch {
            sessionStorage.removeItem("parasut_contacts_cache");
            sessionStorage.removeItem("parasut_contacts_cache_at");
          }
        }

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

      const list = Array.isArray(rawContacts) ? rawContacts : [];

      setContacts(list);
      sessionStorage.setItem("parasut_contacts_cache", JSON.stringify(list));
      sessionStorage.setItem("parasut_contacts_cache_at", String(Date.now()));
    } catch (err: any) {
      alert(err?.message || "Veriler alınamadı.");
    } finally {
      setLoading(false);
    }
  }

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
            confirm: false,
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
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

  async function createSalesInvoice() {
    if (!order?.id) return;

    if (!selectedCustomerId) {
      alert("Önce Paraşüt müşteri cari kartı seç.");
      return;
    }

    const ok = window.confirm(
      "Bu işlem Paraşüt üzerinde satış faturası oluşturacaktır. Devam etmek istediğine emin misin?"
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
            confirm: true,
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        alert(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error || data, null, 2)
        );
        return;
      }

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
              <InfoRow
                label="Tonaj"
                value={`${formatNumber(numberValue(order.siparisTonaj))} ton`}
              />
              <InfoRow
                label="Satış Fiyatı"
                value={formatMoney(numberValue(order.pesinSatisFiyati))}
              />
              <InfoRow
                label="Bayi Satış Toplamı"
                value={formatMoney(numberValue(order.bayiSatisToplam))}
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
              disabled={creating || !selectedCustomerId}
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
                  Tahmini Toplam: {formatMoney(numberValue(preview.estimatedTotal))}
                </p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="p-3">Ürün</th>
                      <th className="p-3">Açıklama</th>
                      <th className="p-3">Miktar</th>
                      <th className="p-3">Birim</th>
                      <th className="p-3">Birim Fiyat</th>
                      <th className="p-3">KDV</th>
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl bg-red-50 p-4 text-sm font-black text-red-700 ring-1 ring-red-100">
                Bu işlem Paraşüt üzerinde satış faturası oluşturacaktır. Devam etmeden önce cari kartı, miktarı ve fiyatı kontrol et.
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
