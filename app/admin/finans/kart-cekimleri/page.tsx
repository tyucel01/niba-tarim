"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ParatikaTahsilat from "./paratika-tahsilat";
import {usePanelDialog} from "@/app/admin/ui/panel-dialog";

type Contact = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  taxNumber?: string;
  city?: string;
};

type CardTransaction = {
  id: string;
  party_type: "supplier" | "customer";
  transaction_type: "payment" | "collection";
  parasut_contact_id: string;
  company_name: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  payment_channel: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  pos_payment_id?: string | null;
};

const CONTACTS_CACHE_KEY = "parasut_contacts_cache_v1";
// Contacts stay cached until the user explicitly refreshes them.

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("İ", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
}

export default function KartCekimleriPage() {
  const {panelConfirm}=usePanelDialog();
  const [tab,setTab]=useState<'collect'|'manual'|'history'>('collect');
  const [feedback,setFeedback]=useState<{text:string;tone:'error'|'success'}|null>(null);
  const [historySearch,setHistorySearch]=useState('');
  const [historySource,setHistorySource]=useState('all');
  function notify(text:string){setFeedback({text,tone:'error'});}
  const contactsRequest=useRef<Promise<void>|null>(null);
  const [contactsUpdatedAt,setContactsUpdatedAt]=useState<number|null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [partyType, setPartyType] = useState<"supplier" | "customer">("supplier");
  const [transactionType, setTransactionType] = useState<"payment" | "collection">("payment");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [transactionDate, setTransactionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentChannel, setPaymentChannel] = useState("");

  const selectedContact = contacts.find((item) => item.id === selectedContactId);

  const filteredContacts = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return contacts;

    return contacts.filter((item) => {
      const haystack = normalizeText(
        `${item.name || ""} ${item.taxNumber || ""} ${item.city || ""}`
      );

      return item.id===selectedContactId||haystack.includes(q);
    });
  }, [contacts, search, selectedContactId]);

  const totals = useMemo(() => {
    const payment = transactions
      .filter((x) => x.transaction_type === "payment")
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);

    const collection = transactions
      .filter((x) => x.transaction_type === "collection")
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);

    return { payment, collection, count: transactions.length };
  }, [transactions]);

  const visibleTransactions=useMemo(()=>transactions.filter(item=>{
    const match=normalizeText(`${item.company_name} ${item.description||''} ${item.payment_channel||''}`).includes(normalizeText(historySearch.trim()));
    return match&&(historySource==='all'||(historySource==='pos'?!!item.pos_payment_id:!item.pos_payment_id));
  }),[transactions,historySearch,historySource]);

  function getCachedContacts() {
    try {
      const raw = localStorage.getItem(CONTACTS_CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.contacts)) return null;

      setContactsUpdatedAt(typeof parsed.createdAt==='number'?parsed.createdAt:null);
      return parsed.contacts as Contact[];
    } catch {
      return null;
    }
  }

  function setCachedContacts(nextContacts: Contact[]) {
    const updatedAt=Date.now();setContactsUpdatedAt(updatedAt);
    try {
      localStorage.setItem(
        CONTACTS_CACHE_KEY,
        JSON.stringify({
          createdAt: updatedAt,
          contacts: nextContacts,
        })
      );
    } catch {}
  }

  async function loadContacts(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = getCachedContacts();
      if (cached) {
        setContacts(cached);
        return;
      }
    }

    if(contactsRequest.current)return contactsRequest.current;
    const request=async()=>{
    setLoadingContacts(true);

    try {
      const response = await fetch(`/api/admin/parasut/contacts${forceRefresh?'?refresh=1':''}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!data.ok) {
        notify(data.error || "Paraşüt carileri alınamadı");
        return;
      }

      const nextContacts = data.contacts || [];
      setContacts(nextContacts);
      setCachedContacts(nextContacts);
    } catch {
      notify("Paraşüt carileri alınırken hata oluştu");
    } finally {
      setLoadingContacts(false);
    }
    };
    contactsRequest.current=request();
    try{await contactsRequest.current;}finally{contactsRequest.current=null;}
  }

  async function loadTransactions() {
    setLoadingTransactions(true);

    try {
      const response = await fetch("/api/admin/parasut/card-transactions", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!data.ok) {
        notify(
          `${data.error || "Kayıt oluşturulamadı"}\n\nDetay:\n${
            typeof data.detail === "string"
              ? data.detail
              : JSON.stringify(data.detail, null, 2)
          }`
        );
        return;
      }

      setTransactions(data.transactions || []);
    } catch {
      notify("Kart çekimleri alınırken hata oluştu");
    } finally {
      setLoadingTransactions(false);
    }
  }

  useEffect(() => {
    loadContacts(false);
    loadTransactions();
  }, []);

  useEffect(() => {
    setTransactionType(partyType === "supplier" ? "payment" : "collection");
  }, [partyType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedContactId) return notify("Lütfen cari seçin");
    if (!amount || Number(amount) <= 0) return notify("Lütfen geçerli tutar girin");

    const confirmText =
      `${selectedContact?.name || "Seçili cari"} için ${Number(amount).toLocaleString("tr-TR")} TL ` +
      `${transactionType === "payment" ? "ödeme" : "tahsilat"} kaydı oluşturulacak. Onaylıyor musunuz?`;

    if (!await panelConfirm(confirmText)) return;

    setSaving(true);

    try {
      const response = await fetch("/api/admin/parasut/card-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_type: partyType,
          transaction_type: transactionType,
          parasut_contact_id: selectedContactId,
          company_name: selectedContact?.name || "",
          transaction_date: transactionDate,
          amount: Number(amount),
          description,
          payment_channel: paymentChannel,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        notify(
          `${data.error || "Kayıt oluşturulamadı"}\n\nDetay:\n${
            typeof data.detail === "string"
              ? data.detail
              : JSON.stringify(data.detail, null, 2)
          }`
        );
        return;
      }

      setSelectedContactId("");
      setAmount("");
      setDescription("");
      setPaymentChannel("");
      setSearch("");

      await loadTransactions();
      setFeedback({text:"Kayıt Paraşüt’e işlendi. Karttan yeni bir çekim yapılmadı.",tone:"success"});
      setTab("history");
    } catch {
      notify("Kayıt sırasında hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, companyName: string) {
    if (!await panelConfirm(`${companyName || "Bu kayıt"} silinsin mi? Paraşüt’e işlenen cari hareketi de silinecek.`)) return;

    setDeletingId(id);

    try {
      const response = await fetch(`/api/admin/parasut/card-transactions?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.ok) {
        notify(data.error || "Kayıt silinemedi");
        return;
      }

      await loadTransactions();
    } catch {
      notify("Silme sırasında hata oluştu");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f4] px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col justify-between gap-5 rounded-3xl border border-slate-200 bg-white p-5 md:flex-row md:items-center md:p-7">
          <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Finans</p><h1 className="mt-1 text-3xl font-black tracking-tight">Kart Çekimleri</h1><p className="mt-2 text-sm text-slate-500">Karttan tahsilat alın, dışarıda yapılan çekimi kaydedin veya geçmişi inceleyin.</p></div>
          <button type="button" disabled={loadingContacts} onClick={()=>loadContacts(true)} className="shrink-0 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">{loadingContacts?'Cariler yenileniyor…':'Paraşüt carilerini yenile'}</button>
        </header>
        <p className="mb-4 px-1 text-xs text-slate-500">{contacts.length} cari kayıtlı{contactsUpdatedAt?` · Son güncelleme: ${new Date(contactsUpdatedAt).toLocaleString('tr-TR')}`:''} · Arama kayıtlı listede yapılır. Yeni cari eklediyseniz yukarıdan yenileyin.</p>
        <nav aria-label="Kart işlemleri" className="mb-5 grid gap-2 rounded-2xl bg-slate-200/60 p-2 md:grid-cols-3">
          {([{id:'collect',title:'Karttan Tahsilat',description:'Sanal POS ile yeni çekim'},{id:'manual',title:'Paraşüt’e Kayıt',description:'Dışarıda yapılan çekimi işle'},{id:'history',title:'İşlem Geçmişi',description:'POS sonuçları ve cari kayıtlar'}] as const).map(item=><button key={item.id} type="button" aria-current={tab===item.id?'page':undefined} aria-controls={`card-panel-${item.id}`} onClick={()=>setTab(item.id)} className={`rounded-xl px-4 py-3 text-left transition ${tab===item.id?'bg-white text-emerald-900 shadow-sm ring-1 ring-slate-900/5':'text-slate-600 hover:bg-white/60'}`}><span className="block text-sm font-extrabold">{item.title}</span><span className="mt-0.5 block text-xs opacity-75">{item.description}</span></button>)}
        </nav>
        {feedback&&<div role={feedback.tone==='error'?'alert':'status'} className={`mb-5 flex items-start justify-between gap-4 whitespace-pre-wrap rounded-xl border p-4 text-sm ${feedback.tone==='error'?'border-red-200 bg-red-50 text-red-800':'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><span>{feedback.text}</span><button type="button" aria-label="Bildirimi kapat" onClick={()=>setFeedback(null)} className="font-bold">×</button></div>}
        <div hidden={tab==='manual'} id={tab==='history'?'card-panel-history':'card-panel-collect'}>
          <ParatikaTahsilat contacts={contacts} view={tab==='history'?'history':'collect'} onLedgerPosted={()=>void loadTransactions()}/>
        </div>
        <div id="card-panel-manual" hidden={tab!=='manual'}>
        <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-bold">Mevcut çekimi Paraşüt’e kaydet</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Banka veya başka bir POS üzerinden yaptığınız işlemi cariye kaydedin. Bu form karttan para çekmez.
                </p>
              </div>


            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <ChoiceCard
                  active={partyType === "supplier"}
                  title="Tedarikçiye Ödeme"
                  desc="Kartla ödeme yaptığınız tedarikçi."
                  onClick={() => setPartyType("supplier")}
                />

                <ChoiceCard
                  active={partyType === "customer"}
                  title="Müşteriden Tahsilat"
                  desc="Size kartla ödeme yapan müşteri."
                  onClick={() => setPartyType("customer")}
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <label className="mb-2 block text-sm font-bold">Cari Ara</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari adı, vergi no veya şehir ile ara"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />

                <label className="mb-2 mt-4 block text-sm font-bold">
                  Paraşüt Cari Seçimi
                </label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                >
                  <option value="">Cari seçiniz</option>
                  {filteredContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                      {contact.taxNumber ? ` - ${contact.taxNumber}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Kart Çekim Tarihi">
                  <input
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="input"
                  />
                </Field>

                <Field label="Tutar">
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Örn: 125000"
                    className="input"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-1">
                <Field label="Kart / POS / Banka">
                  <input
                    value={paymentChannel}
                    onChange={(e) => setPaymentChannel(e.target.value)}
                    placeholder="Örn: Mail Order / İş Bankası POS"
                    className="input"
                  />
                </Field>
              </div>

              <Field label="Açıklama">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Örn: 05.05.2026 tarihli kart çekimi"
                  rows={3}
                  className="input min-h-[96px] resize-none"
                />
              </Field>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : "Paraşüt’e kaydet"}
              </button>
            </form>
          </section>

          <aside className="self-start xl:sticky xl:top-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black">İşlem Önizleme</h2>
            <p className="mt-1 text-sm text-slate-500">Kaydetmeden önce son kontrol.</p>

            <div className="mt-5 space-y-3">
              <InfoRow
                label="İşlem Yönü"
                value={partyType === "supplier" ? "Tedarikçiye Ödeme" : "Müşteriden Tahsilat"}
              />
              <InfoRow label="Cari" value={selectedContact?.name || "-"} />
              <InfoRow label="Tarih" value={transactionDate || "-"} />
              <InfoRow
                label="Tutar"
                value={amount ? `${Number(amount).toLocaleString("tr-TR")} TL` : "-"}
              />
              <InfoRow
                label="Tür"
                value={transactionType === "payment" ? "Ödeme" : "Tahsilat"}
              />
              <InfoRow label="Kanal" value={paymentChannel || "-"} />
            </div>

            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Bu işlem yalnız cari hareketi oluşturur. Panelden alınan POS tahsilatları otomatik işlenir; aynı tahsilatı bu formdan tekrar kaydetmeyin.
            </div>
          </aside>
        </div>

        </div>
        <section hidden={tab!=="history"} className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-black">Paraşüt Kayıtları</h2>
              <p className="mt-1 text-sm text-slate-500">
                Son 100 kayıt gösterilir. POS tahsilatları ve manuel kayıtlar bu listede birlikte yer alır.
              </p>
            </div>

            <button
              type="button"
              onClick={loadTransactions}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold hover:bg-slate-50"
            >
              {loadingTransactions ? "Yükleniyor..." : "Listeyi Yenile"}
            </button>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-3"><Summary title="Yüklenen kayıt" value={String(totals.count)}/><Summary title="Tahsilat toplamı" value={`${totals.collection.toLocaleString('tr-TR')} ₺`}/><Summary title="Ödeme toplamı" value={`${totals.payment.toLocaleString('tr-TR')} ₺`}/></div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row"><input aria-label="Geçmiş kayıtlarda ara" value={historySearch} onChange={e=>setHistorySearch(e.target.value)} placeholder="Cari, açıklama veya banka ara…" className="input flex-1"/><select aria-label="Kayıt kaynağı" value={historySource} onChange={e=>setHistorySource(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="all">Tüm kayıtlar</option><option value="pos">Panelden POS tahsilatı</option><option value="manual">Manuel Paraşüt kaydı</option></select></div>
          <p className="mb-3 text-xs text-slate-500">{visibleTransactions.length} kayıt</p>
          <div className="overflow-x-auto rounded-3xl border border-slate-200">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-4">Tarih</th>
                  <th className="px-4 py-4">Cari</th>
                  <th className="px-4 py-4">Yön</th>
                  <th className="px-4 py-4">Tür</th>
                  <th className="px-4 py-4 text-right">Tutar</th>
                  <th className="px-4 py-4">Kanal</th>
                  <th className="px-4 py-4">Durum</th>
                  <th className="px-4 py-4">Açıklama</th>
                  <th className="px-4 py-4 text-right">İşlem</th>
                </tr>
              </thead>

              <tbody>
                {visibleTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                      Bu filtrelere uygun kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  visibleTransactions.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="border-t border-slate-100 px-4 py-4">
                        {item.transaction_date}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4 font-bold">
                        {item.company_name || "-"}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        {item.party_type === "supplier" ? "Tedarikçi" : "Müşteri"}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        {item.transaction_type === "payment" ? "Ödeme" : "Tahsilat"}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4 text-right font-black">
                        {Number(item.amount || 0).toLocaleString("tr-TR")} TL
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        <span className="block">{item.payment_channel || "-"}</span><span className="text-xs text-slate-500">{item.pos_payment_id?"Panelden POS":"Manuel kayıt"}</span>
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                          {item.status==="parasut_processed"?"Paraşüt’e işlendi":item.status==="error"?"Kontrol gerekli":item.status}
                        </span>
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        {item.description || "-"}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4 text-right">
                        {item.pos_payment_id?<span className="text-xs text-slate-400">POS kaydı</span>:<button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item.id, item.company_name)}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingId === item.id ? "Siliniyor..." : "Sil"}
                        </button>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s ease;
        }

        .input:focus {
          border-color: rgb(16 185 129);
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
        }
      `}</style>
    </main>
  );
}

function Summary({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-1 text-lg font-black text-slate-900">{value}</div>
    </div>
  );
}

function ChoiceCard({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-3xl border-2 border-emerald-600 bg-emerald-50 p-5 text-left shadow-sm"
          : "rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:bg-slate-50"
      }
    >
      <div className="text-sm font-black">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{desc}</div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-black text-slate-900">{value}</span>
    </div>
  );
}