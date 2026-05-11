"use client";

import { useEffect, useState } from "react";

function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase();

  if (s === "completed") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (s === "cancelled") {
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  }

  if (s === "processing") {
    return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
  }

  if (s === "pending") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }

  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function getStatusText(status: string) {
  const s = (status || "").toLowerCase();

  if (s === "completed") return "Tamamlandı";
  if (s === "cancelled") return "İptal";
  if (s === "processing") return "Gönderiliyor";
  if (s === "pending") return "Bekliyor";

  return "-";
}

function getRealStatus(c: any) {
  const total = c.total_count || 0;
  const success = c.success_count || 0;
  const fail = c.fail_count || 0;
  const done = success + fail;
  const dbStatus = (c.status || "").toLowerCase();

  if (dbStatus === "cancelled") return "cancelled";
  if (total > 0 && done >= total) return "completed";
  if (total > 0 && done < total) return "processing";

  return dbStatus || "pending";
}

function formatDate(value?: string) {
  if (!value) return "-";

  try {
    return new Date(value + "Z").toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
    });
  } catch {
    return "-";
  }
}

export default function Page() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  async function loadCampaigns() {
    try {
      setLoading(true);

      const res = await fetch(`/api/admin/whatsapp/campaigns?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (data.success) {
        setCampaigns(data.campaigns || []);
        setLastUpdated(
          new Date().toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        );
      } else {
        setMessage("❌ Raporlar yüklenemedi: " + JSON.stringify(data.error));
      }
    } catch (err) {
      setMessage("❌ Raporlar yüklenemedi: " + String(err));
    } finally {
      setLoading(false);
    }
  }

  async function cancelCampaign(id: string) {
    if (!confirm("Bu kampanyanın kalan gönderimleri iptal edilsin mi?")) {
      return;
    }

    try {
      setMessage("");

      const res = await fetch("/api/admin/whatsapp/campaigns/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ campaignId: id }),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage("❌ İptal edilemedi: " + JSON.stringify(data.error || data));
        return;
      }

      setMessage("✅ Kampanyanın kalan pending mesajları iptal edildi.");
      await loadCampaigns();
    } catch (err) {
      setMessage("❌ İptal hatası: " + String(err));
    }
  }

  useEffect(() => {
    loadCampaigns();

    const interval = setInterval(() => {
      loadCampaigns();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-[#eef1ea] p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
                Niba Tarım
              </p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                WhatsApp Gönderim Raporları
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Canlı gönderim takibi. Sayfa otomatik yenilenir.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {lastUpdated && (
                <div className="hidden rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 md:block">
                  ● Son güncelleme: {lastUpdated}
                </div>
              )}

              <a
                href="/admin/whatsapp/gonder"
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
              >
                Gönderime Dön
              </a>

              <button
                type="button"
                onClick={loadCampaigns}
                disabled={loading}
                className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white transition active:scale-95 disabled:opacity-50"
              >
                {loading ? "Güncelleniyor..." : "Yenile"}
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-100">
              {message}
            </div>
          )}
        </section>

        <section className="space-y-2">
          {campaigns.map((c) => {
            const total = c.total_count || 0;
            const success = c.success_count || 0;
            const fail = c.fail_count || 0;
            const done = success + fail;
            const remaining = Math.max(total - done, 0);
            const percent =
              total > 0 ? Math.min(Math.round((done / total) * 100), 100) : 0;

            const status = getRealStatus(c);
            const perMinute = 15;
            const minutes = Math.ceil(remaining / perMinute);

            const canCancel =
              status !== "completed" &&
              status !== "cancelled" &&
              total > done;

            return (
              <div
                key={c.id}
                className="rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100"
              >
                <div className="grid gap-3 md:grid-cols-[230px_1fr_360px_90px] md:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-black text-slate-950">
                        {c.template_name || "-"}
                      </p>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${getStatusBadge(
                          status,
                        )}`}
                      >
                        {getStatusText(status)}
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {formatDate(c.created_at)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-500">
                        {done}/{total}
                      </span>
                      <span className="font-black text-slate-900">
                        %{percent}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          status === "cancelled" ? "bg-red-400" : "bg-[#00a884]"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      {status === "completed"
                        ? "Tamamlandı"
                        : status === "cancelled"
                          ? `${remaining} mesaj kaldı`
                          : `${remaining} kaldı · yaklaşık ${minutes} dk`}
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                      <p className="text-[10px] font-bold text-slate-400">
                        Toplam
                      </p>
                      <p className="text-sm font-black text-slate-950">
                        {total}
                      </p>
                    </div>

                    <div className="rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-600">
                        Başarılı
                      </p>
                      <p className="text-sm font-black text-emerald-700">
                        {success}
                      </p>
                    </div>

                    <div className="rounded-xl bg-red-50 px-3 py-2 ring-1 ring-red-100">
                      <p className="text-[10px] font-bold text-red-600">
                        Hata
                      </p>
                      <p className="text-sm font-black text-red-700">{fail}</p>
                    </div>

                    <div className="rounded-xl bg-blue-50 px-3 py-2 ring-1 ring-blue-100">
                      <p className="text-[10px] font-bold text-blue-600">
                        Kalan
                      </p>
                      <p className="text-sm font-black text-blue-700">
                        {remaining}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {canCancel ? (
                      <button
                        type="button"
                        onClick={() => cancelCampaign(c.id)}
                        className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600 ring-1 ring-red-100 hover:bg-red-100"
                      >
                        İptal
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">-</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {campaigns.length === 0 && (
            <div className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-sm ring-1 ring-slate-100">
              Henüz gönderim raporu yok.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}