"use client";

import { useEffect, useState } from "react";

type Group = {
  id: string;
  name: string;
};

export default function Page() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  async function loadGroups() {
    const res = await fetch("/api/admin/whatsapp/groups");
    const data = await res.json();

    if (data.success) {
      setGroups(data.groups || []);
    } else {
      setMessage("❌ Gruplar yüklenemedi");
    }
  }

  async function createGroup() {
    if (!name.trim()) {
      setMessage("❌ Grup adı yaz.");
      return;
    }

    const res = await fetch("/api/admin/whatsapp/groups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();

    if (data.success) {
      setName("");
      setMessage("✅ Grup oluşturuldu");
      await loadGroups();
    } else {
      setMessage("❌ Hata");
    }
  }

  async function deleteGroup(id: string) {
    const ok = confirm("Bu grubu silmek istediğine emin misin?");
    if (!ok) return;

    const res = await fetch(`/api/admin/whatsapp/groups/${id}`, {
      method: "DELETE",
    });

    const data = await res.json();

    if (data.success) {
      setMessage("✅ Grup silindi");
      await loadGroups();
    } else {
      setMessage("❌ Silinemedi");
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Gruplar</h1>

          <a
            href="/admin/whatsapp/gonder"
            className="rounded-lg bg-black px-4 py-2 text-sm text-white"
          >
            Gönderime Dön
          </a>
        </div>

        {/* CREATE */}
        <div className="flex gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Grup adı"
            className="flex-1 rounded-lg border px-4 py-3"
          />

          <button
            onClick={createGroup}
            className="rounded-lg bg-green-600 px-4 py-3 text-white"
          >
            Ekle
          </button>
        </div>

        {message && (
          <div className="rounded-lg bg-white p-3 text-sm">{message}</div>
        )}

        {/* LIST */}
        <div className="rounded-xl bg-white shadow">
          {groups.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between border-b p-4"
            >
              <div className="font-medium">{g.name}</div>

              <div className="flex gap-2">
                <a
                  href={`/admin/whatsapp/gruplar/${g.id}`}
                  className="rounded-md bg-gray-900 px-3 py-2 text-xs text-white"
                >
                  Kişileri Yönet
                </a>

                <button
                  onClick={() => deleteGroup(g.id)}
                  className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-600"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}

          {groups.length === 0 && (
            <div className="p-4 text-sm text-gray-500">
              Henüz grup yok
            </div>
          )}
        </div>
      </div>
    </main>
  );
}