"use client";

import Link from "next/link";
import { useState } from "react";

export default function SiparisImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleImport() {
    if (!file) {
      alert("Lütfen Excel veya CSV dosyası seçin.");
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/siparisler/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setResult({
        success: false,
        error: "Import sırasında hata oluştu.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef1ea] p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link
          href="/admin/siparisler"
          prefetch={false}
          className="font-black text-emerald-800"
        >
          ← Siparişlere Dön
        </Link>

        <section className="rounded-[32px] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
            Supabase Import
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Sipariş Import
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Geçmiş siparişleri Excel veya CSV dosyasıyla tek seferde
            Supabase siparisler tablosuna aktarın.
          </p>
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <div className="text-5xl">📥</div>

            <h2 className="mt-4 text-2xl font-black text-slate-950">
              Excel / CSV Dosyası Yükle
            </h2>

            <p className="mt-2 text-sm font-semibold text-slate-500">
              Şablondaki kolon isimleri Supabase siparisler tablosuyla uyumlu
              olmalıdır.
            </p>

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mx-auto mt-6 block max-w-md rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"
            />

            {file && (
              <p className="mt-4 text-sm font-black text-emerald-700">
                Seçilen dosya: {file.name}
              </p>
            )}

            <button
              type="button"
              onClick={handleImport}
              disabled={loading || !file}
              className="mt-6 rounded-2xl bg-gradient-to-r from-[#00a884] to-[#00c297] px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/10 disabled:opacity-50"
            >
              {loading ? "Aktarılıyor..." : "Siparişleri İçeri Aktar"}
            </button>
          </div>

          {result && (
            <div
              className={`mt-6 rounded-3xl p-5 ${
                result.success
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                  : "bg-red-50 text-red-800 ring-1 ring-red-100"
              }`}
            >
              <p className="text-lg font-black">
                {result.success ? "Import tamamlandı" : "Import başarısız"}
              </p>

              {result.success ? (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Stat label="Okunan Satır" value={result.totalRows || 0} />
                  <Stat label="Aktarılan" value={result.inserted || 0} />
                  <Stat label="Atlanan" value={result.skipped || 0} />
                </div>
              ) : (
                <pre className="mt-3 whitespace-pre-wrap text-xs">
                  {result.error || result.detail || "Bilinmeyen hata"}
                </pre>
              )}

              {result.errors?.length > 0 && (
                <div className="mt-4 rounded-2xl bg-white/70 p-4">
                  <p className="font-black">Satır Hataları</p>

                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                    {JSON.stringify(result.errors, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <p className="text-xs font-bold opacity-60">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}