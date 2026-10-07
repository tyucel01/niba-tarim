"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import SevkForm from "../sevk-form";
import { orderStage, stageLabels } from "@/lib/orders/workflow";

export default function SiparisDetayPage() {
  const params = useParams();
  const routeId = decodeURIComponent(String(params.id || ""));

  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<"satis" | "sevk" | "fatura">("sevk");
  useEffect(() => {
    const readHash = () => { const hash = window.location.hash.slice(1); setStage(hash === "satis" || hash === "fatura" ? hash : "sevk"); };
    readHash(); window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);
  const [siparis, setSiparis] = useState<any>(null);

  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [nextInvoicePage, setNextInvoicePage] = useState<number | null>(null);
  const [invoiceError, setInvoiceError] = useState("");
  const [openInvoiceDetails, setOpenInvoiceDetails] = useState<Record<string, boolean>>({});
  const [invoiceDetails, setInvoiceDetails] = useState<Record<string, any>>({});
  const [detailLoading, setDetailLoading] = useState("");
  const [detailError, setDetailError] = useState<Record<string, string>>({});
  const [matchingInvoice, setMatchingInvoice] = useState(false);

  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactError, setContactError] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");

  async function loadOrder() {
    try {
      setLoading(true);

      const res = await fetch(`/api/admin/siparisler?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!data.success) {
        setSiparis(null);
        return;
      }

      const row = (data.rows || []).find((x: any) => {
        return String(x.id) === routeId || String(x.satisId) === routeId;
      });

      setSiparis(row || null);
    } catch {
      setSiparis(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadPurchaseInvoices(page = 1) {
    try {
      setLoadingInvoices(true);
      setInvoiceError("");

      const res = await fetch(`/api/admin/parasut/gelen-faturalar?page=${page}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setInvoiceError("Gelen faturalar alınamadı. Yeniden deneyin.");
        setPurchaseInvoices([]);
        return;
      }

      const rawInvoices =
        data.invoices ||
        data.rows ||
        data.data ||
        data.items ||
        data.purchaseInvoices ||
        [];

      setPurchaseInvoices(previous => {
        const incoming = Array.isArray(rawInvoices) ? rawInvoices : [];
        return page === 1 ? incoming : [...previous, ...incoming.filter((row: any) => !previous.some(old => String(old.id) === String(row.id)))];
      });
      setNextInvoicePage(data.nextPage ?? null);
    } catch {
      setInvoiceError("Gelen faturalar yüklenemedi.");
      setPurchaseInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }

  async function loadContacts() {
    try {
      setLoadingContacts(true);
      setContactError("");

      const cached = localStorage.getItem("parasut_supplier_contacts_cache");

      if (cached) {
        const parsed = JSON.parse(cached);
        const age = Date.now() - Number(parsed.time || 0);

        if (age < 10 * 60 * 1000 && Array.isArray(parsed.items)) {
          setContacts(parsed.items);
          return;
        }
      }

      let res = await fetch("/api/admin/parasut/contacts", {
        cache: "no-store",
      });

      if (res.status === 429) {
        await sleep(1800);
        res = await fetch("/api/admin/parasut/contacts", {
          cache: "no-store",
        });
      }

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setContactError(
          res.status === 429
            ? "Paraşüt cari kart servisi çok sık çağrıldı. Biraz bekleyip sayfayı yenile."
            : data?.error || "Cari kartlar alınamadı."
        );
        setContacts([]);
        return;
      }

      const rawContacts =
        data.contacts ||
        data.items ||
        data.data ||
        data.rows ||
        [];

      const cleanContacts = Array.isArray(rawContacts) ? rawContacts : [];

      setContacts(cleanContacts);

      localStorage.setItem(
        "parasut_supplier_contacts_cache",
        JSON.stringify({
          time: Date.now(),
          items: cleanContacts,
        })
      );
    } catch {
      setContacts([]);
      setContactError("Cari kartlar yüklenemedi.");
    } finally {
      setLoadingContacts(false);
    }
  }

  async function loadInvoiceDetail(invoice: any) {
    const id = String(invoice.id);
    if (invoiceDetails[id] || detailLoading) return;
    setDetailLoading(id);
    setDetailError(previous => ({ ...previous, [id]: "" }));
    try {
      const response = await fetch(`/api/admin/parasut/gelen-faturalar?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Fatura detayı alınamadı.");
      setInvoiceDetails(previous => ({ ...previous, [id]: data.invoice }));
    } catch (error: any) { setDetailError(previous => ({ ...previous, [id]: error.message })); }
    finally { setDetailLoading(""); }
  }

  async function matchInvoice(invoice: any) {
    if (!siparis?.id) return;
    if (matchingInvoice) return;

    if (!selectedSupplierId) {
      alert("Önce cari kart seç veya önerilen cari kartı onayla.");
      return;
    }

    const selectedContact = contacts.find(
      (c) => String(c.id) === String(selectedSupplierId)
    );

    const taxNo = getInvoiceSupplierTaxNo(invoice);
    if (!taxNo || taxNo !== getContactTaxNo(selectedContact)) {
      alert("Faturanın VKN/TCKN bilgisi seçili cari ile birebir eşleşmiyor. Cari kartı kontrol edin."); return;
    }
    const detail = invoiceDetails[String(invoice.id)];
    if (!detail) { alert("Önce fatura detayını açıp kontrol edin."); return; }
    const available = invoice.remaining_amount ?? detail.net_total;
    if (numberValue(available) < calc.toplamAlisTutari) { alert("Faturanın kalan tutarı bu sipariş için yetersiz."); return; }
    const confirmText = selectedContact
      ? `${getContactName(selectedContact)}\nFatura: ${getInvoiceNo(invoice)}\nFatura tutarı: ${formatInvoiceMoney(detail.net_total, detail.currency)}\nSiparişten beklenen: ${formatMoney(calc.toplamAlisTutari)}\nBu siparişe ayrılacak: ${formatMoney(calc.toplamAlisTutari)}\nFaturada kalacak: ${formatInvoiceMoney(numberValue(available) - calc.toplamAlisTutari, detail.currency)}\nFatura kalemlerini ve tutarı kontrol ettiniz mi? Giderleştirmeyi onaylıyor musunuz?`
      : "Seçilen cari karta gider kaydı atılacak. Onaylıyor musun?";

    if (!window.confirm(confirmText)) return;

    try {
      setMatchingInvoice(true);

      const res = await fetch("/api/admin/parasut/e-invoice/import-and-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          siparisId: siparis.id,
          eInvoiceId: invoice.id,
          supplierId: selectedSupplierId,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(
          data.step
            ? `${data.step} aşamasında hata: ${data.message || JSON.stringify(data.error)}`
            : data.error || "Fatura giderleştirme başarısız."
        );
        return;
      }

      if (data.order) {
        setSiparis(data.order);
      } else {
        await loadOrder();
      }

      await loadPurchaseInvoices();
      alert(
        `✅ Fatura giderlere kaydedildi ve siparişle eşleştirildi.\n\nGider ID: ${
          data.purchaseBillId || "-"
        }\nFatura No: ${data.purchaseBillNo || "-"}\nBu siparişe ayrılan: ${formatMoney(data.allocatedAmount)}\nFaturada kalan: ${formatMoney(data.remainingAmount)}`
      );
    } catch (err: any) {
      alert(err?.message || "Hata oluştu.");
    } finally {
      setMatchingInvoice(false);
    }
  }

  useEffect(() => {
    setSelectedSupplierId(""); setSupplierSearch(""); setInvoiceDetails({});
    if (routeId) loadOrder();
  }, [routeId]);

  useEffect(() => {
    if (!siparis?.id || stage !== "fatura") return;
    loadPurchaseInvoices();
    loadContacts();
  }, [siparis?.id, stage]);

  const calc = useMemo(() => {
    const alisFiyati = numberValue(siparis?.alisFiyati);
    const pesinSatisFiyati = numberValue(siparis?.pesinSatisFiyati);
    const siparisTonaj = numberValue(siparis?.siparisTonaj);
    const teslimOlanTonaj = numberValue(siparis?.teslimOlanTonaj);
    const bayiSatisToplam =
      numberValue(siparis?.bayiSatisToplam) || pesinSatisFiyati * siparisTonaj;
    const toplamAlisTutari =
      numberValue(siparis?.tedarikciyeOdenecekTutar) || alisFiyati * siparisTonaj;
    const tonBasiKar = pesinSatisFiyati - alisFiyati;
    const toplamKar = bayiSatisToplam - toplamAlisTutari;
    const eksikTonaj = Math.max(siparisTonaj - teslimOlanTonaj, 0);

    return {
      alisFiyati,
      pesinSatisFiyati,
      siparisTonaj,
      teslimOlanTonaj,
      bayiSatisToplam,
      toplamAlisTutari,
      tonBasiKar,
      toplamKar,
      eksikTonaj,
    };
  }, [siparis]);

  const status = getInvoiceStatus(siparis);

  const bestMatch = useMemo(() => {
    const supplier = normalizeText(siparis?.tedarikciler);
    if (!supplier) return null;
    const candidates = contacts.map(contact => {
      const name = normalizeText(getContactName(contact));
      const score = name === supplier ? 100 : name.includes(supplier) || supplier.includes(name) ? 88 : similarityScore(supplier, name);
      return { contact, score, reason: "Sipariş tedarikçisi ile isim eşleşmesi" };
    }).filter(candidate => candidate.score >= 60).sort((a,b) => b.score - a.score);
    if (!candidates.length || candidates[1]?.score === candidates[0].score) return null;
    return candidates[0];
  }, [siparis, purchaseInvoices, contacts]);

  useEffect(() => {
    if (selectedSupplierId) return;


    if (siparis?.tedarikciler && !supplierSearch) {
      setSupplierSearch(siparis.tedarikciler);
    }
  }, [bestMatch?.contact?.id, selectedSupplierId, siparis?.tedarikciler]);

  const searchedContacts = useMemo(() => {
    const q = normalizeText(supplierSearch);

    if (!q) return contacts.slice(0, 80);

    return contacts
      .filter((c) => {
        const text = normalizeText(
          `${getContactName(c)} ${getContactTaxNo(c)} ${c.email || ""}`
        );
        const qWords = q.split(" ").filter((x) => x.length > 1);

        return text.includes(q) || qWords.every((w) => text.includes(w));
      })
      .slice(0, 80);
  }, [contacts, supplierSearch]);

  const selectedContact = contacts.find(
    (c) => String(c.id) === String(selectedSupplierId)
  );

  const filteredInvoices = selectedContact
    ? purchaseInvoices.filter((invoice) => {
        const invoiceSupplier = normalizeText(getInvoiceSupplierName(invoice));
        const invoiceTaxNo = getInvoiceSupplierTaxNo(invoice);
        const contactName = normalizeText(getContactName(selectedContact));
        const contactTaxNo = getContactTaxNo(selectedContact);

        if (invoiceTaxNo && contactTaxNo) return invoiceTaxNo === contactTaxNo;
        return (
          (invoiceTaxNo && contactTaxNo && invoiceTaxNo === contactTaxNo) ||
          (invoiceSupplier && contactName && invoiceSupplier.includes(contactName)) ||
          (invoiceSupplier && contactName && contactName.includes(invoiceSupplier))
        );
      })
    : [];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef1ea]">
        <div className="rounded-3xl bg-white px-6 py-5 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-100">
          Yükleniyor...
        </div>
      </main>
    );
  }

  if (!siparis) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef1ea] p-4">
        <div className="max-w-md rounded-[28px] bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
          <div className="text-4xl">📦</div>
          <h1 className="mt-3 text-xl font-black text-slate-950">
            Sipariş bulunamadı
          </h1>
          <Link
            href="/admin/siparisler"
            className="mt-5 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
          >
            Siparişlere Dön
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7f4] p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <Link href="/admin/siparisler" className="text-sm font-semibold text-emerald-800">← Siparişler</Link>
        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm text-slate-500">Sipariş #{siparis.satisId || siparis.id} · {formatDate(siparis.satisTarihi)}</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">{siparis.bayi || 'Sipariş'}</h1><p className="mt-2 text-sm text-slate-500">{siparis.urun} · {siparis.marka} · {formatNumber(calc.siparisTonaj)} ton</p></div><span className="w-fit rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">{stageLabels[orderStage(siparis)]}</span></header>
        <nav aria-label="Sipariş aşamaları" className="grid grid-cols-3 gap-2">
          {([['satis', '1. Alış–satış'], ['sevk', '2. Plaka–sevk'], ['fatura', '3. Fatura']] as const).map(([value, label]) => <a key={value} href={`#${value}`} aria-current={stage === value ? 'step' : undefined} className={`rounded-xl px-2 py-4 text-center text-sm font-bold ${stage === value ? 'bg-emerald-700 text-white' : 'border border-slate-200 bg-white text-slate-500'}`}>{label}</a>)}
        </nav>
        <div hidden={stage !== 'satis'} className="space-y-5">
            <Card title="Ticari Özet" subtitle="Alış, satış ve kârlılık bilgileri">
              <div className="grid gap-3 md:grid-cols-2">
                <Info label="Bayi" value={siparis.bayi} />
                <Info label="Tedarikçi" value={siparis.tedarikciler} />
                <Info label="Sipariş Alan" value={siparis.siparisAlan} />
                <Info label="Satış Türü" value={siparis.satisTuru} />
                <Info label="Ürün" value={siparis.urun} />
                <Info label="Marka" value={siparis.marka} />
              </div>
            </Card>

            <Card title="Fiyat ve Tutarlar" subtitle="Alış fiyatı, toplam alış ve satış toplamı">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <MoneyBox label="Alış Fiyatımız" value={calc.alisFiyati} />
                <MoneyBox label="Toplam Alış Tutarı" value={calc.toplamAlisTutari} />
                <MoneyBox label="Peşin Satış Fiyatı" value={calc.pesinSatisFiyati} />
                <MoneyBox label="Bayi Satış Toplamı" value={calc.bayiSatisToplam} highlight />
                <MoneyBox label="Ton Başı Kar" value={calc.tonBasiKar} />
                <MoneyBox label="Toplam Kar" value={calc.toplamKar} highlight />
              </div>
            </Card>


          <div className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">{siparis.not || 'Bu sipariş için not eklenmemiş.'}</p><a href="#sevk" className="mt-4 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Plaka ve sevk bilgilerine geç →</a></div>
        </div>
        <div hidden={stage !== 'sevk'} className="space-y-5">
          <SevkForm key={String(siparis.id)} order={siparis} onSaved={setSiparis} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Sipariş: {formatNumber(calc.siparisTonaj)} ton · Teslim: {formatNumber(calc.teslimOlanTonaj)} ton · Kalan: {formatNumber(calc.eksikTonaj)} ton</div>
        </div>
        <div hidden={stage !== 'fatura'} className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-bold">Muhasebe / Fatura işlemleri</h2><p className="mt-2 text-sm text-slate-500">Tedarikçi cari kartını ve alış faturasını kontrol ederek satış faturasına geç.</p>
            <div className="mt-4 flex flex-wrap gap-2">{[[status.sevkOk, 'Sevk'], [status.gtsOk, 'GTS'], [status.alisOk, 'Alış faturası']].map(([ok, label]) => <span key={String(label)} className={`rounded-full px-3 py-2 text-xs font-bold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{String(label)}: {ok ? 'Tamam' : 'Bekliyor'}</span>)}</div>
            {siparis.sales_invoice_id || siparis.sales_invoice_no ? <p className="mt-4 font-bold text-emerald-800">Satış faturası oluşturuldu: {siparis.sales_invoice_no || siparis.sales_invoice_id}</p> : status.canInvoice ? <Link href={`/admin/siparisler/fatura-kes?siparisId=${encodeURIComponent(String(siparis.id))}`} prefetch={false} className="mt-4 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Paraşüt’te satış faturası kes →</Link> : <p className="mt-4 text-sm text-slate-500">Satış faturası için sevk, GTS ve alış faturası kontrollerini tamamla.</p>}
          </section>
          <section className="grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:grid-cols-2">
            <div><p className="text-sm font-bold text-emerald-800">Beklenen alış faturası tutarı</p><p className="mt-2 text-2xl font-black">{formatMoney(calc.toplamAlisTutari)}</p><p className="mt-1 text-sm text-slate-600">{formatNumber(calc.siparisTonaj)} ton × {formatMoney(calc.alisFiyati)} / ton · Siparişte kayıtlı alış tutarı</p></div>
            <div><p className="text-sm font-bold text-emerald-800">Beklenen satış faturası tutarı</p><p className="mt-2 text-2xl font-black">{formatMoney(calc.bayiSatisToplam)}</p><p className="mt-1 text-sm text-slate-600">Siparişte kayıtlı satış tutarı. KDV ve sevk miktarını fatura kalemleriyle kontrol edin.</p></div>
          </section>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="min-w-0">
            <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                  Tedarikçi Cari Eşleşmesi
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  Paraşüt Cari Kartı
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Alış faturasını giderleştirmek için doğru tedarikçi cari kartını seç.
                </p>
              </div>

              {contactError && (
                <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 ring-1 ring-red-100">
                  {contactError}
                </div>
              )}

              {loadingContacts ? (
                <EmptyBox text="Cari kartlar yükleniyor..." />
              ) : bestMatch?.contact ? (
                <div className="mt-5 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                  <p className="text-xs font-black text-emerald-700">
                    Tahmini Eşleşme
                  </p>
                  <p className="mt-1 text-sm font-black text-emerald-950">
                    {getContactName(bestMatch.contact)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-emerald-800">
                    {bestMatch.reason} · Benzerlik: %{bestMatch.score}<br />VKN/TCKN: {getContactTaxNo(bestMatch.contact) || "-"}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSupplierId(String(bestMatch.contact.id));
                      setSupplierSearch(getContactName(bestMatch.contact));
                    }}
                    className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white"
                  >
                    Bu cari kartı kullan
                  </button>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800 ring-1 ring-amber-100">
                  Otomatik cari eşleşmesi bulunamadı. Aşağıdan arayarak seç.
                </div>
              )}

              <div className="mt-5">
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                  Cari Kart Ara / Değiştir
                </label>

                <p className="mb-2 text-xs font-bold text-slate-400">
                  Yüklenen cari kart: {contacts.length} · Filtrelenen: {searchedContacts.length}
                </p>

                <input
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  placeholder="Tedarikçi adı veya VKN yaz..."
                  className="mb-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold outline-none focus:border-emerald-400"
                />

                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold outline-none focus:border-emerald-400"
                >
                  <option value="">Cari kart seç</option>

                  {selectedContact && !searchedContacts.some(c => String(c.id) === String(selectedContact.id)) && <option value={selectedContact.id}>{getContactName(selectedContact)}</option>}
                  {searchedContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {getContactName(c)} {getContactTaxNo(c) ? `- ${getContactTaxNo(c)}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSupplierId && selectedContact && (
                <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-300">
                    Seçili Cari Kart
                  </p>
                  <p className="mt-1 text-sm font-black">
                    {getContactName(selectedContact)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-white/60">
                    VKN/TCKN: {getContactTaxNo(selectedContact) || "-"}
                  </p>
                </div>
              )}
            </section>
            </div><div className="min-w-0">
            <Card title="Gelen E-Faturalar" subtitle="Seçili tedarikçi cari kartına ait gelen e-faturaları gösterir">
              {siparis.matched_purchase_invoice_no && (
                <div className="mb-4 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                    Mevcut Eşleşme
                  </p>
                  <p className="mt-1 text-sm font-black text-emerald-950">
                    {siparis.matched_purchase_invoice_no}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-emerald-800">
                    {siparis.matched_purchase_invoice_total == null ? "Tutar bilgisi kayıtlı değil" : `Fatura toplamı: ${formatMoney(siparis.matched_purchase_invoice_total)}`}
                    {siparis.matched_purchase_allocated_amount != null && <span className="mt-1 block">Bu siparişe ayrılan: {formatMoney(siparis.matched_purchase_allocated_amount)}</span>}
                  </p>
                </div>
              )}

              {invoiceError && <div role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{invoiceError} <button type="button" onClick={() => loadPurchaseInvoices()} className="underline">Yeniden dene</button></div>}
              {loadingInvoices ? (
                <EmptyBox text="Faturalar yükleniyor..." />
              ) : !selectedContact ? (
                <EmptyBox text="Önce tedarikçi cari kart seç." />
              ) : filteredInvoices.length === 0 ? (
                <EmptyBox text="Seçili cariye ait gelen e-fatura bulunamadı." />
              ) : (
                <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                  {filteredInvoices.map((invoice) => {
                    const invoiceNo = getInvoiceNo(invoice);
                    const supplier = getInvoiceSupplierName(invoice);
                    const vkn = getInvoiceSupplierTaxNo(invoice);
                    const detail = invoiceDetails[String(invoice.id)];
                    const total = detail?.net_total ?? getInvoiceTotal(invoice);
                    const currency = detail?.currency || invoice.attributes?.currency || "TRL";
                    const taxMatches = Boolean(vkn && vkn === getContactTaxNo(selectedContact));
                    const rowMatch = findBestContactMatch(siparis, invoice, contacts);

                    return (
                      <div
                        key={invoice.id || invoiceNo}
                        className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-black text-slate-950">
                              {invoiceNo}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {supplier}
                            </p>
                            <p className="mt-1 text-[11px] font-bold text-slate-400">
                              VKN/TCKN: {vkn || "-"}
                            </p>

                            {rowMatch?.contact && (
                              <p className="mt-2 text-[11px] font-black text-emerald-700">
                                Öneri: {getContactName(rowMatch.contact)} · %{rowMatch.score}
                              </p>
                            )}
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-black text-emerald-700">
                              {total === null ? "Tutar için detayı açın" : formatInvoiceMoney(total, currency)}
                            </p>
                          </div>
                        </div>

                        {invoice.reusable && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm"><p className="font-bold text-emerald-800">Kalan tutarı kullanılabilir · Yeni gider kaydı oluşturulmaz</p><p className="mt-1">Toplam: {formatInvoiceMoney(total, currency)} · Ayrılan: {formatInvoiceMoney(invoice.allocated_amount, currency)} · Kalan: {formatInvoiceMoney(invoice.remaining_amount, currency)}</p></div>}
                        <p className="mt-3 text-sm text-slate-600">Fatura tarihi: {formatDate(detail?.issue_date || invoice.attributes?.issue_date)}</p>
                        <p className={`mt-2 text-sm font-bold ${taxMatches ? "text-emerald-700" : "text-amber-800"}`}>{taxMatches ? "VKN/TCKN seçili cariyle birebir eşleşiyor" : "VKN/TCKN doğrulanamadı; giderleştirme kapalı"}</p>
                        <div className="mt-4">
                          <button type="button" aria-expanded={Boolean(openInvoiceDetails[String(invoice.id)])} onClick={() => { setOpenInvoiceDetails(previous => ({ ...previous, [String(invoice.id)]: !previous[String(invoice.id)] })); void loadInvoiceDetail(invoice); }} className="cursor-pointer text-sm font-bold text-emerald-800">Fatura detayını göster / kontrol et</button>
                          {openInvoiceDetails[String(invoice.id)] && <div>
                          {detailLoading === String(invoice.id) && <p className="mt-3 text-sm">Detaylar yükleniyor…</p>}
                          {detailError[String(invoice.id)] && <p role="alert" className="mt-3 text-sm text-red-700">{detailError[String(invoice.id)]} <button type="button" onClick={() => loadInvoiceDetail(invoice)} className="underline">Yeniden dene</button></p>}
                          {detail && <div className="mt-3 space-y-3">
                            <p className="text-sm">Ara toplam: {formatInvoiceMoney(detail.gross_total, currency)} · KDV: {formatInvoiceMoney(detail.total_vat, currency)} · Genel toplam: {formatInvoiceMoney(detail.net_total, currency)}</p>
                            {detail.net_total != null && (currency === "TRL" || currency === "TRY") && <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold">Sipariş tutarıyla fark: {formatMoney(numberValue(detail.net_total) - calc.toplamAlisTutari)}. Miktar, birim fiyat ve KDV kapsamını kontrol edin.</p>}
                            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Ürün / açıklama</th><th className="p-2">Miktar</th><th className="p-2">Birim fiyat</th><th className="p-2">KDV</th><th className="p-2">Kalem tutarı</th></tr></thead><tbody>{detail.details.map((line: any, index: number) => <tr key={index} className="border-t border-slate-200"><td className="p-2">{line.product_mapping_name || line.description || "—"}</td><td className="p-2">{formatNumber(line.quantity)} {line.unit || line.unit_name || line.unit_code || ""}</td><td className="p-2">{formatInvoiceMoney(line.unit_price, currency)}</td><td className="p-2">%{formatNumber(line.vat_rate)}</td><td className="p-2">{formatInvoiceMoney(line.net_total, currency)}</td></tr>)}</tbody></table></div>
                            {!detail.details.length && <p className="text-sm text-amber-800">Fatura kalemleri alınamadı; giderleştirme kapalı.</p>}
                          </div>}
                          </div>}
                        </div>
                        <button
                          type="button"
                          disabled={matchingInvoice || !selectedSupplierId || !taxMatches || !detail?.details?.length || detail?.net_total == null || (invoice.remaining_amount != null && numberValue(invoice.remaining_amount) < calc.toplamAlisTutari)}
                          onClick={() => matchInvoice(invoice)}
                          className={`mt-4 w-full rounded-xl px-4 py-3 text-xs font-black transition ${
                            selectedSupplierId
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "cursor-not-allowed bg-slate-200 text-slate-400"
                          }`}
                        >
                          {selectedSupplierId
                            ? matchingInvoice
                              ? "Giderleştiriliyor..."
                              : invoice.reusable ? "Kalan tutardan bu siparişe pay ayır ve eşleştir" : "Faturayı giderleştir ve bu siparişe pay ayır"
                            : "Önce cari kart seç"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {nextInvoicePage && <button type="button" disabled={loadingInvoices} onClick={() => loadPurchaseInvoices(nextInvoicePage)} className="mt-4 w-full rounded-xl border border-emerald-200 p-3 text-sm font-bold text-emerald-800">Daha eski gelen faturaları yükle</button>}
            </Card>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div>
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MoneyBox({ label, value, highlight = false }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ring-1 ${highlight ? "bg-emerald-50 ring-emerald-100" : "bg-slate-50 ring-slate-100"}`}>
      <p className={`text-xs font-black uppercase tracking-wide ${highlight ? "text-emerald-700" : "text-slate-400"}`}>
        {label}
      </p>
      <p className={`mt-2 text-lg font-black ${highlight ? "text-emerald-900" : "text-slate-950"}`}>
        {formatMoney(value)}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
      <span className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-right text-sm font-black text-slate-950">{value || "-"}</span>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500 ring-1 ring-slate-100">
      {text}
    </div>
  );
}

function getInvoiceStatus(s: any) {
  const sevkDurumu = String(s?.sevkDurumu || "").toLowerCase();
  const gts = String(s?.gts || "").toLowerCase();
  const alis = String(s?.gelenFatura || s?.matched_purchase_invoice_no || "").toLowerCase();

  const sevkOk =
    sevkDurumu.includes("evet") ||
    sevkDurumu.includes("sevk edildi") ||
    sevkDurumu.includes("tamam") ||
    sevkDurumu.includes("yapildi") ||
    sevkDurumu.includes("yapıldı");

  const gtsOk =
    gts.includes("evet") ||
    gts.includes("girildi") ||
    gts.includes("cikis") ||
    gts.includes("çıkış") ||
    gts.includes("yapildi") ||
    gts.includes("yapıldı");

  const alisOk =
    Boolean(alis) &&
    !["hayir", "hayır", "yok", "false", "0", "bekliyor"].includes(alis);

  return {
    sevkOk,
    gtsOk,
    alisOk,
    canInvoice: sevkOk && gtsOk && alisOk,
  };
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

function getInvoiceNo(invoice: any) {
  return (
    invoice?.invoice_no ||
    invoice?.invoiceNo ||
    invoice?.number ||
    invoice?.attributes?.invoice_no ||
    invoice?.attributes?.invoice_id ||
    invoice?.attributes?.document_no ||
    invoice?.raw?.attributes?.external_id ||
    invoice?.id ||
    "-"
  );
}

function getInvoiceSupplierName(invoice: any) {
  return (
    invoice?.supplier_name ||
    invoice?.contact_name ||
    invoice?.supplier?.name ||
    invoice?.contact?.name ||
    invoice?.attributes?.supplier_name ||
    invoice?.attributes?.contact_name ||
    invoice?.attributes?.sender_name ||
    invoice?.raw?.attributes?.contact_name ||
    "-"
  );
}

function getInvoiceSupplierTaxNo(invoice: any) {
  return onlyDigits(
    invoice?.attributes?.from_vkn ||
      invoice?.raw?.attributes?.from_vkn ||
      invoice?.from_vkn ||
      invoice?.supplier_vkn ||
      invoice?.supplier_tax_number ||
      ""
  );
}

function getInvoiceTotal(invoice: any) {
  const value = invoice?.net_total ?? invoice?.total_amount ?? invoice?.attributes?.net_total ?? invoice?.attributes?.total_amount;
  return value == null || value === "" ? null : numberValue(value);
}

function formatInvoiceMoney(value: any, currency: string) {
  if (value == null || value === "") return "Bilgi alınamadı";
  const code = currency === "TRL" ? "TRY" : currency;
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: /^[A-Z]{3}$/.test(code) ? code : "TRY" }).format(numberValue(value));
}

function findBestContactMatch(order: any, invoice: any, contacts: any[]) {
  if (!contacts.length) return null;

  const orderSupplier = normalizeText(order?.tedarikciler || "");
  const invoiceSupplier = normalizeText(getInvoiceSupplierName(invoice));
  const invoiceTaxNo = getInvoiceSupplierTaxNo(invoice);

  let best: { contact: any; score: number; reason: string } | null = null;

  for (const contact of contacts) {
    const contactName = normalizeText(getContactName(contact));
    const contactTaxNo = getContactTaxNo(contact);

    let score = 0;
    let reason = "";

    if (invoiceTaxNo && contactTaxNo && invoiceTaxNo === contactTaxNo) {
      score = 100;
      reason = "VKN/TCKN birebir eşleşti";
    } else if (orderSupplier && contactName && contactName.includes(orderSupplier)) {
      score = 88;
      reason = "Sipariş tedarikçisi cari adında bulundu";
    } else if (orderSupplier && contactName && orderSupplier.includes(contactName)) {
      score = 84;
      reason = "Cari adı sipariş tedarikçisinde bulundu";
    } else if (invoiceSupplier && contactName && contactName.includes(invoiceSupplier)) {
      score = 82;
      reason = "Fatura tedarikçisi cari adında bulundu";
    } else if (invoiceSupplier && contactName && invoiceSupplier.includes(contactName)) {
      score = 78;
      reason = "Cari adı fatura tedarikçisinde bulundu";
    } else {
      score = similarityScore(`${orderSupplier} ${invoiceSupplier}`, contactName);
      reason = "İsim benzerliği";
    }

    if (!best || score > best.score) {
      best = { contact, score, reason };
    }
  }

  if (!best || best.score < 35) return null;

  return best;
}

function similarityScore(a: string, b: string) {
  const aa = normalizeText(a).split(" ").filter(Boolean);
  const bb = normalizeText(b).split(" ").filter(Boolean);

  if (!aa.length || !bb.length) return 0;

  const matches = aa.filter((x) => bb.includes(x)).length;
  return Math.round((matches / Math.max(aa.length, bb.length)) * 100);
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

function formatDate(value: any) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("tr-TR");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
