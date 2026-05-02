"use client";

import { useEffect, useState } from "react";

export default function WhatsAppAyarlarPage() {
  const [form, setForm] = useState({
    whatsapp_token: "",
    whatsapp_phone_number_id: "",
    whatsapp_api_version: "v23.0",
    whatsapp_waba_id: "",
    whatsapp_webhook_verify_token: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadSettings() {
    setLoading(true);
    const res = await fetch("/api/admin/whatsapp/settings", {
      cache: "no-store",
    });
    const data = await res.json();

    if (data.success && data.settings) {
      setForm({
        whatsapp_token: data.settings.whatsapp_token || "",
        whatsapp_phone_number_id: data.settings.whatsapp_phone_number_id || "",
        whatsapp_api_version: data.settings.whatsapp_api_version || "v23.0",
        whatsapp_waba_id: data.settings.whatsapp_waba_id || "",
        whatsapp_webhook_verify_token:
          data.settings.whatsapp_webhook_verify_token || "",
      });
    }

    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    setMsg("Kaydediliyor...");

    const res = await fetch("/api/admin/whatsapp/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (data.success) {
      setMsg("✅ WhatsApp API ayarları kaydedildi.");
    } else {
      setMsg("❌ " + JSON.stringify(data.error || data));
    }

    setSaving(false);
  }

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading) {
    return <main className="p-8">Yükleniyor...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">WhatsApp API Ayarları</h1>
        <p className="mt-2 text-sm text-slate-500">
          Token, Phone Number ID, WABA ID ve webhook verify token bilgilerini
          buradan güncelleyebilirsin.
        </p>

        <div className="mt-6 space-y-4">
          <Field
            label="WHATSAPP_TOKEN"
            value={form.whatsapp_token}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, whatsapp_token: value }))
            }
          />

          <Field
            label="WHATSAPP_PHONE_NUMBER_ID"
            value={form.whatsapp_phone_number_id}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                whatsapp_phone_number_id: value,
              }))
            }
          />

          <Field
            label="WHATSAPP_API_VERSION"
            value={form.whatsapp_api_version}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, whatsapp_api_version: value }))
            }
          />

          <Field
            label="WHATSAPP_WABA_ID"
            value={form.whatsapp_waba_id}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, whatsapp_waba_id: value }))
            }
          />

          <Field
            label="WHATSAPP_WEBHOOK_VERIFY_TOKEN"
            value={form.whatsapp_webhook_verify_token}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                whatsapp_webhook_verify_token: value,
              }))
            }
          />
        </div>

        {msg && (
          <div className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm">
            {msg}
          </div>
        )}

        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
      />
    </label>
  );
}