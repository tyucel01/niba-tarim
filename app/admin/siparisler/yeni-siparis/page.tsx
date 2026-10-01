"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type FormState = {
  satisId: string;
  satisTarihi: string;
  bayi: string;
  tedarikciler: string;
  siparisAlan: string;
  urun: string;
  marka: string;
  alisFiyati: string;
  faturaNo: string;
  tedarikciFaturaTutar: string;
  pesinSatisFiyati: string;
  siparisTonaj: string;
  teslimOlanTonaj: string;
  yapilanOdeme: string;
  satisTuru: string;
  vadeTarihi: string;
  vadeFarki: string;
  vadeSuresi: string;
  not: string;
  nakliye: string;
  plaka: string;
  sevkYeri: string;
  sevkDurumu: string;
  gelenFatura: string;
  sevkNo: string;
  gts: string;
  fatura: string;
};

const initialForm: FormState = {
  satisId: "",
  satisTarihi: "",
  bayi: "",
  tedarikciler: "",
  siparisAlan: "",
  urun: "",
  marka: "",
  alisFiyati: "",
  faturaNo: "",
  tedarikciFaturaTutar: "",
  pesinSatisFiyati: "",
  siparisTonaj: "",
  teslimOlanTonaj: "",
  yapilanOdeme: "",
  satisTuru: "Peşin",
  vadeTarihi: "",
  vadeFarki: "",
  vadeSuresi: "",
  not: "",
  nakliye: "",
  plaka: "",
  sevkYeri: "",
  sevkDurumu: "Bekliyor",
  gelenFatura: "Bekliyor",
  sevkNo: "",
  gts: "Yok",
  fatura: "Kesilecek",
};

const suggestionFields: Array<keyof FormState> = [
  "bayi",
  "tedarikciler",
  "siparisAlan",
  "urun",
  "marka",
  "plaka",
  "sevkYeri",
];

const selectOptions: Partial<Record<keyof FormState, string[]>> = {
  satisTuru: ["Peşin", "Vadeli", "Kredi Kartı", "Havale", "Çek"],
  sevkDurumu: ["Bekliyor", "Sevk Edildi", "Kısmi Sevk", "Tamamlandı", "İptal"],
  gelenFatura: ["Bekliyor", "Geldi", "Gelmedi"],
  gts: ["Yok", "Bekliyor", "Girildi"],
  fatura: ["Kesilecek", "Kesildi", "İptal"],
};

export default function SiparislerPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    loadNextOrderNo();
    loadSuggestions();
  }, []);

async function loadNextOrderNo() {
  try {
    const res = await fetch(`/api/admin/siparisler?t=${Date.now()}`, {
      cache: "no-store",
    });

    const data = await res.json();
    const rows = data?.rows || [];

    let maxNumber = 0;

    rows.forEach((row: any) => {
      const raw = String(row.satisId || "").trim();
      const match = raw.match(/(\d+)$/);

      if (!match) return;

      const num = Number(match[1]);

      if (Number.isFinite(num) && num > maxNumber) {
        maxNumber = num;
      }
    });

    const nextNumber = maxNumber + 1;

    setForm((prev) => ({
      ...prev,
      satisId: `P-${nextNumber}`,
      satisTarihi: prev.satisTarihi || new Date().toISOString().slice(0, 10),
    }));
  } catch {
    setForm((prev) => ({
      ...prev,
      satisTarihi: prev.satisTarihi || new Date().toISOString().slice(0, 10),
    }));
  }
}
  async function loadSuggestions() {
  const fromStorage: Record<string, string[]> = {};

  suggestionFields.forEach((field) => {
    try {
      fromStorage[field] = JSON.parse(
        localStorage.getItem(`siparis_suggestions_${field}`) || "[]",
      );
    } catch {
      fromStorage[field] = [];
    }
  });

  let rows: any[] = [];

  try {
    const res = await fetch(`/api/admin/siparisler?t=${Date.now()}`, {
      cache: "no-store",
    });

    const data = await res.json();

    if (data?.success && Array.isArray(data.rows)) {
      rows = data.rows;
    }
  } catch {
    rows = [];
  }

  const merged: Record<string, string[]> = {};

  suggestionFields.forEach((field) => {
    const dbValues = rows
      .map((row: any) => row[field])
      .filter((v: any) => typeof v === "string" && v.trim());

    merged[field] = uniqueValues([
      ...dbValues,
      ...(fromStorage[field] || []),
    ]).slice(0, 500);
  });

  setSuggestions(merged);
}
  function saveSuggestion(name: keyof FormState, value: string) {
    if (!suggestionFields.includes(name)) return;

    const clean = value.trim();
    if (!clean) return;

    setSuggestions((prev) => {
      const next = uniqueValues([clean, ...(prev[name] || [])]).slice(0, 50);

      try {
        localStorage.setItem(`siparis_suggestions_${name}`, JSON.stringify(next));
      } catch {}

      return { ...prev, [name]: next };
    });
  }

function update(name: keyof FormState, value: string) {
  setForm((prev) => ({ ...prev, [name]: value }));
}

  const calc = useMemo(() => {
    const alis = Number(form.alisFiyati) || 0;
    const satis = Number(form.pesinSatisFiyati) || 0;
    const tonaj = Number(form.siparisTonaj) || 0;
    const teslim = Number(form.teslimOlanTonaj) || 0;
    const nakliye = Number(form.nakliye) || 0;
    const vadeFarki = Number(form.vadeFarki) || 0;

    const tedarikciyeOdenecekTutar = alis * tonaj;
    const bayiSatisToplam = satis * tonaj;
    const tonBasiKar = satis - alis;
    const eksikTonaj = Math.max(tonaj - teslim, 0);
    const perakendeKari = bayiSatisToplam - tedarikciyeOdenecekTutar - nakliye;
    const karYuzde =
      bayiSatisToplam > 0 ? (perakendeKari / bayiSatisToplam) * 100 : 0;
    const vadeliFiyat = satis + vadeFarki;

    return {
      tedarikciyeOdenecekTutar,
      bayiSatisToplam,
      tonBasiKar,
      eksikTonaj,
      perakendeKari,
      karYuzde,
      vadeliFiyat,
    };
  }, [form]);

  async function checkDuplicate() {
    const checks = [
      { column: "satisId", value: form.satisId, label: "Sipariş No" },
      { column: "faturaNo", value: form.faturaNo, label: "Fatura No" },
      { column: "sevkNo", value: form.sevkNo, label: "Sevk No" },
    ].filter((item) => item.value.trim());

    for (const item of checks) {
      const { data, error } = await supabase
        .from("siparisler")
        .select("id")
        .eq(item.column, item.value.trim())
        .limit(1);

      if (!error && data && data.length > 0) {
        return `${item.label} daha önce girilmiş: ${item.value}`;
      }
    }

    return "";
  }

  async function saveOrder() {
    setMessage("");

    if (!form.satisId.trim()) return setMessage("❌ Sipariş No boş olamaz.");
    if (!form.bayi.trim()) return setMessage("❌ Bayi alanı boş olamaz.");
    if (!form.urun.trim()) return setMessage("❌ Ürün alanı boş olamaz.");

    if (!(Number(form.siparisTonaj) > 0)) return setMessage("Sipariş miktarı sıfırdan büyük olmalı.");
    if (!(Number(form.pesinSatisFiyati) > 0)) return setMessage("Satış fiyatı sıfırdan büyük olmalı.");
    if (saving) return;
    setSaving(true);
    const duplicateMessage = await checkDuplicate();

    if (duplicateMessage) {
      setSaving(false);
      setMessage(`❌ ${duplicateMessage}`);
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        satisId: form.satisId.trim(),
        satisTarihi: form.satisTarihi || null,
        vadeTarihi: form.vadeTarihi || null,
        alisFiyati: Number(form.alisFiyati) || 0,
        tedarikciFaturaTutar: Number(form.tedarikciFaturaTutar) || 0,
        pesinSatisFiyati: Number(form.pesinSatisFiyati) || 0,
        siparisTonaj: Number(form.siparisTonaj) || 0,
        teslimOlanTonaj: Number(form.teslimOlanTonaj) || 0,
        yapilanOdeme: Number(form.yapilanOdeme) || 0,
        vadeFarki: Number(form.vadeFarki) || 0,
        nakliye: Number(form.nakliye) || 0,
        tedarikciyeOdenecekTutar: calc.tedarikciyeOdenecekTutar,
        bayiSatisToplam: calc.bayiSatisToplam,

      };

      const { error } = await supabase.from("siparisler").insert([payload]);

      if (error) {
        setMessage("❌ Sipariş kaydedilemedi: " + error.message);
        return;
      }

      suggestionFields.forEach((field) => saveSuggestion(field, form[field]));

      setMessage("✅ Sipariş başarıyla kaydedildi.");

      setForm({
        ...initialForm,
        satisId: "",
        satisTarihi: new Date().toISOString().slice(0, 10),
      });

      await loadSuggestions();
      await loadNextOrderNo();
    } catch (err) {
      setMessage("❌ Kayıt hatası: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f4] p-4 pb-28 text-slate-900 md:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <Link href="/admin/siparisler" prefetch={false} className="text-sm font-semibold text-emerald-800">← Siparişler</Link>
        <header><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">1 · Alış ve satış</p><h1 className="mt-2 text-3xl font-bold">Yeni sipariş</h1><p className="mt-2 text-sm text-slate-500">Siparişi kaydet. Plaka ve sevk bilgilerini araç belli olduğunda ekleyebilirsin.</p></header>
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold"><span className="rounded-xl bg-emerald-700 p-3 text-white">1. Alış–satış</span><span className="rounded-xl bg-white p-3 text-slate-400">2. Plaka–sevk</span><span className="rounded-xl bg-white p-3 text-slate-400">3. Fatura</span></div>
        {message && <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 font-semibold">{message}</p>}
        <form onSubmit={(event) => { event.preventDefault(); if (!saving) void saveOrder(); }} className="space-y-5">
          <Panel title="Kimden alıyoruz, kime satıyoruz?">
            <Grid>
              <SmartInput label="Bayi / Müşteri *" name="bayi" value={form.bayi} update={update} suggestions={suggestions.bayi} />
              <SmartInput label="Tedarikçi" name="tedarikciler" value={form.tedarikciler} update={update} suggestions={suggestions.tedarikciler} />
            </Grid>
          </Panel>
          <Panel title="Ürün ve fiyat">
            <Grid>
              <SmartInput label="Ürün *" name="urun" value={form.urun} update={update} suggestions={suggestions.urun} />
              <SmartInput label="Marka" name="marka" value={form.marka} update={update} suggestions={suggestions.marka} />
              <Input label="Sipariş miktarı (ton) *" name="siparisTonaj" type="number" value={form.siparisTonaj} update={update} />
              <Input label="Alış fiyatı (₺ / ton)" name="alisFiyati" type="number" value={form.alisFiyati} update={update} />
              <Input label="Satış fiyatı (₺ / ton) *" name="pesinSatisFiyati" type="number" value={form.pesinSatisFiyati} update={update} />
              <SelectInput label="Ödeme şekli" name="satisTuru" value={form.satisTuru} update={update} options={selectOptions.satisTuru || []} />
            </Grid>
            {form.satisTuru !== "Peşin" && <div className="mt-5 rounded-xl bg-slate-50 p-4"><Grid>
              <Input label="Vade tarihi" name="vadeTarihi" type="date" value={form.vadeTarihi} update={update} />
              <Input label="Vade farkı (₺ / ton)" name="vadeFarki" type="number" value={form.vadeFarki} update={update} />
              <Input label="Vade süresi" name="vadeSuresi" value={form.vadeSuresi} update={update} />
            </Grid></div>}
          </Panel>
          <details className="rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-semibold">Tarih, siparişi alan ve ek bilgiler</summary><div className="mt-5"><Grid>
            <Input label="Sipariş no" name="satisId" value={form.satisId} update={update} readOnly />
            <Input label="Satış tarihi" name="satisTarihi" type="date" value={form.satisTarihi} update={update} />
            <SmartInput label="Siparişi alan" name="siparisAlan" value={form.siparisAlan} update={update} suggestions={suggestions.siparisAlan} />
            <Input label="Nakliye tutarı (₺)" name="nakliye" type="number" value={form.nakliye} update={update} />
            <Input label="Yapılan ödeme (₺)" name="yapilanOdeme" type="number" value={form.yapilanOdeme} update={update} />
            <Input label="Not" name="not" value={form.not} update={update} />
          </Grid></div></details>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:static md:rounded-2xl md:border md:p-5">
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-4"><div><p className="text-xs text-slate-500">Satış toplamı</p><p className="text-xl font-bold text-emerald-800">{formatMoney(calc.bayiSatisToplam)}</p></div><button type="submit" disabled={saving} className="min-h-12 rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-50">{saving ? "Kaydediliyor…" : "Siparişi kaydet"}</button></div>
          </div>
        </form>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function Input({
  label,
  name,
  value,
  update,
  type = "text",
  readOnly = false,
}: {
  label: string;
  name: keyof FormState;
  value: string;
  update: (name: keyof FormState, value: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? 0 : undefined}
        value={value}
        readOnly={readOnly}
        onChange={(e) => update(name, e.target.value)}
        className={`mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100 ${
          readOnly ? "bg-slate-50 font-black text-emerald-900" : "bg-white"
        }`}
      />
    </label>
  );
}

function SmartInput({
  label,
  name,
  value,
  update,
  suggestions = [],
}: {
  label: string;
  name: keyof FormState;
  value: string;
  update: (name: keyof FormState, value: string) => void;
  suggestions?: string[];
}) {
  const [open, setOpen] = useState(false);

  const filtered = suggestions
    .filter((x) =>
      x.toLocaleLowerCase("tr-TR")
        .includes(value.toLocaleLowerCase("tr-TR"))
    )
    .slice(0, 8);

  const exactMatch = suggestions.some(
    (x) =>
      x.toLocaleLowerCase("tr-TR").trim() ===
      value.toLocaleLowerCase("tr-TR").trim()
  );

  return (
    <div className="relative">
      <label className="block">
        <span className="text-sm font-bold text-slate-600">
          {label}
        </span>

        <input
          type="text"
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setTimeout(() => setOpen(false), 150);
          }}
          onChange={(e) => update(name, e.target.value)}
          className="mt-2 min-h-12 w-full text-base rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100"
        />
      </label>

      {open && (
        <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  update(name, item);
                  setOpen(false);
                }}
                className="flex w-full items-center rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-emerald-50"
              >
                {item}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm font-bold text-slate-400">
              Sonuç bulunamadı
            </div>
          )}

          {value.trim() && !exactMatch && (
            <button
              type="button"
              onClick={() => {
                update(name, value);
                setOpen(false);
              }}
              className="mt-2 flex w-full items-center rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-3 py-3 text-left text-sm font-black text-emerald-700 transition hover:bg-emerald-100"
            >
              + “{value}” ekle
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SelectInput({
  label,
  name,
  value,
  update,
  options,
}: {
  label: string;
  name: keyof FormState;
  value: string;
  update: (name: keyof FormState, value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => update(name, e.target.value)}
        className="mt-2 min-h-12 w-full text-base rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function uniqueValues(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((v) => v?.trim())
        .filter((v): v is string => Boolean(v)),
    ),
  );
}
function formatMoney(value: number) { return new Intl.NumberFormat("tr-TR", {style: "currency", currency: "TRY", maximumFractionDigits: 2}).format(value); }
