"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type User = {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: {
    name?: string;
  };
};

export default function KullanicilarPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadUsers() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      window.location.href = "/admin";
      return;
    }

    const res = await fetch("/api/admin/users", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error || "Kullanıcılar alınamadı");
      setLoading(false);
      return;
    }

    setUsers(json.users || []);
    setLoading(false);
  }

  async function updateUser(id: string, phone: string, name: string) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phone, name }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error || "Güncelleme başarısız");
      return;
    }

    alert("Kullanıcı güncellendi");
    loadUsers();
  }

  useEffect(() => {
    loadUsers();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <p>Yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-6xl">
        <a href="/admin" className="font-bold text-emerald-800">
          ← Admin Panel
        </a>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-950">
              Kullanıcı Listesi
            </h1>
            <p className="mt-2 text-slate-600">
              Kullanıcıların adını ve SMS OTP için telefon numarasını yönetin.
            </p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow ring-1 ring-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-4">Ad Soyad</th>
                <th className="p-4">Email</th>
                <th className="p-4">Telefon</th>
                <th className="p-4">İşlem</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <UserRow key={user.id} user={user} onSave={updateUser} />
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Telefon formatı: <b>+905XXXXXXXXX</b>
        </p>
      </div>
    </main>
  );
}

function UserRow({
  user,
  onSave,
}: {
  user: User;
  onSave: (id: string, phone: string, name: string) => void;
}) {
  const [name, setName] = useState(user.user_metadata?.name || "");
  const [phone, setPhone] = useState(user.phone || "");

  return (
    <tr className="border-t">
      <td className="p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-emerald-700"
          placeholder="Ad Soyad"
        />
      </td>

      <td className="p-4 font-semibold text-slate-700">{user.email}</td>

      <td className="p-4">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-emerald-700"
          placeholder="+905XXXXXXXXX"
        />
      </td>

      <td className="p-4">
        <button
          onClick={() => onSave(user.id, phone, name)}
          className="rounded-lg bg-emerald-900 px-4 py-2 font-bold text-white hover:bg-emerald-800"
        >
          Kaydet
        </button>
      </td>
    </tr>
  );
}