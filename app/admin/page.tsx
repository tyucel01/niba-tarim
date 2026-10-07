"use client";

import Dashboard from "./dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Step = "login" | "otp" | "admin";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setLoading(true);

        const otpVerified =
          sessionStorage.getItem("adminOtpVerified") === "true";
        const { data } = await supabase.auth.getSession();

        if (!mounted) return;

        if (data.session && otpVerified) {
          setStep("admin");
          setLoading(false);
        } else {
          await supabase.auth.signOut();
          sessionStorage.removeItem("adminOtpVerified");
          setStep("login");
          setLoading(false);
        }
      } catch {
        if (!mounted) return;
        await supabase.auth.signOut();
        sessionStorage.removeItem("adminOtpVerified");
        setStep("login");
        setLoading(false);
      }
    }

    init();

    function handlePageShow() {
      init();
    }



    window.addEventListener("pageshow", handlePageShow);

    return () => {
      mounted = false;
      window.removeEventListener("pageshow", handlePageShow);
    };
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

const userPhone = process.env.NEXT_PUBLIC_ADMIN_PHONE;

if (!userPhone) {
  await supabase.auth.signOut();
  alert("NEXT_PUBLIC_ADMIN_PHONE .env.local içinde tanımlı değil.");
  return;
}

    setPhone(userPhone);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: userPhone,
    });

    await supabase.auth.signOut();
    sessionStorage.removeItem("adminOtpVerified");

    if (otpError) {
      alert("SMS gönderilemedi: " + otpError.message);
      return;
    }

    setStep("otp");
    alert("SMS kodu gönderildi.");
  }

  async function verifyOtpCode() {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });

    if (error) {
      alert("Kod hatalı.");
      return;
    }

    sessionStorage.setItem("adminOtpVerified", "true");
    setStep("admin");
  }

  async function logout() {
    await supabase.auth.signOut();
    sessionStorage.removeItem("adminOtpVerified");
    setStep("login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef1ea]">
        <div className="rounded-3xl bg-white px-6 py-5 text-sm font-black text-slate-700 shadow-sm">
          Yükleniyor...
        </div>
      </main>
    );
  }

  if (step === "login") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef1ea] p-4">
        <div className="w-full max-w-md rounded-[32px] bg-white p-8 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-100">
          <p className="text-center text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
            Niba Tarım
          </p>
          <h1 className="mt-2 text-center text-3xl font-black tracking-tight">
            Admin Giriş
          </h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            Operasyon paneline erişmek için giriş yap.
          </p>

          <input
            placeholder="Email"
            className="mt-7 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Şifre"
            className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="button"
            onClick={loginWithEmail}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-[#00a884] to-[#00c297] py-3 font-black text-white shadow-xl shadow-emerald-900/10"
          >
            Giriş Yap
          </button>
        </div>
      </main>
    );
  }

  if (step === "otp") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef1ea] p-4">
        <div className="w-full max-w-md rounded-[32px] bg-white p-8 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-100">
          <p className="text-center text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
            Güvenlik
          </p>
          <h1 className="mt-2 text-center text-3xl font-black tracking-tight">
            SMS Doğrulama
          </h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            Telefonuna gelen doğrulama kodunu gir.
          </p>

          <input
            placeholder="Kod"
            className="mt-7 w-full rounded-2xl border border-slate-200 px-4 py-3 text-center text-lg font-black tracking-widest outline-none focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />

          <button
            type="button"
            onClick={verifyOtpCode}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-[#00a884] to-[#00c297] py-3 font-black text-white shadow-xl shadow-emerald-900/10"
          >
            Onayla
          </button>
        </div>
      </main>
    );
  }

  return <Dashboard onLogout={logout} />;
}
