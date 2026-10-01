"use client";

import { useEffect, useState, type FormEvent } from "react";

const urunler = [
  "Granül Üre",
  "CAN 26",
  "Kristal Amonyum Sülfat",
  "33 Amonyum Nitrat",
  "8.20.0",
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
  const [productNames, setProductNames] = useState(urunler);
  const [newProductName, setNewProductName] = useState("");
  const [productsLoading, setProductsLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productError, setProductError] = useState("");
  const [productNotice, setProductNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadProducts() {
      try {
        const response = await fetch("/api/admin/order-form-options", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.options)) {
          throw new Error("Ürün listesi yüklenemedi. Lütfen sayfayı yenileyin.");
        }
        const names = [...urunler];
        for (const option of result.options) {
          if (option.type !== "urunler" || typeof option.name !== "string") continue;
          const name = option.name.trim();
          if (name && !names.some((existing) => existing.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) {
            names.push(name);
          }
        }
        setProductNames(names);
      } catch {
        if (!controller.signal.aborted) {
          setProductError("Kayıtlı ürünler yüklenemedi. Lütfen sayfayı yenileyin.");
        }
      } finally {
        if (!controller.signal.aborted) setProductsLoading(false);
      }
    }
    void loadProducts();
    return () => controller.abort();
  }, []);

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingProduct || productsLoading) return;
    const name = newProductName.trim().replace(/\s+/g, " ");
    setProductNotice("");
    if (!name) {
      setProductError("Lütfen ürün adını yazın.");
      return;
    }
    if (productNames.some((existing) => existing.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) {
      setProductError("Bu ürün zaten listede var.");
      return;
    }
    setSavingProduct(true);
    setProductError("");
    try {
      const response = await fetch("/api/admin/order-form-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "urunler", name }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Ürün kaydedilemedi. Lütfen tekrar deneyin.");
      }
      setProductNames((current) => [...current, result.option.name]);
      setNewProductName("");
      setProductNotice(`${result.option.name} ürün listesine eklendi.`);
    } catch (error) {
      setProductError(error instanceof Error ? error.message : "Ürün kaydedilemedi. Lütfen tekrar deneyin.");
    } finally {
      setSavingProduct(false);
    }
  }

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
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-black">Fiyat Formu Oluştur</h1>
            <p className="mt-2 text-sm text-slate-500">
              Ürün, depo, teslim şekli ve fiyatları girerek PDF oluştur.
            </p>
          </div>

          <div className="w-full lg:w-80">
            <a href="/admin" className="mb-4 block font-bold text-emerald-800 lg:text-right">
              ← Admin Panel
            </a>
            <form onSubmit={addProduct} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <label htmlFor="new-product-name" className="block text-sm font-bold text-emerald-900">
                Ürün Adı Ekle
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="new-product-name"
                  value={newProductName}
                  onChange={(event) => setNewProductName(event.target.value)}
                  placeholder="Ürün adı"
                  maxLength={120}
                  required
                  disabled={savingProduct || productsLoading}
                  className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={savingProduct || productsLoading}
                  className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {savingProduct ? "Ekleniyor…" : "Ekle"}
                </button>
              </div>
              {productError && <p role="alert" className="mt-2 text-sm text-red-700">{productError}</p>}
              {productNotice && <p role="status" className="mt-2 text-sm text-emerald-800">{productNotice}</p>}
            </form>
          </div>
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
                      {productNames.map((urun) => (
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
