"use client";

import { useMemo, useState } from "react";

export default function SiparislerPage() {
  const [form, setForm] = useState({
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
    gelenFatura: "",
    sevkNo: "",
    gts: "",
    fatura: "",
  });

  function update(name: string, value: string) {
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
    const karYuzde = bayiSatisToplam > 0 ? (perakendeKari / bayiSatisToplam) * 100 : 0;
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

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-7xl">
        <a href="/admin" className="font-bold text-emerald-800">
          ← Admin Panel
        </a>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-950">Sipariş Kaydı</h1>
            <p className="mt-2 text-slate-600">
              Satış, tedarik, sevk ve fatura bilgilerini buradan takip edin.
            </p>
          </div>

          <button
            type="button"
            className="rounded-xl bg-emerald-900 px-6 py-4 font-black text-white shadow-lg hover:bg-emerald-800"
          >
            Siparişi Kaydet
          </button>
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Panel title="Satış Bilgileri">
              <Grid>
                <Input label="Satış ID" name="satisId" value={form.satisId} update={update} />
                <Input label="Satış Tarihi" name="satisTarihi" type="date" value={form.satisTarihi} update={update} />
                <Input label="Bayi" name="bayi" value={form.bayi} update={update} />
                <Input label="Tedarikçiler" name="tedarikciler" value={form.tedarikciler} update={update} />
                <Input label="Sipariş Alan" name="siparisAlan" value={form.siparisAlan} update={update} />
                <Input label="Satış Türü" name="satisTuru" value={form.satisTuru} update={update} />
              </Grid>
            </Panel>

            <Panel title="Ürün ve Fiyat Bilgileri">
              <Grid>
                <Input label="Ürün" name="urun" value={form.urun} update={update} />
                <Input label="Marka" name="marka" value={form.marka} update={update} />
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
                <Input label="Sevk Yeri" name="sevkYeri" value={form.sevkYeri} update={update} />
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
                <Input label="Plaka" name="plaka" value={form.plaka} update={update} />
                <Input label="Sevk Durumu" name="sevkDurumu" value={form.sevkDurumu} update={update} />
                <Input label="Gelen Fatura" name="gelenFatura" value={form.gelenFatura} update={update} />
                <Input label="Sevk No" name="sevkNo" value={form.sevkNo} update={update} />
                <Input label="GTS" name="gts" value={form.gts} update={update} />
                <Input label="Fatura" name="fatura" value={form.fatura} update={update} />
              </Grid>
            </Panel>
          </div>

          <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-8">
            <h2 className="text-xl font-black text-slate-950">Otomatik Özet</h2>

            <div className="mt-6 space-y-4">
              <Summary label="Tedarikçiye Ödenecek" value={calc.tedarikciyeOdenecekTutar} />
              <Summary label="Bayiye Satış Toplamı" value={calc.bayiSatisToplam} />
              <Summary label="Ton Başı Kar" value={calc.tonBasiKar} />
              <Summary label="Eksik Tonaj" value={calc.eksikTonaj} suffix=" ton" />
              <Summary label="Perakende Karı" value={calc.perakendeKari} />
              <Summary label="Kar %" value={calc.karYuzde} suffix="%" />
              <Summary label="Vadeli Fiyat" value={calc.vadeliFiyat} />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
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
}: {
  label: string;
  name: string;
  value: string;
  update: (name: string, value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => update(name, e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-700"
      />
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

function Summary({ label, value, suffix = " TL" }: { label: string; value: number; suffix?: string }) {
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