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
    const { data, error } = await supabase
      .from("siparisler")
      .select("satisId")
      .order("satisId", { ascending: false })
      .limit(1);

    const last = !error ? data?.[0]?.satisId : "";
    const nextNumber = (Number(last) || 0) + 1;

    setForm((prev) => ({
      ...prev,
      satisId: String(nextNumber),
      satisTarihi: prev.satisTarihi || new Date().toISOString().slice(0, 10),
    }));
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

    const { data } = await supabase
      .from("siparisler")
      .select(suggestionFields.join(","));

    const merged: Record<string, string[]> = { ...fromStorage };

    suggestionFields.forEach((field) => {
      const dbValues =
        data
          ?.map((row: any) => row[field])
          .filter((v: string) => typeof v === "string" && v.trim()) || [];

      merged[field] = uniqueValues([...(fromStorage[field] || []), ...dbValues]);
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
    saveSuggestion(name, value);
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

    const duplicateMessage = await checkDuplicate();

    if (duplicateMessage) {
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
        tonBasiKar: calc.tonBasiKar,
        eksikTonaj: calc.eksikTonaj,
        perakendeKari: calc.perakendeKari,
        karYuzde: calc.karYuzde,
        vadeliFiyat: calc.vadeliFiyat,
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
        satisTarihi: new Date().toISOString().slice(0, 10),
      });

      await loadNextOrderNo();
      await loadSuggestions();
    } catch (err) {
      setMessage("❌ Kayıt hatası: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef1ea] p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" prefetch={false} className="font-black text-emerald-800">
          ← Admin Panel
        </Link>

        <div className="mt-4 rounded-[32px] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/10">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
                Niba Tarım
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                Sipariş Kaydı
              </h1>
              <p className="mt-2 text-sm text-white/60">
                Sipariş No otomatik gelir. Aynı Sipariş No, Fatura No veya Sevk
                No tekrar girilirse sistem uyarı verir.
              </p>
            </div>

            <button
              type="button"
              onClick={saveOrder}
              disabled={saving}
className="sticky top-4 z-40 rounded-2xl bg-gradient-to-r from-[#00a884] to-[#00c297] px-6 py-4 font-black text-white shadow-xl shadow-emerald-900/20 disabled:opacity-50"            >
              {saving ? "Kaydediliyor..." : "Siparişi Kaydet"}
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm font-bold ring-1 ring-white/15">
              {message}
            </div>
          )}
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Panel title="Satış Bilgileri">
              <Grid>
                <Input label="Sipariş No" name="satisId" value={form.satisId} update={update} readOnly />
                <Input label="Satış Tarihi" name="satisTarihi" type="date" value={form.satisTarihi} update={update} />
                <SmartInput label="Bayi" name="bayi" value={form.bayi} update={update} suggestions={suggestions.bayi} />
                <SmartInput label="Tedarikçiler" name="tedarikciler" value={form.tedarikciler} update={update} suggestions={suggestions.tedarikciler} />
                <SmartInput label="Sipariş Alan" name="siparisAlan" value={form.siparisAlan} update={update} suggestions={suggestions.siparisAlan} />
                <SelectInput label="Satış Türü" name="satisTuru" value={form.satisTuru} update={update} options={selectOptions.satisTuru || []} />
              </Grid>
            </Panel>

            <Panel title="Ürün ve Fiyat Bilgileri">
              <Grid>
                <SmartInput label="Ürün" name="urun" value={form.urun} update={update} suggestions={suggestions.urun} />
                <SmartInput label="Marka" name="marka" value={form.marka} update={update} suggestions={suggestions.marka} />
                <Input label="Alış Fiyatı" name="alisFiyati" type="number" value={form.alisFiyati} update={update} />
                <Readonly label="Tedarikçiye Ödenecek Tutar" value={calc.tedarikciyeOdenecekTutar} />
                <Input label="Fatura No" name="faturaNo" value={form.faturaNo} update={update} />
                <Input label="Tedarikçi Fatura Tutarı" name="tedarikciFaturaTutar" type="number" value={form.tedarikciFaturaTutar} update={update} />
                <Input label="Peşin Satış Fiyatı" name="pesinSatisFiyati" type="number" value={form.pesinSatisFiyati} update={update} />
                <Readonly label="Ton Başı Kar" value={calc.tonBasiKar} />
              </Grid>
            </Panel>

            <Panel title="Sipariş ve Teslimat">
              <Grid>
                <Input label="Sipariş Tonajı" name="siparisTonaj" type="number" value={form.siparisTonaj} update={update} />
                <Input label="Teslim Olan Tonaj" name="teslimOlanTonaj" type="number" value={form.teslimOlanTonaj} update={update} />
                <Readonly label="Eksik Tonaj" value={calc.eksikTonaj} />
                <Input label="Nakliye" name="nakliye" type="number" value={form.nakliye} update={update} />
                <SmartInput label="Sevk Yeri" name="sevkYeri" value={form.sevkYeri} update={update} suggestions={suggestions.sevkYeri} />
                <Input label="Not" name="not" value={form.not} update={update} />
              </Grid>
            </Panel>

            <Panel title="Vade ve Ödeme">
              <Grid>
                <Input label="Yapılan Ödeme" name="yapilanOdeme" type="number" value={form.yapilanOdeme} update={update} />
                <Input label="Vade Tarihi" name="vadeTarihi" type="date" value={form.vadeTarihi} update={update} />
                <Input label="Vade Farkı" name="vadeFarki" type="number" value={form.vadeFarki} update={update} />
                <Input label="Vade Süresi" name="vadeSuresi" value={form.vadeSuresi} update={update} />
                <Readonly label="Vadeli Fiyat" value={calc.vadeliFiyat} />
              </Grid>
            </Panel>

            <Panel title="Kayıttan Sonra Girilecek Operasyon Bilgileri">
              <Grid>
                <SmartInput label="Plaka" name="plaka" value={form.plaka} update={update} suggestions={suggestions.plaka} />
                <SelectInput label="Sevk Durumu" name="sevkDurumu" value={form.sevkDurumu} update={update} options={selectOptions.sevkDurumu || []} />
                <SelectInput label="Gelen Fatura" name="gelenFatura" value={form.gelenFatura} update={update} options={selectOptions.gelenFatura || []} />
                <Input label="Sevk No" name="sevkNo" value={form.sevkNo} update={update} />
                <SelectInput label="GTS" name="gts" value={form.gts} update={update} options={selectOptions.gts || []} />
                <SelectInput label="Fatura" name="fatura" value={form.fatura} update={update} options={selectOptions.fatura || []} />
              </Grid>
            </Panel>
          </div>

          <aside className="h-fit rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100 lg:sticky lg:top-6">
            <h2 className="text-xl font-black text-slate-950">Otomatik Özet</h2>

            <div className="mt-6 space-y-4">
              <Summary label="Tedarikçiye Ödenecek" value={calc.tedarikciyeOdenecekTutar} />
              <Summary label="Bayiye Satış Toplamı" value={calc.bayiSatisToplam} />
              <Summary label="Ton Başı Kar" value={calc.tonBasiKar} />
              <Summary label="Eksik Tonaj" value={calc.eksikTonaj} suffix=" ton" />
              <Summary label="Perakende Karı" value={calc.perakendeKari} />
              <Summary label="Kar %" value={calc.karYuzde} suffix="%" />
              <Summary label="Vadeli Fiyat" value={calc.vadeliFiyat} />

<button
  type="button"
  onClick={saveOrder}
  disabled={saving}
  className="mt-6 w-full rounded-2xl bg-gradient-to-r from-[#00a884] to-[#00c297] px-6 py-4 font-black text-white shadow-xl shadow-emerald-900/20 disabled:opacity-50"
>
  {saving ? "Kaydediliyor..." : "Siparişi Kaydet"}
</button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
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
  const listId = `list-${name}`;

  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <input
        type="text"
        value={value}
        list={suggestions.length > 0 ? listId : undefined}
        onChange={(e) => update(name, e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100"
      />

      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      )}
    </label>
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
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100"
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

function Readonly({ label, value }: { label: string; value: number }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-black text-emerald-900">
        {format(value)}
      </div>
    </label>
  );
}

function Summary({
  label,
  value,
  suffix = " TL",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className="font-black text-emerald-900">
        {format(value)}
        {suffix}
      </span>
    </div>
  );
}

function format(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(value || 0);
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