"use client";

import { useState } from "react";

export default function Page() {
  const [to, setTo] = useState("");
  const [languageCode, setLanguageCode] = useState("tr");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const templateName = "hello_world";

  async function sendMessage() {
    setLoading(true);
    setResult("");

    try {
      const res = await fetch("/api/admin/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          templateName,
          languageCode,
          variables: [],
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResult("✅ TEST mesajı başarıyla gönderildi");
      } else {
        setResult("❌ Hata: " + JSON.stringify(data.error));
      }
    } catch {
      setResult("❌ Sistem hatası oluştu");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          WhatsApp TEST Mesajı
        </h1>

        <div className="mt-6 space-y-4">
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Telefon: 905xxxxxxxxx"
            className="w-full rounded-xl border border-slate-300 px-4 py-3"
          />

          <input
            value={templateName}
            readOnly
            className="w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3"
          />

          <input
            value={languageCode}
            onChange={(e) => setLanguageCode(e.target.value)}
            placeholder="Dil kodu: tr veya tr_TR"
            className="w-full rounded-xl border border-slate-300 px-4 py-3"
          />

          <button
            onClick={sendMessage}
            disabled={loading || !to}
            className="w-full rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Gönderiliyor..." : "TEST WhatsApp Gönder"}
          </button>

          {result && (
            <div className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
              {result}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}