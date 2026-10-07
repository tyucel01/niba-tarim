export function deliveryTotals(order: any) {
  const tons = Number(order.teslimOlanTonaj) || 0;
  const salesTotal = Math.round(tons * Number(order.pesinSatisFiyati || 0) * 100) / 100;
  const purchaseTotal = Math.round(tons * Number(order.alisFiyati || 0) * 100) / 100;
  return { tons, salesTotal, purchaseTotal };
}
export function purchaseAllocation(order: any) {
  const legacy = order.sales_invoice_id && (!Array.isArray(order.sales_invoice_history) || order.sales_invoice_history.some((row: any) => row.state === 'legacy'));
  const delivery = deliveryTotals(order);
  // Preserve consumed historical bills and unknown deliveries; never release them speculatively.
  if (legacy || !(delivery.tons > 0)) return Number(order.matched_purchase_allocated_amount ?? order.matched_purchase_invoice_total ?? 0);
  return delivery.purchaseTotal;
}
export function salesProgress(order: any) {
  const delivery = deliveryTotals(order);
  const tons = delivery.tons;
  const total = delivery.salesTotal;
  const legacy = order.sales_invoiced_tonnage == null && Boolean(order.sales_invoice_id);
  const billedTons = legacy ? tons : Number(order.sales_invoiced_tonnage || 0);
  const billedTotal = legacy ? total : Number(order.sales_invoiced_total || 0);
  const remainingTons = Math.max(0, Math.round((tons - billedTons) * 1e6) / 1e6);
  const remainingTotal = Math.max(0, Math.round((total - billedTotal) * 100) / 100);
  const history = Array.isArray(order.sales_invoice_history) ? order.sales_invoice_history : [];
  const overbilled = billedTons > tons + .000001 || billedTotal > total + .05;
  const blocked = overbilled || history.some((row: any) => row.state === 'needs_review' || row.state === 'created');
  return { tons, total, overbilled, billedTons, billedTotal, remainingTons, remainingTotal, history, blocked, complete: billedTons > 0 && remainingTons < .000001 && !blocked };
}
export function salesPart(order: any, requested?: number) {
  const progress = salesProgress(order);
  const tons = requested == null ? progress.remainingTons : Number(requested);
  if (!(progress.tons > 0) || !(progress.total > 0)) throw new Error('Teslim olan tonaj ve satış fiyatı girilmeden fatura kesilemez.');
  if (!Number.isFinite(tons) || tons <= 0 || Math.abs(tons - Math.round(tons * 1e6) / 1e6) > 1e-9) throw new Error('Kesilecek tonaj pozitif olmalı ve en fazla 6 ondalık içermeli.');
  if (tons > progress.remainingTons) throw new Error(`Kesilecek tonaj kalan ${progress.remainingTons} tonu aşamaz.`);
  const amount = tons === progress.remainingTons ? progress.remainingTotal : Math.round(progress.total * tons / progress.tons * 100) / 100;
  if (!(amount > 0) || amount > progress.remainingTotal) throw new Error('Kesilecek fatura tutarı kalan satış tutarını aşamaz.');
  return { ...progress, invoiceTons: tons, invoiceAmount: amount, partShare: tons / progress.tons };
}
