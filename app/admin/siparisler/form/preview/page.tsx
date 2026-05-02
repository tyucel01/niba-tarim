"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import * as XLSX from "xlsx";

type Contact = {
  id: string;
  name: string | null;
  phone: string;
  note: string | null;
};

type Member = {
  id: string;
  contact_id: string;
  whatsapp_contacts: Contact | null;
};

type PreviewContact = {
  name: string;
  phone: string;
  note: string;
};

function getCell(row: any, possibleKeys: string[]) {
  const rowKeys = Object.keys(row);

  for (const key of possibleKeys) {
    const foundKey = rowKeys.find(
      (rowKey) =>
        rowKey.toString().trim().toLocaleLowerCase("tr-TR") ===
        key.toString().trim().toLocaleLowerCase("tr-TR")
    );

    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      return String(row[foundKey]).trim();
    }
  }

  return "";
}

export default function Page() {
  const params = useParams();
  const groupId = String(params?.id || "");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [previewContacts, setPreviewContacts] = useState<PreviewContact[]>([]);

  async function loadContacts() {
    const res = await fetch("/api/admin/whatsapp/contacts");
    const data = await res.json();
    if (data.success) setContacts(data.contacts || []);
  }

  async function loadMembers() {
    if (!groupId || groupId === "undefined") return;

    const res = await fetch(
      `/api/admin/whatsapp/group-members?groupId=${groupId}`
    );
    const data = await res.json();

    if (data.success) {
      setMembers(data.members || []);
    } else {
      setMessage("❌ Grup üyeleri yüklenemedi: " + JSON.stringify(data));
    }
  }

  async function addMember() {
    if (!selectedContactId) {
      setMessage("❌ Önce kişi seç.");
      return;
    }

    const res = await fetch("/api/admin/whatsapp/group-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, contactId: selectedContactId }),
    });

    const data = await res.json();

    if (data.success) {
      setMessage("✅ Kişi gruba eklendi.");
      setSelectedContactId("");
      await loadMembers();
    } else {
      setMessage("❌ Eklenemedi: " + JSON.stringify(data));
    }
  }

  async function readExcelPreview(file: File) {
    setMessage("Excel okunuyor...");
    setPreviewContacts([]);
    setConfirmImport(false);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

      const parsed = rows
        .map((row) => {
          const name = getCell(row, [
            "name",
            "Name",
            "ad",
            "Ad",
            "ad soyad",
            "Ad Soyad",
            "ad soyadı",
            "Ad Soyadı",
            "adı soyadı",
            "Adı Soyadı",
            "isim",
            "İsim",
            "müşteri",
            "Müşteri",
            "müşteri adı",
            "Müşteri Adı",
            "firma",
            "Firma",
            "firma adı",
            "Firma Adı",
            "ünvan",
            "Ünvan",
            "unvan",
            "Unvan",
          ]);

          const phone = getCell(row, [
            "phone",
            "Phone",
            "telefon",
            "Telefon",
            "telefon no",
            "Telefon No",
            "telefon numarası",
            "Telefon Numarası",
            "gsm",
            "GSM",
            "cep",
            "Cep",
            "cep telefonu",
            "Cep Telefonu",
            "whatsapp",
            "WhatsApp",
          ]).replace(/\D/g, "");

          const note = getCell(row, [
            "note",
            "Note",
            "not",
            "Not",
            "açıklama",
            "Açıklama",
            "aciklama",
            "Aciklama",
            "il",
            "İl",
            "sehir",
            "Şehir",
            "şehir",
          ]);

          return {
            name: name || "İsimsiz",
            phone,
            note,
          };
        })
        .filter((item) => item.phone);

      setPreviewContacts(parsed);
      setMessage(
        `✅ Sadece önizleme yapıldı. Henüz gruba aktarılmadı. ${parsed.length} kişi bulundu.`
      );
    } catch (error) {
      setMessage("❌ Excel okunurken hata oluştu: " + String(error));
    }
  }

  async function importPreviewContacts() {
    if (!confirmImport) {
      setMessage("❌ Önce 'Aktarımı onaylıyorum' kutusunu işaretle.");
      return;
    }

    if (previewContacts.length === 0) {
      setMessage("❌ Önce Excel seçmelisin.");
      return;
    }

    setImporting(true);
    setMessage("Kişiler gruba aktarılıyor...");

    const res = await fetch("/api/admin/whatsapp/groups/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, contacts: previewContacts }),
    });

    const data = await res.json();

    if (data.success) {
      setMessage(
        `✅ Aktarım tamamlandı. Yeni kişi: ${data.summary.created}, gruba eklenen: ${data.summary.addedToGroup}, atlanan: ${data.summary.skipped}, hatalı: ${data.summary.failed}`
      );
      setPreviewContacts([]);
      setConfirmImport(false);
      await loadContacts();
      await loadMembers();
    } else {
      setMessage("❌ Aktarım yapılamadı: " + JSON.stringify(data));
    }

    setImporting(false);
  }

  useEffect(() => {
    loadContacts();
    loadMembers();
  }, [groupId]);

  const memberIds = members.map((m) => m.contact_id);
  const availableContacts = contacts.filter((c) => !memberIds.includes(c.id));

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Gruba Kişi Ekle</h1>

          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <h2 className="font-medium text-slate-900">
              Excel ile Toplu Kişi Ekle
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Excel başlıkları örnek: Ad Soyad, Telefon, Not
            </p>

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readExcelPreview(file);
              }}
              className="mt-4 block w-full rounded-xl border bg-white px-4 py-3"
            />

            {previewContacts.length > 0 && (
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h3 className="font-medium">
                    Önizleme ({previewContacts.length} kişi)
                  </h3>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={confirmImport}
                        onChange={(e) => setConfirmImport(e.target.checked)}
                      />
                      Aktarımı onaylıyorum
                    </label>

                    <button
                      type="button"
                      onClick={importPreviewContacts}
                      disabled={importing || !confirmImport}
                      className="rounded-xl bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {importing ? "Aktarılıyor..." : "Gruba Aktar"}
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-auto rounded-2xl border bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="p-3">Ad / Firma</th>
                        <th className="p-3">Telefon</th>
                        <th className="p-3">Not</th>
                      </tr>
                    </thead>

                    <tbody>
                      {previewContacts.map((contact, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-3">{contact.name || "-"}</td>
                          <td className="p-3">{contact.phone}</td>
                          <td className="p-3">{contact.note || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <select
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
              className="flex-1 rounded-xl border px-4 py-3"
            >
              <option value="">Kişi seç</option>

              {availableContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name || "İsimsiz"} - {contact.phone}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={addMember}
              className="rounded-xl bg-black px-5 py-3 font-medium text-white"
            >
              Gruba Ekle
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-xl bg-slate-100 p-4 text-sm">
              {message}
            </div>
          )}
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Grup Üyeleri</h2>

          <div className="mt-4 overflow-hidden rounded-2xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3">Ad / Firma</th>
                  <th className="p-3">Telefon</th>
                  <th className="p-3">Not</th>
                </tr>
              </thead>

              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-t">
                    <td className="p-3">
                      {member.whatsapp_contacts?.name || "-"}
                    </td>
                    <td className="p-3">
                      {member.whatsapp_contacts?.phone || "-"}
                    </td>
                    <td className="p-3">
                      {member.whatsapp_contacts?.note || "-"}
                    </td>
                  </tr>
                ))}

                {members.length === 0 && (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={3}>
                      Bu grupta henüz kişi yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <a
            href="/admin/whatsapp/gruplar"
            className="mt-4 inline-block text-sm underline"
          >
            Gruplara geri dön
          </a>
        </div>
      </div>
    </main>
  );
}