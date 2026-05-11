"use client";

import { useState } from "react";

const urunler = [
  "Granül Üre",
  "CAN 26",
  "Kristal Amonyum Sülfat",
  "33 Amonyum Nitrat",
  "20.20.0",
  "Süper 20.20.0",
  "Granül Amonyum Sülfat",
  "15.15.15",
  "DAP",
];

const teslimSekilleri = ["Hariç", "Dahil"];

type Row = {
  urun: string;
  depo: string;
  teslim: string;
  pesin: string;
  kredi: string;
};

export default function FiyatFormuPage() {
  const [rows, setRows] = useState<Row[]>(
    Array.from({ length: 10 }).map(() => ({
      urun: "",
      depo: "",
      teslim: "",
      pesin: "",
      kredi: "",
    }))
  );

  function updateRow(index: number, key: keyof Row, value: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { urun: "", depo: "", teslim: "", pesin: "", kredi: "" },
    ]);
  }

  function createPdf() {
    const encoded = encodeURIComponent(JSON.stringify(rows));
    window.open(`/admin/fiyat-formu/preview?rows=${encoded}`, "_blank");
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-900">
      <div className="mx-auto max-w-6xl rounded-3xl bg-white p-8 shadow">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Fiyat Formu Oluştur</h1>
            <p className="mt-2 text-sm text-slate-500">
              Ürün, depo, teslim şekli ve fiyatları girerek PDF oluştur.
            </p>
          </div>

          <a href="/admin" className="font-bold text-emerald-800">
            ← Admin Panel
          </a>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Gübre Cinsi</th>
                <th className="p-3">Depo Sevk Yeri</th>
                <th className="p-3">Teslim Şekli</th>
                <th className="p-3">Peşin (TON)</th>
                <th className="p-3">Kredi Kartı (TON)</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2">
                    <select
                      value={row.urun}
                      onChange={(e) => updateRow(index, "urun", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2"
                    >
                      <option value="">Ürün seç</option>
                      {urunler.map((urun) => (
                        <option key={urun} value={urun}>
                          {urun}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-2">
                    <input
                      value={row.depo}
                      onChange={(e) => updateRow(index, "depo", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="Örn: Marmara,Ege"
                    />
                  </td>

                  <td className="p-2">
                    <select
                      value={row.teslim}
                      onChange={(e) =>
                        updateRow(index, "teslim", e.target.value)
                      }
                      className="w-full rounded-lg border px-3 py-2"
                    >
                      <option value="">Seç</option>
                      {teslimSekilleri.map((teslim) => (
                        <option key={teslim} value={teslim}>
                          {teslim}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-2">
                    <input
                      value={row.pesin}
                      onChange={(e) =>
                        updateRow(index, "pesin", e.target.value)
                      }
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="29.750 / Fiyat Alınız"
                    />
                  </td>

                  <td className="p-2">
                    <input
                      value={row.kredi}
                      onChange={(e) =>
                        updateRow(index, "kredi", e.target.value)
                      }
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="31.650 / Fiyat Alınız"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={addRow}
            className="rounded-xl border px-5 py-3 font-bold"
          >
            Satır Ekle
          </button>

          <button
            type="button"
            onClick={createPdf}
            className="flex-1 rounded-xl bg-emerald-900 px-5 py-3 font-black text-white"
          >
            PDF Al
          </button>
        </div>
      </div>
    </main>
  );
}