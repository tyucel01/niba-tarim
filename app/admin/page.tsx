"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Step = "login" | "otp" | "admin";

type DashboardStats = {
  orders: number;
  users: number;
  activeCampaigns: number;
  pendingMessages: number;
  revenue: number;
  tonnage: number;
  invoiceReady: number;
  invoiced: number;
};

type SiparisRow = Record<string, any>;

type TrendPoint = {
  label: string;
  value: number;
  previous: number;
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
  const [range, setRange] = useState<"month" | "all">("month");
  const [orders, setOrders] = useState<SiparisRow[]>([]);

  const [stats, setStats] = useState<DashboardStats>({
    orders: 0,
    users: 0,
    activeCampaigns: 0,
    pendingMessages: 0,
    revenue: 0,
    tonnage: 0,
    invoiceReady: 0,
    invoiced: 0,
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

  async function loadOrders() {
    try {
      const res = await fetch(`/api/admin/siparisler?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (Array.isArray(data.rows)) return data.rows as SiparisRow[];
      if (Array.isArray(data.data)) return data.data as SiparisRow[];
      if (Array.isArray(data)) return data as SiparisRow[];

      return [];
    } catch {
      return [];
    }
  }

  async function loadDashboardStats() {
    try {
      setStatsLoading(true);

      const [orderRows, users, activeCampaigns, pendingMessages] = await Promise.all([
        loadOrders(),
        loadUserCount(),
        countTable("whatsapp_campaigns", {
          column: "status",
          value: "processing",
        }),
        countTable("whatsapp_message_queue", {
          column: "status",
          value: "pending",
        }),
      ]);

      const revenue = orderRows.reduce((sum, order) => sum + getOrderRevenue(order), 0);
      const tonnage = orderRows.reduce((sum, order) => sum + getOrderTonnage(order), 0);
      const invoiceReady = orderRows.filter((order) => getInvoiceStatus(order).canInvoice && !isInvoiced(order)).length;
      const invoiced = orderRows.filter(isInvoiced).length;

      setOrders(orderRows);
      setStats({
        orders: orderRows.length,
        users,
        activeCampaigns,
        pendingMessages,
        revenue,
        tonnage,
        invoiceReady,
        invoiced,
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

  if (error || !data.user) {
    alert("Email veya şifre hatalı");
    return;
  }

  const userPhone =
    data.user.phone ||
    data.user.user_metadata?.phone ||
    data.user.user_metadata?.phone_number ||
    data.user.user_metadata?.telefon;

  if (!userPhone) {
    await supabase.auth.signOut();
    alert("Bu kullanıcı için telefon numarası bulunamadı.");
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
  const filteredOrders = useMemo(() => {
    if (range === "all") return orders;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return orders.filter((order) => {
      const rawDate = order.satisTarihi || order.created_at;
      if (!rawDate) return false;

      const d = new Date(rawDate);
      if (Number.isNaN(d.getTime())) return false;

      if (range === "month") {
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }

      return true;
    });
  }, [orders, range]);

  const filteredStats = useMemo(() => {
    const revenue = filteredOrders.reduce(
      (sum, order) => sum + getOrderRevenue(order),
      0,
    );

    const tonnage = filteredOrders.reduce(
      (sum, order) => sum + getOrderTonnage(order),
      0,
    );

    const invoiceReady = filteredOrders.filter(
      (order) => getInvoiceStatus(order).canInvoice && !isInvoiced(order),
    ).length;

    const invoiced = filteredOrders.filter(isInvoiced).length;

    return {
      orders: filteredOrders.length,
      revenue,
      tonnage,
      invoiceReady,
      invoiced,
    };
  }, [filteredOrders]);

  const latestOrders = useMemo(() => {
    return [...filteredOrders]
      .sort(
        (a, b) =>
          getDateTime(b.satisTarihi || b.created_at) -
          getDateTime(a.satisTarihi || a.created_at),
      )
      .slice(0, 5);
  }, [filteredOrders]);

  const topDealers = useMemo(() => {
    const map = new Map<
      string,
      { bayi: string; revenue: number; tonnage: number; count: number }
    >();

    for (const order of filteredOrders) {
      const bayi = clean(order.bayi) || "Bayi Yok";
      const current = map.get(bayi) || {
        bayi,
        revenue: 0,
        tonnage: 0,
        count: 0,
      };

      current.revenue += getOrderRevenue(order);
      current.tonnage += getOrderTonnage(order);
      current.count += 1;
      map.set(bayi, current);
    }

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredOrders]);

const trend = useMemo(() => buildTrend(orders, range), [orders, range]);

  const tasks = useMemo(() => {
    const missingGts = filteredOrders.filter(
      (order) => !getInvoiceStatus(order).gtsOk,
    ).length;

    const missingInvoice = filteredOrders.filter(
      (order) => !getInvoiceStatus(order).alisOk,
    ).length;

    const ready = filteredOrders.filter(
      (order) => getInvoiceStatus(order).canInvoice && !isInvoiced(order),
    ).length;

    const pendingMessages = stats.pendingMessages;

    return [
      {
        icon: "▣",
        tone: "emerald" as const,
        title: `${ready} sipariş fatura bekliyor`,
        desc: "Fatura kesimi yapılacak",
        time: "canlı",
      },
      {
        icon: "◇",
        tone: "orange" as const,
        title: `${missingGts} sipariş GTS bekliyor`,
        desc: "GTS kontrolü gerekli",
        time: "canlı",
      },
      {
        icon: "!",
        tone: "red" as const,
        title: `${missingInvoice} sipariş alış faturası bekliyor`,
        desc: "Alış faturası eşleştirilmeli",
        time: "canlı",
      },
      {
        icon: "✉",
        tone: "blue" as const,
        title: `${pendingMessages} WhatsApp mesajı bekliyor`,
        desc: "Queue kontrolü",
        time: "canlı",
      },
    ];
  }, [filteredOrders, stats.pendingMessages]);

  const kpis = useMemo(
    () => [
      {
        title: "Toplam Ciro",
        value: formatMoneyShort(filteredStats.revenue),
        change: `${filteredStats.invoiced} kesildi`,
        icon: "₺",
        color: "emerald",
        points: trend.map((item) => item.value),
      },
      {
        title: "Toplam Sipariş",
        value: String(filteredStats.orders || 0),
        change: `${filteredStats.invoiceReady} hazır`,
        icon: "□",
        color: "blue",
        points: trend.map(
          (item, index) =>
            Math.max(index + 1, 1) * 10 + (item.value > 0 ? 20 : 0),
        ),
      },
      {
        title: "Toplam Tonaj",
        value: `${formatNumber(filteredStats.tonnage)} ton`,
        change: "canlı veri",
        icon: "⚖",
        color: "violet",
        points: trend.map((item) => item.value / 1000),
      },
      {
        title: "Fatura Hazır",
        value: String(filteredStats.invoiceReady || 0),
        change: `${filteredStats.invoiced} tamamlandı`,
        icon: "%",
        color: "orange",
        points: trend.map((item, index) =>
          Math.max(8, 35 + index * 4 - filteredStats.invoiceReady),
        ),
      },
    ],
    [filteredStats, trend],
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb]">
        <div className="rounded-3xl bg-white px-6 py-5 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200">
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
    <main className="min-h-screen overflow-x-hidden bg-[#f7f8fb] text-slate-900">
      <div className="flex min-h-screen min-w-0">
        <aside className="hidden w-[244px] shrink-0 border-r border-slate-200 bg-white px-4 py-5 xl:block">
          <div className="flex items-center gap-3 px-1">
<img
  src="/niba-logo-horizontal.png"
  alt="Niba Tarım"
  className="h-10 w-10 rounded-2xl object-cover"
/>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-950">Niba Admin</h1>
              <p className="text-[11px] font-bold text-slate-400">Operasyon Paneli</p>
            </div>
          </div>

          <nav className="mt-7 space-y-6">
            <MenuGroup title="Ana Menü">
              <SideLink icon="⌂" title="Dashboard" href="/admin" active />
              <SideLink icon="□" title="Siparişler" href="/admin/siparisler" />
              <SideLink icon="＋" title="Yeni Sipariş" href="/admin/siparisler/yeni-siparis" />
              <SideLink icon="▣" title="Fatura Kes" href="/admin/siparisler" />
            </MenuGroup>

            <MenuGroup title="Operasyon">
              <SideLink icon="◇" title="GTS İşlemleri" href="/admin/siparisler" />
              <SideLink icon="◉" title="Paraşüt" href="/admin/parasut" />
              <SideLink icon="▤" title="Kart Çekimleri" href="/admin/finans/kart-cekimleri" />
              <SideLink icon="✉" title="WhatsApp" href="/admin/whatsapp/gonder" />
            </MenuGroup>

            <MenuGroup title="Raporlar">
              <SideLink icon="▥" title="Satış Raporları" href="/admin/siparisler" />
              <SideLink icon="◷" title="WhatsApp Raporları" href="/admin/whatsapp/raporlar" />
              <SideLink icon="⚙" title="Kullanıcılar" href="/admin/kullanicilar" />
              <SideLink icon="💰" title="Fiyat Sirküsü" href="/admin/fiyat-formu" />
            </MenuGroup>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur md:px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <A href="/admin/siparisler" className="xl:hidden rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                  Menü
                </A>
                <div className="flex h-11 w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
                  <span className="text-slate-400">⌕</span>
                  <input
                    placeholder="Ara veya komut girin..."
                    className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={loadDashboardStats}
                  disabled={statsLoading}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-700 shadow-sm disabled:opacity-50"
                >
                  {statsLoading ? "Yenileniyor" : "Yenile"}
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-2xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white"
                >
                  Çıkış
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1180px] p-3 md:p-4">
            <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-950">
                    Satış Dashboard
                  </h1>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Ciro, tonaj, sevkiyat ve fatura akışını tek ekranda takip et.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
<div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <button
    type="button"
    onClick={() => setRange("month")}
    className={`px-3 py-2.5 text-xs font-black ${
      range === "month" ? "bg-slate-950 text-white" : "text-slate-700"
    }`}
  >
    Bu Ay
  </button>

  <button
    type="button"
    onClick={() => setRange("all")}
    className={`border-l border-slate-200 px-3 py-2.5 text-xs font-black ${
      range === "all" ? "bg-slate-950 text-white" : "text-slate-700"
    }`}
  >
    Tümü
  </button>
</div>
                  <button className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-700 shadow-sm">
                    Filtrele
                  </button>
                  <button className="rounded-2xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white shadow-sm shadow-emerald-600/20">
                    Rapor
                  </button>
                </div>
              </div>

              <div className="mt-5 grid overflow-hidden rounded-[24px] border border-slate-100 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((item) => (
                  <KpiPanel key={item.title} {...item} />
                ))}
              </div>
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-950">Ciro Trendi</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Son 7 gün satış hareketi.
                    </p>
                  </div>
                  <div className="hidden items-center gap-3 text-[11px] font-black text-slate-500 md:flex">
                    <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Bu Dönem</span>
                    <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Önceki</span>
                  </div>
                </div>

                <RevenueChart trend={trend} />
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-950">Yapılacaklar</h2>
                  <A href="/admin/siparisler" className="text-xs font-black text-emerald-600">
                    Tümü →
                  </A>
                </div>
                <div className="mt-4 space-y-2">
                  {tasks.map((task) => (
                    <TaskItem key={task.title} {...task} />
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
              <DataCard title="Son Siparişler" action="Tümünü Gör →">
                <SimpleTable
                  headers={["Sipariş", "Bayi", "Ürün", "Tonaj", "Durum"]}
rows={latestOrders.map((filteredOrders) => [
  clean(filteredOrders.satisId) || clean(filteredOrders.id) || "-",
  clean(filteredOrders.bayi) || "-",
  clean(filteredOrders.urun) || clean(filteredOrders.marka) || "-",
  `${formatNumber(getOrderTonnage(filteredOrders))} ton`,
  getOrderStatusLabel(filteredOrders),
])}
                />
              </DataCard>

              <DataCard title="En İyi Bayiler" action="Tümünü Gör →">
                <SimpleTable
                  headers={["#", "Bayi", "Ciro", "Tonaj"]}
                  rows={topDealers.map((dealer, index) => [
                    String(index + 1),
                    dealer.bayi,
                    formatMoneyShort(dealer.revenue),
                    `${formatNumber(dealer.tonnage)} ton`,
                  ])}
                />
              </DataCard>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function A({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SideLink({
  icon,
  title,
  href,
  active,
}: {
  icon: string;
  title: string;
  href: string;
  active?: boolean;
}) {
  return (
    <A
      href={href}
      className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-black transition ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
      }`}
    >
      <span className="flex items-center gap-3">
        <span className="w-5 text-center text-sm">{icon}</span>
        {title}
      </span>
      <span className="text-slate-300">›</span>
    </A>
  );
}

function KpiPanel({
  title,
  value,
  change,
  icon,
  color,
  points,
}: {
  title: string;
  value: string;
  change: string;
  icon: string;
  color: string;
  points: number[];
}) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-50",
    blue: "text-blue-600 bg-blue-50",
    violet: "text-violet-600 bg-violet-50",
    orange: "text-orange-600 bg-orange-50",
  };

  const strokeMap: Record<string, string> = {
    emerald: "#10b981",
    blue: "#3b82f6",
    violet: "#8b5cf6",
    orange: "#f97316",
  };

  return (
    <div className="border-b border-slate-100 p-4 last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-700">{title}</p>
          <p className="mt-2 text-[11px] font-bold text-slate-400">Bu dönem</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-2xl text-base font-black ${colorMap[color]}`}>
          {icon}
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-2xl font-black tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 text-[11px] font-black text-emerald-600">↑ {change}</p>
        </div>
        <Sparkline points={points} color={strokeMap[color]} />
      </div>
    </div>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const safePoints = points.length ? points : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...safePoints, 1);
  const min = Math.min(...safePoints, 0);
  const range = Math.max(max - min, 1);
  const coords = safePoints
    .map((point, index) => {
      const x = (index / Math.max(safePoints.length - 1, 1)) * 82;
      const y = 34 - ((point - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width="84" height="38" viewBox="0 0 84 38" className="shrink-0">
      <polyline points={coords} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RevenueChart({ trend }: { trend: TrendPoint[] }) {
  const values = trend.map((item) => item.value);
  const previous = trend.map((item) => item.previous);
  const all = [...values, ...previous];
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const range = Math.max(max - min, 1);

  function toPath(items: number[]) {
    return items
      .map((value, index) => {
        const x = 40 + (index / Math.max(items.length - 1, 1)) * 760;
        const y = 215 - ((value - min) / range) * 165;
        return `${index === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");
  }

  return (
    <div className="mt-5 h-[260px] w-full rounded-3xl bg-gradient-to-b from-white to-emerald-50/50 p-3">
      <svg viewBox="0 0 840 250" className="h-full w-full overflow-visible">
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1="38"
            x2="815"
            y1={42 + i * 42}
            y2={42 + i * 42}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}
        <path
          d={toPath(previous)}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="3"
          strokeDasharray="8 8"
          strokeLinecap="round"
        />
        <path
          d={toPath(values)}
          fill="none"
          stroke="#10b981"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {trend.map((item, index) => (
          <text key={item.label} x={42 + index * 126} y="242" fontSize="12" fill="#64748b" fontWeight="700">
            {item.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function TaskItem({
  icon,
  title,
  desc,
  time,
  tone,
}: {
  icon: string;
  title: string;
  desc: string;
  time: string;
  tone: "emerald" | "orange" | "red" | "blue";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
  }[tone];

  return (
    <div className="flex items-center gap-3 rounded-3xl p-2 transition hover:bg-slate-50">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${tones}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-950">{title}</p>
        <p className="truncate text-xs font-semibold text-slate-500">{desc}</p>
      </div>
      <div className="hidden text-xs font-bold text-slate-400 sm:block">{time}</div>
    </div>
  );
}

function DataCard({ title, action, children }: { title: string; action: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        <A href="/admin/siparisler" className="text-xs font-black text-emerald-600">
          {action}
        </A>
      </div>
      {children}
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs font-black uppercase tracking-wide text-slate-400">
            {headers.map((header) => (
              <th key={header} className="px-2 py-2.5">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-2 py-8 text-center text-sm font-bold text-slate-400">
                Veri bulunamadı
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="border-b border-slate-100 last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td key={`${index}-${cellIndex}`} className="px-2 py-2.5 font-bold text-slate-700">
                    {cellIndex === row.length - 1 && headers[cellIndex] === "Durum" ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                        {cell}
                      </span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function numberValue(value: any) {
  if (typeof value === "number") return value;

  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function getOrderRevenue(order: SiparisRow) {
  const directTotal = numberValue(order.bayiSatisToplam || order.toplam || order.tutar);
  if (directTotal > 0) return directTotal;

  const tonnage = getOrderTonnage(order);
  const price = numberValue(order.pesinSatisFiyati || order.satisFiyati || order.birimFiyat);
  return tonnage * price;
}

function getOrderTonnage(order: SiparisRow) {
  return numberValue(order.teslimOlanTonaj || order.siparisTonaj || order.tonaj);
}

function isInvoiced(order: SiparisRow) {
  return Boolean(order.sales_invoice_id || order.sales_invoice_no);
}

function getInvoiceStatus(s: SiparisRow) {
  const sevkDurumu = String(s.sevkDurumu || "").toLowerCase();
  const gts = String(s.gts || "").toLowerCase();
  const alis = String(s.gelenFatura || s.matched_purchase_invoice_no || "").toLowerCase();

  const sevkOk =
    sevkDurumu.includes("evet") ||
    sevkDurumu.includes("sevk edildi") ||
    sevkDurumu.includes("tamam") ||
    sevkDurumu.includes("yapildi") ||
    sevkDurumu.includes("yapıldı");

  const gtsOk =
    gts.includes("evet") ||
    gts.includes("girildi") ||
    gts.includes("cikis") ||
    gts.includes("çıkış") ||
    gts.includes("yapildi") ||
    gts.includes("yapıldı");

  const alisOk =
    Boolean(alis) &&
    !["hayir", "hayır", "yok", "false", "0", "bekliyor"].includes(alis);

  return {
    sevkOk,
    gtsOk,
    alisOk,
    canInvoice: sevkOk && gtsOk && alisOk,
  };
}

function getOrderStatusLabel(order: SiparisRow) {
  if (isInvoiced(order)) return "Tamamlandı";
  const status = getInvoiceStatus(order);
  if (status.canInvoice) return "Fatura Bekliyor";
  if (!status.alisOk) return "Alış Bekliyor";
  if (!status.gtsOk) return "GTS Bekliyor";
  if (!status.sevkOk) return "Sevk Bekliyor";
  return "Hazırlanıyor";
}

function getDateTime(value: any) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function buildTrend(orderRows: SiparisRow[], range: "month" | "all"): TrendPoint[] {
  const formatter = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
  });

  const today = new Date();
  const days = range === "month" ? 30 : 7;

  return Array.from({ length: days }).map((_, index) => {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - (days - 1 - index));

    const lastYearDate = new Date(currentDate);
    lastYearDate.setFullYear(currentDate.getFullYear() - 1);

    const currentKey = currentDate.toISOString().slice(0, 10);
    const previousKey = lastYearDate.toISOString().slice(0, 10);

    const value = orderRows
      .filter((order) => {
        const rawDate = order.satisTarihi || order.created_at;
        return String(rawDate || "").slice(0, 10) === currentKey;
      })
      .reduce((sum, order) => sum + getOrderRevenue(order), 0);

    const previous = orderRows
      .filter((order) => {
        const rawDate = order.satisTarihi || order.created_at;
        return String(rawDate || "").slice(0, 10) === previousKey;
      })
      .reduce((sum, order) => sum + getOrderRevenue(order), 0);

    return {
      label: formatter.format(currentDate).replace(".", ""),
      value,
      previous,
    };
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatMoneyShort(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
