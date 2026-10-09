export type RefundSourceLine = { id: string; name: string; vatRate: number; exemptionCode: string | null; productId?: string; unit?: string; unitPrice?: number; availableQuantity?: number; discountRate?: number };
export function refundSourceLines(document: any, incoming: any): RefundSourceLine[] {
  const lines = (document.included || []).filter((line: any) => line.type === "purchase_bill_details");
  if (!lines.length) throw new Error("Alış faturası kalemleri doğrulanamadı.");
  return lines.map((line: any) => {
    const value = line.attributes?.vat_rate;
    const vatRate = Number(value);
    if (value == null || value === "" || !Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) throw new Error("Kaynak faturanın KDV oranı doğrulanamadı.");
    if (["vat_withholding_rate","excise_duty_rate","communications_tax_rate","accommodation_tax_rate"].some(key => Number(line.attributes?.[key] || 0))) throw new Error("Ek vergi içeren fark iadesini Paraşüt üzerinden oluşturun.");
    const exemptionCode = vatRate === 0 ? String(line.attributes?.vat_exemption_reason_code || incoming?.data?.attributes?.vat_exemption_reason_code || "").trim() : null;
    if (vatRate === 0 && !exemptionCode) throw new Error("Alış faturasının KDV istisna kodu alınamadı. İstisna kodu varsayılmadı; Paraşüt üzerinden kontrol edin.");
    const productId = line.relationships?.product?.data?.id;
    const product = (document.included || []).find((item:any)=>item.type==='products' && String(item.id)===String(productId));
    const quantity = Number(line.attributes?.quantity);
    const unitPrice = Number(line.attributes?.unit_price);
    const discountValue = Number(line.attributes?.discount_value || 0);
    const discountRate = line.attributes?.discount_type === 'percentage' ? discountValue : quantity>0 && unitPrice>0 ? discountValue/(quantity*unitPrice)*100 : 0;
    return {id:String(line.id),name:product?.attributes?.name || line.attributes?.description || "Alış kalemi",vatRate,exemptionCode,productId:productId ? String(productId) : undefined,unit:product?.attributes?.unit || line.attributes?.unit,unitPrice,availableQuantity:Number(line.attributes?.unrefunded_quantity ?? quantity),discountRate};
  });
}
export function refundPayload(order: any, bill: any, sourceLine: RefundSourceLine, productId: string, date: string, returnType = "price", quantity = 1) {
  const amount = Number(order.purchase_difference_amount);
  const vatRate = sourceLine.vatRate;
  if (!(amount > 0) || !Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100 || !productId || (vatRate === 0 && !sourceLine.exemptionCode)) throw new Error("İade tutarı, hizmet kalemi veya kaynak vergi bilgisi geçersiz.");
  if (!["price","product"].includes(returnType)) throw new Error("İade türü geçersiz.");
  let unitPrice = Number((amount / (1 + vatRate / 100)).toFixed(6));
  if (returnType === "product") {
    unitPrice = Number(sourceLine.unitPrice);
    if (!sourceLine.productId || productId !== sourceLine.productId || !sourceLine.unit || !(unitPrice>0) || !Number.isFinite(quantity) || quantity<=0 || quantity>Number(sourceLine.availableQuantity) || Math.abs(quantity-Math.round(quantity*1e6)/1e6)>1e-9) throw new Error("İade miktarı veya alış ürününün birim bilgisi geçersiz.");
    const total = Math.round(quantity*unitPrice*(1-Number(sourceLine.discountRate || 0)/100)*(1+vatRate/100)*100)/100;
    if (Math.abs(total-amount)>.01) throw new Error(`Girilen ürün miktarının KDV dahil tutarı (${total.toFixed(2)} TL) onaylanan fazla fatura tutarıyla (${amount.toFixed(2)} TL) uyuşmuyor.`);
  } else quantity = 1;
  const vat = Math.round((amount - amount / (1 + vatRate / 100)) * 100) / 100;
  const description = `${bill.invoice_no || bill.purchase_bill_id} numaralı faturaya istinaden · Alış faturası ${returnType === "product" ? "ürün / fazla tonaj iadesi" : "fiyat farkı iadesi"} · Satış ${order.satisId || order.id} · Kaynak alış fatura ID: ${bill.purchase_bill_id} · İlgili ürün: ${sourceLine.name}${sourceLine.exemptionCode ? ` · KDV istisna kodu: ${sourceLine.exemptionCode}` : ""}`;
  return { data: { type: "sales_invoices", attributes: {
    item_type: "invoice", issue_date: date, due_date: date, currency: "TRL", exchange_rate: 1,
    net_total: amount, total_vat: vat, description, invoice_note: description, shipment_included: false,
  }, relationships: {
    contact: { data: { type: "contacts", id: String(bill.supplier_id) } },
    details: { data: [{type:"sales_invoice_details",attributes:{description:returnType === "product" ? sourceLine.name : "Fiyat farkı",quantity,unit_price:unitPrice,vat_rate:vatRate,discount_type:"percentage",discount_value:returnType === "product" ? Number(sourceLine.discountRate || 0) : 0},relationships:{product:{data:{type:"products",id:productId}}}}] },
  } } };
}
export function upstreamRefundError(document: any) {
  return (Array.isArray(document?.errors) ? document.errors.map((error: any) => String(error.detail || error.title || "")).filter(Boolean).join("; ") : "") || "Paraşüt iade kaydını kabul etmedi.";
}

export function priceDifferenceEDocument(invoiceId: string, recipient: string, sourceLine: RefundSourceLine) {
  if (sourceLine.vatRate === 0 && !sourceLine.exemptionCode) throw new Error("Kaynak istisna kodu eksik.");
  return {data:{type:"e_invoices",attributes:{scenario:"commercial",to:recipient,vat_exemption_reason_code:sourceLine.vatRate===0 ? sourceLine.exemptionCode : null},relationships:{invoice:{data:{type:"sales_invoices",id:invoiceId}}}}};
}
