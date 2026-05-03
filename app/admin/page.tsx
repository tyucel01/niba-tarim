"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"login" | "otp" | "admin">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setStep("admin");
      }
      setLoading(false);
    });
  }, []);

  async function loginWithEmail() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Email veya şifre hatalı");
      return;
    }

const userPhone = data.user?.phone || data.user?.user_metadata?.phone;

    if (!userPhone) {
      await supabase.auth.signOut();
      alert("Bu kullanıcıya kayıtlı telefon numarası yok.");
      return;
    }

    setPhone(userPhone);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: userPhone,
    });

    if (otpError) {
      await supabase.auth.signOut();
      alert("SMS gönderilemedi: " + otpError.message);
      return;
    }

    setStep("otp");
    alert("SMS kodu kayıtlı telefon numaranıza gönderildi.");
  }

  async function verifyOtpCode() {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });

    if (error) {
      alert("Kod hatalı veya süresi dolmuş.");
      return;
    }

    setStep("admin");
  }

  async function logout() {
    await supabase.auth.signOut();
    setStep("login");
    setEmail("");
    setPassword("");
    setPhone("");
    setOtp("");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p>Yükleniyor...</p>
      </main>
    );
  }

  if (step === "login") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="w-[380px] rounded-2xl bg-white p-8 shadow">
          <h1 className="text-center text-2xl font-black text-slate-950">
            Niba Tarım Admin Giriş
          </h1>

          <input
            placeholder="Email"
            className="mt-6 w-full rounded-xl border px-4 py-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Şifre"
            className="mt-4 w-full rounded-xl border px-4 py-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={loginWithEmail}
            className="mt-6 w-full rounded-xl bg-emerald-900 py-3 font-black text-white hover:bg-emerald-800"
          >
            Giriş Yap
          </button>
        </div>
      </main>
    );
  }

  if (step === "otp") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="w-[380px] rounded-2xl bg-white p-8 shadow">
          <h1 className="text-center text-2xl font-black text-slate-950">
            SMS Doğrulama
          </h1>

          <p className="mt-4 text-center text-sm text-slate-600">
            Kod kayıtlı telefon numaranıza gönderildi.
          </p>

          <input
            placeholder="SMS Kodu"
            className="mt-6 w-full rounded-xl border px-4 py-3 text-center text-xl tracking-widest"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />

          <button
            onClick={verifyOtpCode}
            className="mt-6 w-full rounded-xl bg-emerald-900 py-3 font-black text-white hover:bg-emerald-800"
          >
            Kodu Doğrula
          </button>

          <button
            onClick={logout}
            className="mt-3 w-full rounded-xl bg-slate-100 py-3 font-bold text-slate-700"
          >
            Geri Dön
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-950">
              Niba Tarım Admin Panel
            </h1>
            <p className="mt-2 text-slate-600">
              Sipariş ve operasyon yönetimi
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-500"
          >
            Çıkış Yap
          </button>
        </div>

        <div className="mt-6 flex gap-3">
          <a
            href="/admin/siparisler"
            className="rounded-xl bg-emerald-900 px-6 py-4 font-black text-white shadow-lg hover:bg-emerald-800"
          >
            Sipariş Ekle
          </a>
<a
  href="/admin/kullanicilar"
  className="rounded-xl bg-white px-6 py-4 font-black text-emerald-900 shadow-sm ring-1 ring-emerald-900/20 hover:bg-emerald-50"
>
  Kullanıcı Listesi
</a>

          <a
            href="/admin/siparisler/form"
            className="rounded-xl bg-white px-6 py-4 font-black text-emerald-900 shadow-sm ring-1 ring-emerald-900/20 hover:bg-emerald-50"
          >
            Sipariş Formu Oluştur
          </a>

<a
  href="/admin/whatsapp/gonder"
  className="rounded-xl bg-[#25D366] px-6 py-4 font-black text-white shadow-lg hover:bg-[#1ebe5d]"
>
  WhatsApp Gönder
</a>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-4">
          <AdminCard title="Ürünler" value="0" />
          <AdminCard title="Siparişler" value="0" />
          <AdminCard title="Formlar" value="0" />
          <AdminCard title="Kullanıcılar" value="1" />
        </div>
      </div>
    </main>
  );
}

function AdminCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-black text-emerald-900">{value}</p>
    </div>
  );
}