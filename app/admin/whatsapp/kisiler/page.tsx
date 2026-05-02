"use client";

import { useEffect, useState } from "react";

type Contact = {
  id: string;
  name: string | null;
  phone: string;
  note: string | null;
};

export default function Page() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function loadContacts() {
    const res = await fetch("/api/admin/whatsapp/contacts");
    const data = await res.json();

    if (data.success) {
      setContacts(data.contacts || []);
    } else {
      setMessage("❌ Kişiler yüklenemedi: " + JSON.stringify(data));
    }
  }

  async function createContact() {
    if (!phone.trim()) {
      setMessage("❌ Telefon zorunlu.");
      return;
    }

    const res = await fetch("/api/admin/whatsapp/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        phone,
        note,
      }),
    });

    const data = await res.json();

    if (data.success) {
      setName("");
      setPhone("");
      setNote("");
      setMessage("✅ Kişi eklendi.");
      await loadContacts();
    } else {
      setMessage("❌ Kişi eklenemedi: " + JSON.stringify(data));
    }
  }

  async function deleteContact(contactId: string) {
    const ok = confirm("Bu kişiyi tamamen silmek istediğine emin misin?");
    if (!ok) return;

    const res = await fetch(`/api/admin/whatsapp/contacts/${contactId}`, {
      method: "DELETE",
    });

    const data = await res.json();

    if (data.success) {
      setMessage("✅ Kişi silindi.");
      await loadContacts();
    } else {
      setMessage("❌ Kişi silinemedi: " + JSON.stringify(data));
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">WhatsApp Kişileri</h1>
              <p className="mt-1 text-sm text-slate-500">
                Kişi ekle, listele veya tamamen sil.
              </p>
            </div>

            <a
              href="/admin/whatsapp/gonder"
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Gönderime Dön
            </a>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ad / Firma"
              className="rounded-xl border px-4 py-3"
            />

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Telefon"
              className="rounded-xl border px-4 py-3"
            />

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Not"
              className="rounded-xl border px-4 py-3"
            />

            <button
              type="button"
              onClick={createContact}
              className="rounded-xl bg-[#00a884] px-5 py-3 font-semibold text-white"
            >
              Kişi Ekle
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-xl bg-slate-100 p-4 text-sm">
              {message}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-3">Ad / Firma</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Not</th>
                <th className="p-3">İşlem</th>
              </tr>
            </thead>

            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-t">
                  <td className="p-3 font-medium">
                    {contact.name || "İsimsiz"}
                  </td>
                  <td className="p-3">{contact.phone}</td>
                  <td className="p-3">{contact.note || "-"}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => deleteContact(contact.id)}
                      className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}

              {contacts.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={4}>
                    Henüz kişi yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}