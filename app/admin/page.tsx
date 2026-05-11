"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Step = "login" | "otp" | "admin";

type DashboardStats = {
  orders: number;
  users: number;
  activeCampaigns: number;
  pendingMessages: number;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [statsLoading, setStatsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const [stats, setStats] = useState<DashboardStats>({
    orders: 0,
    users: 0,
    activeCampaigns: 0,
    pendingMessages: 0,
  });

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
          await loadDashboardStats();
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

  async function countTable(
    tableName: string,
    filter?: { column: string; value: string },
  ) {
    try {
      let query = supabase
        .from(tableName)
        .select("*", { count: "exact", head: true });

      if (filter) query = query.eq(filter.column, filter.value);

      const { count, error } = await query;
      if (error) return 0;

      return count || 0;
    } catch {
      return 0;
    }
  }

  async function loadUserCount() {
    try {
      const res = await fetch(`/api/admin/users?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (Array.isArray(data.users)) return data.users.length;
      if (Array.isArray(data)) return data.length;

      return 0;
    } catch {
      return 0;
    }
  }

  async function loadDashboardStats() {
    try {
      setStatsLoading(true);

      const orders =
        (await countTable("siparisler")) || (await countTable("orders"));

      const users = await loadUserCount();

      const activeCampaigns = await countTable("whatsapp_campaigns", {
        column: "status",
        value: "processing",
      });

      const pendingMessages = await countTable("whatsapp_message_queue", {
        column: "status",
        value: "pending",
      });

      setStats({
        orders,
        users,
        activeCampaigns,
        pendingMessages,
      });

      setLastUpdated(
        new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    } finally {
      setStatsLoading(false);
    }
  }

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
    await loadDashboardStats();
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

  return (
    <main className="min-h-screen bg-[#eef1ea] p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-[32px] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/10">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
                Niba Tarım
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                Admin Paneli
              </h1>
              <p className="mt-2 text-sm text-white/65">
                Sipariş, kullanıcı ve WhatsApp operasyonlarını tek merkezden yönet.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={loadDashboardStats}
                disabled={statsLoading}
                className="rounded-2xl bg-white/10 px-4 py-3 text-xs font-black text-white ring-1 ring-white/15 disabled:opacity-50"
              >
                {statsLoading ? "Yenileniyor..." : "Yenile"}
              </button>

              <Link
                href="/admin/profil"
                prefetch={false}
                className="rounded-2xl bg-white px-4 py-3 text-xs font-black text-slate-950"
              >
                Profil
              </Link>

              <button
                type="button"
                onClick={logout}
                className="rounded-2xl bg-red-600 px-4 py-3 text-xs font-black text-white"
              >
                Çıkış
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard dark title="Siparişler" value={stats.orders} />
            <StatCard dark title="Kullanıcılar" value={stats.users} />
            <StatCard dark title="Aktif Kampanya" value={stats.activeCampaigns} />
            <StatCard dark title="Bekleyen Mesaj" value={stats.pendingMessages} />
          </div>

          {lastUpdated && (
            <p className="mt-4 text-xs font-semibold text-white/50">
              Son güncelleme: {lastUpdated}
            </p>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <AdminAction icon="📦" title="Sipariş Yönetimi" desc="Sipariş oluştur, takip et ve operasyon sürecini yönet." href="/admin/siparisler" />
          <AdminAction icon="💬" title="WhatsApp Gönderim" desc="Toplu template gönderimi ve kampanya yönetimi." href="/admin/whatsapp/gonder" highlight />
          <AdminAction icon="📊" title="WhatsApp Raporları" desc="Gönderim ilerlemesini ve başarısız mesajları takip et." href="/admin/whatsapp/raporlar" />
          <AdminAction icon="👥" title="Kullanıcılar" desc="Admin kullanıcıları ve erişimleri yönet." href="/admin/kullanicilar" />
          <AdminAction icon="📝" title="Sipariş Formu" desc="Müşteri ve bayi sipariş formu oluştur." href="/admin/siparisler/form" />
          <AdminAction icon="💰" title="Fiyat Sirkü" desc="Güncel fiyat paylaşım süreçlerini yönet." href="/admin/fiyat-formu" />
          <AdminAction
  icon="💳"
  title="Kart Çekimleri"
  desc="Tedarikçi ödemeleri ve müşteri tahsilatlarını Paraşüt carileriyle işle."
  href="/admin/finans/kart-cekimleri"
  highlight
/>
        </section>
      </div>
    </main>
  );
}

function AdminAction({
  icon,
  title,
  desc,
  href,
  highlight,
}: {
  icon: string;
  title: string;
  desc: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`group rounded-[28px] p-5 shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-xl ${
        highlight
          ? "bg-gradient-to-br from-[#00a884] to-[#007f67] text-white ring-emerald-200"
          : "bg-white text-slate-950 ring-slate-100"
      }`}
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${highlight ? "bg-white/15" : "bg-slate-50"}`}>
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-black">{title}</h2>
      <p className={`mt-2 text-sm leading-6 ${highlight ? "text-white/75" : "text-slate-500"}`}>
        {desc}
      </p>
      <div className={`mt-5 text-sm font-black ${highlight ? "text-white" : "text-emerald-700"}`}>
        Aç →
      </div>
    </Link>
  );
}

function StatCard({
  title,
  value,
  dark,
}: {
  title: string;
  value: number;
  dark?: boolean;
}) {
  return (
    <div className={`rounded-3xl p-4 ring-1 ${dark ? "bg-white/10 text-white ring-white/15" : "bg-white text-slate-900 ring-slate-100"}`}>
      <p className={dark ? "text-xs text-white/55" : "text-xs text-slate-400"}>
        {title}
      </p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}