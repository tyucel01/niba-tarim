"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ProfilPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/admin");
        return;
      }

      setEmail(data.session.user.email || "");
    });
  }, [router]);

  async function updatePassword() {
    setMessage("");

    if (password.length < 6) {
      setMessage("❌ Şifre en az 6 karakter olmalı.");
      return;
    }

    if (password !== passwordAgain) {
      setMessage("❌ Şifreler eşleşmiyor.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setSaving(false);

    if (error) {
      setMessage("❌ Şifre değiştirilemedi: " + error.message);
      return;
    }

    setPassword("");
    setPasswordAgain("");
    setMessage("✅ Şifreniz başarıyla değiştirildi.");
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-900">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow">
        <a href="/admin" className="font-bold text-emerald-800">
          ← Admin Panel
        </a>

        <h1 className="mt-6 text-3xl font-black">Profil</h1>
        <p className="mt-2 text-sm text-slate-500">
          Hesap bilgilerinizi ve şifrenizi buradan yönetebilirsiniz.
        </p>

        <div className="mt-6">
          <p className="text-sm font-bold text-slate-600">Email</p>
          <input
            value={email}
            disabled
            className="mt-2 w-full rounded-xl border bg-slate-100 px-4 py-3 text-slate-600"
          />
        </div>

        <div className="mt-5">
          <p className="text-sm font-bold text-slate-600">Yeni Şifre</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border px-4 py-3"
            placeholder="Yeni şifre"
          />
        </div>

        <div className="mt-5">
          <p className="text-sm font-bold text-slate-600">Yeni Şifre Tekrar</p>
          <input
            type="password"
            value={passwordAgain}
            onChange={(e) => setPasswordAgain(e.target.value)}
            className="mt-2 w-full rounded-xl border px-4 py-3"
            placeholder="Yeni şifre tekrar"
          />
        </div>

        {message && (
          <div className="mt-5 rounded-xl bg-slate-100 p-4 text-sm">
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={updatePassword}
          disabled={saving}
          className="mt-6 w-full rounded-xl bg-emerald-900 py-4 font-black text-white disabled:opacity-50"
        >
          {saving ? "Kaydediliyor..." : "Şifreyi Güncelle"}
        </button>
      </div>
    </main>
  );
}