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

const depoSevkYerleri = [
  "Mersin",
  "Hatay",
  "İskenderun",
  "Marmara",
  "Ege",
  "Akdeniz",
  "Karadeniz",
  "Samsun",
  "Tüm Bölgeler",
];

const fieldClassName =
  "min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 lg:rounded-lg lg:text-sm";

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

  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem("niba-price-draft") || "null");
      // Restore browser-only draft after hydration when returning from preview.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(draft) && draft.length && draft.every(row => row && ["urun", "depo", "teslim", "pesin", "kredi"].every(key => typeof row[key] === "string"))) setRows(draft);
    } catch { /* An unavailable draft must not prevent editing. */ }
  }, []);

  function createPdf() {
    try { sessionStorage.setItem("niba-price-draft", JSON.stringify(rows)); } catch { /* Preview still works without storage. */ }
    const encoded = encodeURIComponent(JSON.stringify(rows));
    window.location.assign(`/admin/fiyat-formu/preview?rows=${encoded}`);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-4 shadow sm:p-6 lg:rounded-3xl lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-black">Fiyat Formu Oluştur</h1>
            <p className="mt-2 text-sm text-slate-500">
              Ürün ve fiyatları gir, sevk bölgelerini seç. Fiyat listesini önizleyip görsel olarak paylaş.
            </p>
          </div>

          <div className="w-full lg:w-80 lg:shrink-0">
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
                  className={`${fieldClassName} flex-1`}
                />
                <button
                  type="submit"
                  disabled={savingProduct || productsLoading}
                  className="min-h-12 shrink-0 rounded-lg bg-emerald-900 px-4 py-2 text-base font-bold text-white disabled:opacity-50"
                >
                  {savingProduct ? "Ekleniyor…" : "Ekle"}
                </button>
              </div>
              {productError && <p role="alert" className="mt-2 text-sm text-red-700">{productError}</p>}
              {productNotice && <p role="status" className="mt-2 text-sm text-emerald-800">{productNotice}</p>}
            </form>
          </div>
        </div>

        <div className="mt-6 space-y-4 lg:mt-8 lg:space-y-0 lg:rounded-2xl lg:border lg:border-slate-200">
          <div aria-hidden="true" className="hidden grid-cols-5 gap-3 rounded-t-2xl bg-slate-100 px-3 py-4 text-sm font-bold lg:grid">
            <span>Gübre Cinsi</span>
            <span>Depo Sevk Yeri</span>
            <span>Teslim Şekli</span>
            <span>Peşin (TON)</span>
            <span>Kredi Kartı (TON)</span>
          </div>
          {rows.map((row, index) => (
            <fieldset key={index} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:rounded-none lg:border-0 lg:border-t lg:bg-white lg:p-3 lg:last:rounded-b-2xl">
              <legend className="px-2 text-sm font-bold text-emerald-900 lg:sr-only">
                {index + 1}. Ürün
              </legend>
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
                <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                  <label htmlFor={`urun-${index}`} className="mb-2 block text-sm font-semibold lg:sr-only">Gübre Cinsi</label>
                  <select
                    id={`urun-${index}`}
                    value={row.urun}
                    onChange={(e) => updateRow(index, "urun", e.target.value)}
                    className={fieldClassName}
                  >
                    <option value="">Ürün seç</option>
                    {productNames.map((urun) => <option key={urun} value={urun}>{urun}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label htmlFor={`depo-${index}`} className="mb-2 block text-sm font-semibold lg:sr-only">Depo Sevk Yeri</label>
                  <details className="group relative min-w-0 rounded-xl border border-slate-300 bg-white">
                    <summary id={`depo-${index}`} className="min-h-12 cursor-pointer list-none px-3 py-3 text-base focus-visible:outline-2 focus-visible:outline-emerald-700 lg:text-sm">
                      <span className="flex items-center justify-between gap-2"><span className="min-w-0 break-words">{row.depo || "Depo / bölge seç"}</span><span aria-hidden="true" className="shrink-0 text-slate-500">⌄</span></span>
                    </summary>
                    <div className="border-t border-slate-200 p-2">
                      <p className="px-2 py-1 text-xs text-slate-500">Birden fazla bölge seçebilirsin.</p>
                      {depoSevkYerleri.map(depo => {
                        const selected = row.depo.split(", ").filter(Boolean);
                        return <label key={depo} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-emerald-50">
                          <input type="checkbox" checked={selected.includes(depo)} className="h-5 w-5 accent-emerald-800" onChange={event => {
                            const next = event.target.checked
                              ? depo === "Tüm Bölgeler" ? [depo] : [...selected.filter(value => value !== "Tüm Bölgeler"), depo]
                              : selected.filter(value => value !== depo);
                            updateRow(index, "depo", next.join(", "));
                          }} />
                          <span className="text-sm">{depo}</span>
                        </label>;
                      })}
                      <button type="button" onClick={() => updateRow(index, "depo", "")} className="min-h-11 px-2 text-sm font-semibold text-emerald-800">Seçimi temizle</button>
                    </div>
                  </details>
                </div>
                <div className="min-w-0">
                  <label htmlFor={`teslim-${index}`} className="mb-2 block text-sm font-semibold lg:sr-only">Teslim Şekli</label>
                  <select
                    id={`teslim-${index}`}
                    value={row.teslim}
                    onChange={(e) => updateRow(index, "teslim", e.target.value)}
                    className={fieldClassName}
                  >
                    <option value="">Teslim şekli seç</option>
                    {teslimSekilleri.map((teslim) => <option key={teslim} value={teslim}>{teslim}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label htmlFor={`pesin-${index}`} className="mb-2 block text-sm font-semibold lg:sr-only">Peşin (TON)</label>
                  <input
                    id={`pesin-${index}`}
                    value={row.pesin}
                    onChange={(e) => updateRow(index, "pesin", e.target.value)}
                    className={fieldClassName}
                    placeholder="29.750 / Fiyat Alınız"
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor={`kredi-${index}`} className="mb-2 block text-sm font-semibold lg:sr-only">Kredi Kartı (TON)</label>
                  <input
                    id={`kredi-${index}`}
                    value={row.kredi}
                    onChange={(e) => updateRow(index, "kredi", e.target.value)}
                    className={fieldClassName}
                    placeholder="31.650 / Fiyat Alınız"
                  />
                </div>
              </div>
            </fieldset>
          ))}
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex gap-3 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:px-0 lg:py-0">
          <button
            type="button"
            onClick={addRow}
            className="min-h-12 flex-1 rounded-xl border border-slate-300 px-3 py-3 font-bold sm:flex-none sm:px-5"
          >
            Satır Ekle
          </button>

          <button
            type="button"
            onClick={createPdf}
            disabled={!rows.some(row => row.urun || row.depo || row.teslim || row.pesin || row.kredi)}
            className="min-h-12 flex-1 rounded-xl bg-emerald-900 px-3 py-3 font-black text-white disabled:opacity-40 sm:px-5"
          >
            Önizle ve Paylaş
          </button>
        </div>
      </div>
    </main>
  );
}
