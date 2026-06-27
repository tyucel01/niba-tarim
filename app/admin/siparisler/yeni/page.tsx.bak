"use client";

import { useEffect, useMemo, useState } from "react";

type OptionKey = "bayiler" | "odemeler" | "depolar" | "urunler";

export default function FormPage() {
  const [form, setForm] = useState({
    bayi: "",
    tarih: "",
    odeme: "",
    depo: "",
    nakliye: "",
    urun: "",
    miktar: "",
    fiyat: "",
    sevk: "",
  });

  const [options, setOptions] = useState<Record<OptionKey, string[]>>({
    bayiler: [],
    odemeler: [],
    depolar: [],
    urunler: [],
  });

  async function loadOptions() {
    const res = await fetch("/api/admin/order-form-options", {
      cache: "no-store",
    });
    const data = await res.json();

    if (!data.success) return;

    const next: Record<OptionKey, string[]> = {
      bayiler: [],
      odemeler: [],
      depolar: [],
      urunler: [],
    };

    for (const item of data.options || []) {
      if (item.type in next) {
        next[item.type as OptionKey].push(item.name);
      }
    }

    setOptions(next);
  }

  useEffect(() => {
    loadOptions();
  }, []);

  function update(name: string, value: string) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function createOption(key: OptionKey, value: string) {
    const cleanValue = value.trim();

    if (!cleanValue) {
      alert("Boş değer eklenemez.");
      return;
    }

    const exists = options[key].some(
      (item) => item.trim().toLowerCase() === cleanValue.toLowerCase()
    );

    if (exists) {
      alert("Bu kayıt zaten var.");
      return;
    }

    const res = await fetch("/api/admin/order-form-options", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: key, name: cleanValue }),
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.error || "Kayıt eklenemedi.");
      return;
    }

    setOptions((prev) => ({
      ...prev,
      [key]: [...prev[key], cleanValue],
    }));

    if (key === "bayiler") update("bayi", cleanValue);
    if (key === "odemeler") update("odeme", cleanValue);
    if (key === "depolar") update("depo", cleanValue);
    if (key === "urunler") update("urun", cleanValue);
  }

  const toplamTutar = useMemo(() => {
    const miktar = Number(form.miktar.replace(",", "."));
    const fiyat = Number(form.fiyat.replace(",", "."));

    if (!miktar || !fiyat) return 0;

    return miktar * fiyat;
  }, [form.miktar, form.fiyat]);

  function olustur() {
    const params = new URLSearchParams({
      ...form,
      toplam: String(toplamTutar),
    });

    window.open(`/admin/siparisler/form/preview?${params}`, "_blank");
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow">
        <h1 className="text-2xl font-black">Sipariş Formu Oluştur</h1>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ComboboxWithCreate
            label="Bayi"
            value={form.bayi}
            options={options.bayiler}
            onChange={(v) => update("bayi", v)}
            onCreate={(v) => createOption("bayiler", v)}
          />

          <Input
            type="date"
            label="Tarih"
            value={form.tarih}
            onChange={(v) => update("tarih", v)}
          />

          <ComboboxWithCreate
            label="Ödeme Şekli"
            value={form.odeme}
            options={options.odemeler}
            onChange={(v) => update("odeme", v)}
            onCreate={(v) => createOption("odemeler", v)}
          />

          <ComboboxWithCreate
            label="Çıkış Deposu"
            value={form.depo}
            options={options.depolar}
            onChange={(v) => update("depo", v)}
            onCreate={(v) => createOption("depolar", v)}
          />

          <div>
            <p className="text-sm font-bold text-slate-600">Nakliye Durumu</p>
            <select
              value={form.nakliye}
              onChange={(e) => update("nakliye", e.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-3"
            >
              <option value="">Seçiniz</option>
              <option value="Hariç">Hariç</option>
              <option value="Dahil">Dahil</option>
            </select>
          </div>

          <ComboboxWithCreate
            label="Ürün"
            value={form.urun}
            options={options.urunler}
            onChange={(v) => update("urun", v)}
            onCreate={(v) => createOption("urunler", v)}
          />

          <Input
            label="Miktar (Ton)"
            value={form.miktar}
            onChange={(v) => update("miktar", v)}
          />

          <Input
            label="Birim Fiyat"
            value={form.fiyat}
            onChange={(v) => update("fiyat", v)}
          />



          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-sm font-bold text-slate-600">Toplam Tutar</p>
            <p className="mt-2 text-2xl font-black text-emerald-900">
              {toplamTutar.toLocaleString("tr-TR")} TL
            </p>
          </div>
        </div>

        <button
          onClick={olustur}
          className="mt-6 w-full rounded-xl bg-emerald-900 py-4 font-black text-white"
        >
          Formu Oluştur
        </button>
      </div>
    </main>
  );
}

function Input({
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
    <div>
      <p className="text-sm font-bold text-slate-600">{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border px-4 py-3"
      />
    </div>
  );
}

function ComboboxWithCreate({
  label,
  value,
  options,
  onChange,
  onCreate,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onCreate: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const filteredOptions = options.filter((item) =>
    item.toLowerCase().includes(value.toLowerCase())
  );

  const exactExists = options.some(
    (item) => item.trim().toLowerCase() === value.trim().toLowerCase()
  );

  return (
    <div className="relative">
      <p className="text-sm font-bold text-slate-600">{label}</p>

      <input
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        placeholder={`${label} seç veya yeni yaz`}
        className="mt-2 w-full rounded-xl border px-4 py-3"
      />

      {open && (
        <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border bg-white shadow-lg">
          {filteredOptions.map((item) => (
            <button
              key={item}
              type="button"
              onMouseDown={() => {
                onChange(item);
                setOpen(false);
              }}
              className="block w-full px-4 py-3 text-left text-sm hover:bg-emerald-50"
            >
              {item}
            </button>
          ))}

          {value.trim() && !exactExists && (
            <button
              type="button"
              onMouseDown={() => {
                onCreate(value);
                setOpen(false);
              }}
              className="block w-full border-t px-4 py-3 text-left text-sm font-bold text-emerald-800 hover:bg-emerald-50"
            >
              + “{value.trim()}” yeni olarak ekle
            </button>
          )}

          {filteredOptions.length === 0 && !value.trim() && (
            <div className="px-4 py-3 text-sm text-slate-400">
              Yazmaya başlayın.
            </div>
          )}
        </div>
      )}
    </div>
  );
}