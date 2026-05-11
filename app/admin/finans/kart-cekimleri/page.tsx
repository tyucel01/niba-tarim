"use client";

import { useEffect, useMemo, useState } from "react";

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
};

const CONTACTS_CACHE_KEY = "parasut_contacts_cache_v1";
const CONTACTS_CACHE_TTL = 30 * 60 * 1000;

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

      return haystack.includes(q);
    });
  }, [contacts, search]);

  const totals = useMemo(() => {
    const payment = transactions
      .filter((x) => x.transaction_type === "payment")
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);

    const collection = transactions
      .filter((x) => x.transaction_type === "collection")
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);

    return { payment, collection, count: transactions.length };
  }, [transactions]);

  function getCachedContacts() {
    try {
      const raw = localStorage.getItem(CONTACTS_CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const isExpired = Date.now() - parsed.createdAt > CONTACTS_CACHE_TTL;

      if (isExpired) return null;
      if (!Array.isArray(parsed.contacts)) return null;

      return parsed.contacts as Contact[];
    } catch {
      return null;
    }
  }

  function setCachedContacts(nextContacts: Contact[]) {
    try {
      localStorage.setItem(
        CONTACTS_CACHE_KEY,
        JSON.stringify({
          createdAt: Date.now(),
          contacts: nextContacts,
        })
      );
    } catch {}
  }

  async function loadContacts(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = getCachedContacts();
      if (cached && cached.length > 0) {
        setContacts(cached);
        return;
      }
    }

    setLoadingContacts(true);

    try {
      const response = await fetch("/api/admin/parasut/contacts", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!data.ok) {
        alert(data.error || "Paraşüt carileri alınamadı");
        return;
      }

      const nextContacts = data.contacts || [];
      setContacts(nextContacts);
      setCachedContacts(nextContacts);
    } catch {
      alert("Paraşüt carileri alınırken hata oluştu");
    } finally {
      setLoadingContacts(false);
    }
  }

  async function loadTransactions() {
    setLoadingTransactions(true);

    try {
      const response = await fetch("/api/admin/parasut/card-transactions", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!data.ok) {
        alert(
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
      alert("Kart çekimleri alınırken hata oluştu");
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

    if (!selectedContactId) return alert("Lütfen cari seçin");
    if (!amount || Number(amount) <= 0) return alert("Lütfen geçerli tutar girin");

    const confirmText =
      `${selectedContact?.name || "Seçili cari"} için ${Number(amount).toLocaleString("tr-TR")} TL ` +
      `${transactionType === "payment" ? "ödeme" : "tahsilat"} kaydı oluşturulacak. Onaylıyor musunuz?`;

    if (!confirm(confirmText)) return;

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
        alert(
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
      alert("Kart çekimi kaydedildi");
    } catch {
      alert("Kayıt sırasında hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, companyName: string) {
    if (!confirm(`${companyName || "Bu kayıt"} silinsin mi?`)) return;

    setDeletingId(id);

    try {
      const response = await fetch(`/api/admin/parasut/card-transactions?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.ok) {
        alert(data.error || "Kayıt silinemedi");
        return;
      }

      await loadTransactions();
    } catch {
      alert("Silme sırasında hata oluştu");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f4] px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[32px] border border-emerald-900/10 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-7 text-white shadow-xl">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold text-emerald-200">Niba Admin / Finans</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
                Kart Çekimleri
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/80">
                Tedarikçiye yapılan kart ödemelerini ve müşterilerden alınan kart tahsilatlarını tek ekrandan kaydedin.
                Yanlış girilen kayıtları alttaki listeden silebilirsiniz.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat title="Kayıt" value={String(totals.count)} />
              <Stat title="Ödeme" value={`${totals.payment.toLocaleString("tr-TR")} ₺`} />
              <Stat title="Tahsilat" value={`${totals.collection.toLocaleString("tr-TR")} ₺`} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-bold">Yeni İşlem Girişi</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Paraşüt carisini seçin ve kart çekimini kaydedin.
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadContacts(true)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                {loadingContacts ? "Cariler yükleniyor..." : "Carileri Yenile"}
              </button>
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
                {saving ? "Kaydediliyor..." : "Kart Çekimini Kaydet"}
              </button>
            </form>
          </section>

          <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
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
              Yanlış kayıt girilirse alttaki listeden silebilirsiniz. Paraşüt’e işlenen kayıtlarda silme işlemi Paraşüt kaydını da silmeye çalışır.
            </div>
          </aside>
        </div>

        <section className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-black">İşlenen Kayıtlar</h2>
              <p className="mt-1 text-sm text-slate-500">
                Son 100 kart çekimi listelenir.
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
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                      Henüz kayıt yok.
                    </td>
                  </tr>
                ) : (
                  transactions.map((item) => (
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
                        {item.payment_channel || "-"}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                          {item.status}
                        </span>
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        {item.description || "-"}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4 text-right">
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item.id, item.company_name)}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingId === item.id ? "Siliniyor..." : "Sil"}
                        </button>
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

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="min-w-[110px] rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <div className="text-xs font-semibold text-emerald-100/80">{title}</div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
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