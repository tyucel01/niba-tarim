"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { depots, type OrderRow } from "@/lib/orders/workflow";

type Draft = { plaka: string; sevkYeri: string; sevkNo: string; teslimOlanTonaj: string; sevkDurumu: string; gts: string };
const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export default function SevkForm({ order, onSaved }: { order: OrderRow; onSaved: (row: OrderRow) => void }) {
  const [draft, setDraft] = useState<Draft>(() => ({
    plaka: String(order.plaka || ""), sevkYeri: String(order.sevkYeri || ""), sevkNo: String(order.sevkNo || ""),
    teslimOlanTonaj: String(order.teslimOlanTonaj ?? ""), sevkDurumu: String(order.sevkDurumu || "Bekliyor"), gts: String(order.gts || "Yok"),
  }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  function update(field: keyof Draft, value: string) { setDraft(previous => ({ ...previous, [field]: value })); setMessage(""); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Oturum açmanız gerekiyor.");
      const response = await fetch("/api/admin/siparisler/update-field", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: order.id, fields: { ...draft, plaka: draft.plaka.trim().toLocaleUpperCase("tr-TR"), teslimOlanTonaj: Number(draft.teslimOlanTonaj) || 0 } }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Sevk bilgileri kaydedilemedi.");
      onSaved(data.row); setMessage("Sevk bilgileri kaydedildi.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kaydedilemedi. Tekrar deneyin."); }
    finally { setSaving(false); }
  }
  function field(label: string, name: keyof Draft, options?: string[]) {
    return <label className="block text-sm font-semibold text-slate-600"><span>{label}</span>{options ? <select className={inputClass} value={draft[name]} onChange={event => update(name, event.target.value)}><option value="">Seçiniz</option>{Array.from(new Set([...options, ...(draft[name] ? [draft[name]] : [])])).map(value => <option key={value}>{value}</option>)}</select> : <input className={inputClass} type={name === 'teslimOlanTonaj' ? 'number' : 'text'} step={name === 'teslimOlanTonaj' ? 'any' : undefined} min={name === 'teslimOlanTonaj' ? 0 : undefined} value={draft[name]} onChange={event => update(name, event.target.value)} placeholder={name === 'plaka' ? 'Örn. 33 ABC 123' : undefined} />}</label>;
  }
  return <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
    <h2 className="text-xl font-bold">Plaka ve sevk bilgileri</h2><p className="mt-2 text-sm text-slate-500">Araç belli olduğunda doldur. Tüm değişiklikler Kaydet’e bastığında kaydedilir.</p>
    <fieldset disabled={saving} className="mt-6 grid gap-5 disabled:opacity-60 sm:grid-cols-2">
      {field("Araç plakası", "plaka")}{field("Depo / Sevk yeri", "sevkYeri", depots)}
      {field("Teslim olan tonaj", "teslimOlanTonaj")}{field("Sevk no", "sevkNo")}
      {field("Sevk durumu", "sevkDurumu", ["Bekliyor", "Kısmi Sevk", "Sevk Edildi", "Tamamlandı", "İptal"])}
      {field("GTS", "gts", ["Yok", "Bekliyor", "Girildi"])}
    </fieldset>
    {message && <p role="status" className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold">{message}</p>}
    <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><p className="text-sm text-slate-500">Kısmi sevkte teslim edilen toplam tonajı gir.</p><button disabled={saving} className="min-h-12 rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-50">{saving ? 'Kaydediliyor…' : 'Sevk bilgilerini kaydet'}</button></div>
  </form>;
}
