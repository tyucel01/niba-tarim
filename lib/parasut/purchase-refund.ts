export function refundPayload(order: any, bill: any, vatRate: number, date: string) {
  const amount = Number(order.purchase_difference_amount);
  if (!(amount > 0) || !Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) throw new Error("İade tutarı veya KDV oranı geçersiz.");
  const vat = Math.round((amount - amount / (1 + vatRate / 100)) * 100) / 100;
  return { data: { type: "purchase_bills", attributes: {
    item_type: "refund", issue_date: date, due_date: date, currency: "TRL", exchange_rate: 1,
    net_total: amount, total_vat: vat,
    description: `${bill.invoice_no || bill.purchase_bill_id} alış faturası fiyat farkı iadesi · Satış ${order.satisId || order.id} · Kaynak alış fatura ID: ${bill.purchase_bill_id}`,
  }, relationships: { supplier: { data: { type: "contacts", id: String(bill.supplier_id) } } } } };
}
export function refundVatRates(document: any) {
  const lines = (document.included || []).filter((line: any) => line.type === "purchase_bill_details");
  if (!lines.length) throw new Error("Alış faturası kalemleri doğrulanamadı.");
  return Array.from(new Set<number>(lines.map((line: any) => {
    const value = line.attributes?.vat_rate;
    const rate = Number(value);
    if (value == null || value === "" || !Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("Kaynak faturanın KDV oranı doğrulanamadı.");
    if (["vat_withholding_rate","excise_duty_rate","communications_tax_rate","accommodation_tax_rate"].some(key => Number(line.attributes?.[key] || 0))) throw new Error("Ek vergi içeren fark iadesini Paraşüt üzerinden oluşturun.");
    return rate;
  })));
}
