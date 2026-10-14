"use client";
import { useEffect, useRef, useState } from "react";
import { normalizeInvoiceUnit, sourceInvoiceUnit, stockSourceKey } from "@/lib/parasut/stock-conversion";

type Props = { invoiceId: string; supplierId: string; lines: any[]; contextKey: string; disabled: boolean; headers: () => Promise<Record<string, string>>; requestPreview: (selections: any[]) => Promise<any>; onChange: (value: any) => void; confirmNew: (text: string) => Promise<boolean> };
const number = (value: any) => Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 8 });
const money = (value: any) => `${number(value)} TL`;
export default function StockMapping(props: Props) {
  const [selections, setSelections] = useState<any[]>(() => props.lines.map((line, lineIndex) => ({ lineIndex, productId: "", sourceUnit: sourceInvoiceUnit(line), factor: "" })));
  const [products, setProducts] = useState<Record<string, any>>({});
  const [results, setResults] = useState<Record<number, any[]>>({});
  const [searchErrors, setSearchErrors] = useState<Record<number, string>>({});
  const [searching, setSearching] = useState<Record<number, boolean>>({});
  const [queries, setQueries] = useState<Record<number, string>>({});
  const [newCards, setNewCards] = useState<Record<number, { name: string; unit: string }>>({});
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const previewSequence = useRef(0);
  const requestSequence = useRef<Record<number, number>>({});
  const changeRef = useRef(props.onChange); changeRef.current = props.onChange;
  useEffect(() => { previewSequence.current++; setPreview(null); changeRef.current(null); }, [props.contextKey]);
  useEffect(() => {
    let active = true;
    (async () => {
      const response = await fetch("/api/admin/parasut/items/suggestions", { method: "POST", headers: await props.headers(), cache: "no-store", body: JSON.stringify({ supplierId: props.supplierId, names: props.lines.map(line => line.product_mapping_name || line.product_name || "Ürün kalemi") }) });
      const data = await response.json();
      if (!active) return;
      if (!response.ok || !data.success) throw new Error(data.error || "Stok önerileri alınamadı.");
      const suggestions = props.lines.map(line => data.suggestions.find((item: any) => item.sourceKey === stockSourceKey(line.product_mapping_name || line.product_name)));
      const cards: Record<string, any> = {}, candidates: Record<number, any[]> = {};
      suggestions.forEach((suggestion: any, index: number) => {
        candidates[index] = suggestion?.candidates || [];
        for (const item of suggestion?.candidates || []) cards[item.id] = { ...item, suggested: suggestion.reason === "previous" ? "previous" : "content" };
      });
      setProducts(previous => ({ ...previous, ...cards })); setResults(previous => ({ ...candidates, ...previous }));
      setSelections(previous => previous.map((item, index) => item.productId || !suggestions[index]?.suggestedId ? item : { ...item, productId: suggestions[index].suggestedId, sourceUnit: item.sourceUnit || suggestions[index].sourceUnit || "", factor: suggestions[index].factor ?? "" }));
    })().catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [props.invoiceId, props.supplierId]);
  function update(index: number, values: any) {
    setSelections(previous => previous.map((item, i) => i === index ? { ...item, ...values } : item));
    previewSequence.current++; setPreview(null); props.onChange(null); setError("");
  }
  async function search(index: number) {
    if ((queries[index] || "").trim().length < 2) { setError("Aramak için ürün adından en az iki karakter yazın."); return; }
    const request = (requestSequence.current[index] || 0) + 1;
    requestSequence.current[index] = request;
    setSearching(previous => ({ ...previous, [index]: true }));
    setSearchErrors(previous => ({ ...previous, [index]: "" }));
    setError("");
    try {
      const response = await fetch(`/api/admin/parasut/items?q=${encodeURIComponent(queries[index] || "")}&sourceName=${encodeURIComponent(props.lines[index].product_mapping_name || props.lines[index].product_name || "")}`, { headers: await props.headers(), cache: "no-store" });
      const data = await response.json();
      if (requestSequence.current[index] !== request) return;
      if (!response.ok || !data.success) throw new Error(typeof data.error === "string" ? data.error : "Stok ürünleri alınamadı.");
      setResults(previous => ({ ...previous, [index]: data.items }));
      setProducts(previous => ({ ...previous, ...Object.fromEntries(data.items.map((item: any) => [String(item.id), item])) }));
    } catch (reason) { if (requestSequence.current[index] === request) { const message = reason instanceof Error ? reason.message : "Stok araması başarısız."; setSearchErrors(previous => ({ ...previous, [index]: message })); } }
    finally { if (requestSequence.current[index] === request) setSearching(previous => ({ ...previous, [index]: false })); }
  }
  async function createCard(index: number) {
    const card = newCards[index];
    if (!card?.name.trim() || !card.unit) { setError("Yeni stok kartı adı ve birimini belirtin."); return; }
    if (!(await props.confirmNew(`Yeni stok kartı oluşturulacak:\n${card.name.trim()} · Birim: ${card.unit}\nMevcut stoklarda aynı ürünün bulunmadığını kontrol ettiniz mi?`))) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/parasut/items/create", { method: "POST", headers: await props.headers(), body: JSON.stringify({ name: card.name.trim(), unit: card.unit, vatRate: Number(props.lines[index].vat_rate), inventoryTracking: true }) });
      const data = await response.json();
      if (!response.ok || !data.success || !data.item?.id) throw new Error(typeof data.error === "string" ? data.error : "Stok kartı oluşturulamadı.");
      const item = { ...data.item, unit: data.item.raw?.attributes?.unit || card.unit, inventoryTracking: true };
      setProducts(previous => ({ ...previous, [String(item.id)]: item }));
      update(index, { productId: String(item.id) });
      setNewCards(previous => { const next = { ...previous }; delete next[index]; return next; });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Stok kartı oluşturulamadı."); }
    finally { setBusy(false); }
  }
  async function showPreview() {
    const request = ++previewSequence.current;
    setBusy(true); setError(""); setPreview(null); props.onChange(null);
    try {
      const stockSelections = selections.map(item => ({ ...item, factor: item.factor === "" ? undefined : Number(item.factor) }));
      const data = await props.requestPreview(stockSelections);
      if (request !== previewSequence.current) return;
      setPreview(data.stockPreview); props.onChange({ stockSelections, stockConfirmation: data.stockConfirmation, stockPreview: data.stockPreview });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Dönüşüm önizlemesi alınamadı."); }
    finally { setBusy(false); }
  }
  const locked = props.disabled || busy;
  return <section className="space-y-4 rounded-xl border border-emerald-200 bg-white p-4">
    <div><h3 className="font-bold text-slate-900">Stok karşılığı ve birim dönüşümü</h3><p className="mt-1 text-sm text-slate-600">Fatura içeriğine göre önerilen stok ürününü kontrol edin; gerekirse değiştirin. Kaynak birim gelmemişse faturaya bakarak seçin. Alış faturası teyit edilen miktar ve fiyatla kaydedilir.</p></div>
    {props.lines.map((line, index) => {
      const selected = selections[index], product = products[selected?.productId];
      const target = normalizeInvoiceUnit(product?.unit);
      const source = normalizeInvoiceUnit(selected?.sourceUnit);
      const manual = source && target && source !== target && (source === "Adet" || target === "Adet");
      return <div key={index} className="space-y-3 rounded-xl bg-slate-50 p-3">
        <p className="text-sm font-bold">{index + 1}. {line.product_mapping_name || line.product_name || "Ürün kalemi"} · {number(line.quantity)} {sourceInvoiceUnit(line) || "(birim gelmedi)"}</p>
        <label className="block text-sm">Faturadaki kaynak birim{sourceInvoiceUnit(line) ? <p className="mt-1 font-semibold">{sourceInvoiceUnit(line)}</p> : <input disabled={locked} list="invoice-source-units" value={selected?.sourceUnit || ""} onChange={event => update(index, { sourceUnit: event.target.value })} placeholder="Faturaya göre: ton, kg, Adet…" className="mt-1 w-full rounded-lg border border-slate-300 p-2" />}</label>
        <div className="flex gap-2"><input aria-label={`${index + 1}. kalem için stok ara`} disabled={locked} value={queries[index] || ""} onChange={event => setQueries(previous => ({ ...previous, [index]: event.target.value }))} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void search(index); } }} placeholder="Stok ürününün adıyla ara" className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2 text-sm" /><button type="button" disabled={locked || searching[index]} onClick={() => search(index)} className="rounded-lg border border-emerald-300 px-3 text-sm font-bold text-emerald-800">{searching[index] ? "Aranıyor…" : "Ara"}</button></div>
        {searchErrors[index] && <p role="alert" className="text-sm font-semibold text-red-700">{searchErrors[index]}</p>}
        {searching[index] && <p role="status" className="text-sm text-slate-600">Stok adayları aranıyor…</p>}
        {results[index] && <div className="space-y-2" aria-label="Stok arama sonuçları">
          <p className="text-sm font-semibold">Stok adayları · {results[index].length} sonuç</p>
          {results[index].map(item => <button type="button" key={item.id} disabled={locked || searching[index]} aria-pressed={selected?.productId === String(item.id)} onClick={() => update(index, { productId: String(item.id) })} className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left disabled:opacity-50 ${selected?.productId === String(item.id) ? "border-emerald-600 bg-emerald-50" : "border-slate-300 bg-white hover:border-emerald-400"}`}>
            <span><span className="block text-sm font-bold">{item.name}</span><span className="mt-1 block text-xs text-slate-600">Birim: {item.unit || "Eksik"}{item.code ? ` · Kod: ${item.code}` : ""}</span>{item.matchNote && <span className="mt-1 block text-xs text-amber-800">{item.matchNote}</span>}</span>
            <span className="shrink-0 text-sm font-bold text-emerald-800">{selected?.productId === String(item.id) ? "Seçildi ✓" : "Bu stoku seç"}</span>
          </button>)}
          {!results[index].length && !searching[index] && <p className="text-sm text-slate-600">Bu aramada stok ürünü bulunamadı. Ürün formülünü veya stok kartının tam adını deneyin.</p>}
        </div>}
        {product && <p className="rounded-lg bg-emerald-50 p-2 text-sm font-semibold text-emerald-900">{product.suggested === "previous" ? "Önceki eşleştirme önerisi" : product.suggested === "content" ? "Fatura içeriğinden önerilen stok" : "Seçilen stok"}: {product.name} · {product.unit || "Birim eksik"}{product.matchNote && <span className="mt-1 block text-xs font-normal text-amber-900">{product.matchNote}</span>}</p>}
        {manual && <label className="block text-sm font-semibold">1 {source} = kaç {target}?<input type="number" min="0" step="any" disabled={locked} value={selected.factor ?? ""} onChange={event => update(index, { factor: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /><span className="mt-1 block text-xs font-normal text-slate-600">Örneğin 1 adet 50 kg ise 50 yazın. Katsayı önizlemede gösterilir.</span></label>}
        {!newCards[index] ? <button type="button" disabled={locked} onClick={() => setNewCards(previous => ({ ...previous, [index]: { name: line.product_mapping_name || line.product_name || "", unit: source || "kg" } }))} className="text-xs font-semibold text-slate-600 underline">Stokta karşılığı yok: yeni stok kartı oluştur</button> : <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-bold">Yalnızca mevcut stokta karşılığı yoksa yeni kart açın.</p><input aria-label="Yeni stok adı" disabled={locked} value={newCards[index].name} onChange={event => setNewCards(previous => ({ ...previous, [index]: { ...previous[index], name: event.target.value } }))} className="w-full rounded-lg border bg-white p-2 text-sm" /><input aria-label="Yeni stok birimi" disabled={locked} list="invoice-source-units" value={newCards[index].unit} onChange={event => setNewCards(previous => ({ ...previous, [index]: { ...previous[index], unit: event.target.value } }))} className="w-full rounded-lg border bg-white p-2 text-sm" /><button type="button" disabled={locked} onClick={() => createCard(index)} className="rounded-lg bg-amber-800 px-3 py-2 text-sm font-bold text-white">Yeni kart oluştur ve seç</button></div>}
      </div>;
    })}
    <datalist id="invoice-source-units"><option value="ton" /><option value="kg" /><option value="Adet" /><option value="litre" /></datalist>
    <button type="button" disabled={locked || selections.some(item => !item.productId || !item.sourceUnit)} onClick={showPreview} className="w-full rounded-lg bg-emerald-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Hazırlanıyor…" : "Dönüştürülecek hali görüntüle"}</button>
    {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    {preview && <div className="space-y-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4"><h4 className="font-bold text-emerald-950">Dönüştürülecek hali</h4>{preview.lines.map((line: any) => <div key={line.lineIndex} className="rounded-lg bg-white p-3 text-sm"><p className="font-bold">{line.sourceName} → {line.productName}</p><p className="mt-1">{number(line.sourceQuantity)} {line.sourceUnit} × {money(line.sourceUnitPrice)} → <strong>{number(line.quantity)} {line.targetUnit} × {money(line.unitPrice)}</strong></p><p className="mt-1">KDV: %{number(line.vatRate)} · İskonto: {line.discountType === "percentage" ? `%${number(line.discountValue)}` : money(line.discountValue)} · Ara toplam: {money(line.netTotal)}</p>{line.sourceUnit !== line.targetUnit && <p className="mt-1">1 {line.sourceUnit} = {number(line.factor)} {line.targetUnit}</p>}{!line.inventoryTracking && <p className="mt-2 font-semibold text-amber-800">Bu stok kartında stok takibi kapalı. Fatura bu karta bağlanır; miktar takibi için kartın stok takibini Paraşüt'te açın.</p>}</div>)}<p className="font-bold">Genel toplam: {money(preview.total)}</p><p className="text-sm">Alış faturası yukarıdaki stok ürünlerine, dönüştürülmüş miktar ve birim fiyatlarla kaydedilecek. Aşağıdaki düğmeden teyit ederek kaydedebilirsiniz.</p></div>}
  </section>;
}
