"use client";

import { useState } from "react";

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

  function update(name: string, value: string) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  function olustur() {
    const params = new URLSearchParams(form);
    window.open(`/admin/siparisler/form/preview?${params}`, "_blank");
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow">

        <h1 className="text-2xl font-black">Sipariş Formu Oluştur</h1>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Input label="Bayi" onChange={(v)=>update("bayi",v)} />
          <Input type="date" label="Tarih" onChange={(v)=>update("tarih",v)} />
          <Input label="Ödeme Şekli" onChange={(v)=>update("odeme",v)} />
          <Input label="Çıkış Deposu" onChange={(v)=>update("depo",v)} />

          {/* 🔥 NAKLİYE */}
          <div>
            <p className="text-sm font-bold text-slate-600">Nakliye Durumu</p>
            <select
              onChange={(e)=>update("nakliye", e.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-3"
            >
              <option value="">Seçiniz</option>
              <option value="Hariç">Hariç</option>
              <option value="Dahil">Dahil</option>
            </select>
          </div>

          <Input label="Ürün" onChange={(v)=>update("urun",v)} />
          <Input label="Miktar (Ton)" onChange={(v)=>update("miktar",v)} />
          <Input label="Birim Fiyat" onChange={(v)=>update("fiyat",v)} />
          <Input label="Sevk Adresi" onChange={(v)=>update("sevk",v)} />
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
  onChange,
  type = "text",
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
}) {  return (
    <div>
      <p className="text-sm font-bold text-slate-600">{label}</p>
      <input
        type={type}
        onChange={(e)=>onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border px-4 py-3"
      />
    </div>
  );
}