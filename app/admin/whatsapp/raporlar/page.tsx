"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    loadCampaigns();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
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
            <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
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
                <th className="p-3">Toplam</th>
                <th className="p-3">Başarılı</th>
                <th className="p-3">Başarısız</th>
                <th className="p-3">Tarih</th>
              </tr>
            </thead>

            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3 font-medium">{c.template_name || "-"}</td>
                  <td className="p-3">{c.status || "-"}</td>
                  <td className="p-3">{c.total_count || 0}</td>
                  <td className="p-3 text-green-700">{c.success_count || 0}</td>
                  <td className="p-3 text-red-700">{c.fail_count || 0}</td>
                  <td className="p-3">
                    {c.created_at
                      ? new Date(c.created_at).toLocaleString("tr-TR")
                      : "-"}
                  </td>
                </tr>
              ))}

              {campaigns.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={6}>
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