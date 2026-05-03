"use client";

import { useEffect, useState } from "react";

function getStatusBadge(status: string) {
  const cleanStatus = (status || "").toLowerCase();

  if (cleanStatus === "completed") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (cleanStatus === "cancelled") {
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  }

  if (cleanStatus === "processing") {
    return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
  }

  if (cleanStatus === "pending") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }

  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function getStatusText(status: string) {
  const cleanStatus = (status || "").toLowerCase();

  if (cleanStatus === "completed") return "Tamamlandı";
  if (cleanStatus === "cancelled") return "İptal edildi";
  if (cleanStatus === "processing") return "Gönderiliyor";
  if (cleanStatus === "pending") return "Bekliyor";

  return status || "-";
}

export default function Page() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  async function loadCampaigns() {
    const res = await fetch("/api/admin/whatsapp/campaigns");
    const data = await res.json();

    if (data.success) {
      setCampaigns(data.campaigns || []);
    } else {
      setMessage("❌ Raporlar yüklenemedi: " + data.error);
    }
  }

  async function cancelCampaign(campaignId: string) {
    if (!confirm("Bu kampanyanın kalan gönderimleri iptal edilsin mi?")) {
      return;
    }

    const res = await fetch("/api/admin/whatsapp/campaigns/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ campaignId }),
    });

    const data = await res.json();

    if (!data.success) {
      setMessage("❌ İptal edilemedi: " + JSON.stringify(data.error || data));
      return;
    }

    setMessage("✅ Kampanyanın kalan pending mesajları iptal edildi.");
    await loadCampaigns();
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">WhatsApp Gönderim Raporları</h1>
          <p className="mt-2 text-sm text-slate-500">
            Kuyruğa alınan kampanyaların durumunu buradan takip edebilirsin.
          </p>

          <div className="mt-4 flex gap-3">
            <a
              href="/admin/whatsapp/gonder"
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Gönderime Dön
            </a>

            <button
              type="button"
              onClick={loadCampaigns}
              className="rounded-xl border px-4 py-2 text-sm font-medium"
            >
              Yenile
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
              {message}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-3">Şablon</th>
                <th className="p-3">Durum</th>
                <th className="p-3">İlerleme</th>
                <th className="p-3">Toplam</th>
                <th className="p-3">Başarılı</th>
                <th className="p-3">Başarısız</th>
                <th className="p-3">Kalan Süre</th>
                <th className="p-3">Tarih</th>
                <th className="p-3">İşlem</th>
              </tr>
            </thead>

            <tbody>
              {campaigns.map((c) => {
                const total = c.total_count || 0;
                const success = c.success_count || 0;
                const failed = c.fail_count || 0;
                const done = success + failed;
                const remaining = Math.max(total - done, 0);
                const percent = total > 0 ? Math.round((done / total) * 100) : 0;
                const perMinute = 20;
                const minutes = Math.ceil(remaining / perMinute);

                const remainingText =
                  remaining <= 0
                    ? "Tamamlandı"
                    : `${done}/${total} — ~${minutes} dk kaldı`;

                const canCancel =
                  c.status !== "completed" &&
                  c.status !== "cancelled" &&
                  total > done;

                return (
                  <tr key={c.id} className="border-t align-middle">
                    <td className="p-3 font-medium">{c.template_name || "-"}</td>

                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusBadge(
                          c.status
                        )}`}
                      >
                        {getStatusText(c.status)}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="w-36">
                        <div className="mb-1 flex justify-between text-xs text-slate-500">
                          <span>{done}/{total}</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-[#00a884]"
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="p-3">{total}</td>
                    <td className="p-3 font-semibold text-green-700">{success}</td>
                    <td className="p-3 font-semibold text-red-700">{failed}</td>

                    <td className="p-3 text-xs font-medium text-slate-600">
                      {remainingText}
                    </td>

                    <td className="p-3">
                      {c.created_at
                        ? new Date(c.created_at).toLocaleString("tr-TR")
                        : "-"}
                    </td>

                    <td className="p-3">
                      {canCancel ? (
                        <button
                          type="button"
                          onClick={() => cancelCampaign(c.id)}
                          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                        >
                          İptal Et
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {campaigns.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={9}>
                    Henüz gönderim raporu yok.
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