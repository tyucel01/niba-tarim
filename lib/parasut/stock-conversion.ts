export type StockSelection = { lineIndex: number; productId: string; sourceUnit: string; factor?: number };
export function normalizeInvoiceUnit(value: unknown) {
  const raw = String(value ?? "").trim();
  const unit = raw.toLocaleLowerCase("tr-TR").replace(/\./g, "");
  if (["kg", "kgm", "kgr", "kilogram", "kilogramme"].includes(unit)) return "kg";
  if (["ton", "t", "tn", "tne", "tonne", "tonnes", "mt"].includes(unit)) return "ton";
  if (["adet", "ad", "c62", "ni", "piece", "pieces"].includes(unit)) return "Adet";
  return raw;
}
export function sourceInvoiceUnit(attributes: any) {
  return normalizeInvoiceUnit([attributes.unit, attributes.unit_name, attributes.measurement_unit,
    attributes.unit_code, attributes.base_unit, attributes.product_unit].find(value => String(value ?? "").trim()));
}
export function stockSourceKey(name: unknown) {
  return String(name ?? "").trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}
export function convertStockLine(attributes: any, selection: StockSelection, product: any) {
  const sourceUnit = sourceInvoiceUnit(attributes) || normalizeInvoiceUnit(selection.sourceUnit);
  const targetUnit = normalizeInvoiceUnit(product?.attributes?.unit);
  if (!product?.id || String(product.id) !== String(selection.productId) || product.attributes?.archived) throw new Error("Seçilen stok ürünü bulunamadı veya arşivlenmiş. Yeniden seçin.");
  if (!sourceUnit || !targetUnit) throw new Error("Faturadaki birimi ve stok kartının birimini belirtin.");
  if (sourceInvoiceUnit(attributes) && sourceInvoiceUnit(attributes) !== normalizeInvoiceUnit(selection.sourceUnit)) throw new Error("Faturadaki birim değiştirilemez; kaynak birimi kontrol edin.");
  const quantity = Number(attributes.quantity), unitPrice = Number(attributes.unit_price), vatRate = Number(attributes.vat_rate);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || attributes.vat_rate == null || attributes.vat_rate === "" || !Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) throw new Error("Fatura kaleminin miktarı, fiyatı veya KDV oranı geçersiz.");
  let factor = 1;
  if (sourceUnit === "ton" && targetUnit === "kg") factor = 1000;
  else if (sourceUnit === "kg" && targetUnit === "ton") factor = .001;
  else if (sourceUnit.toLocaleLowerCase("tr-TR") !== targetUnit.toLocaleLowerCase("tr-TR")) {
    if (sourceUnit !== "Adet" && targetUnit !== "Adet") throw new Error("Bu iki birim arasında otomatik dönüşüm desteklenmiyor.");
    factor = Number(selection.factor);
    if (!Number.isFinite(factor) || factor <= 0) throw new Error(`1 ${sourceUnit} kaç ${targetUnit} ediyor? Dönüşüm katsayısını belirtin.`);
  }
  const convertedQuantity = Number((quantity * factor).toFixed(8));
  const convertedPrice = Number((unitPrice / factor).toFixed(8));
  if (!Number.isFinite(convertedQuantity) || !Number.isFinite(convertedPrice) || convertedQuantity <= 0 || Math.abs(convertedQuantity * convertedPrice - quantity * unitPrice) > .005) throw new Error("Dönüşüm hassasiyeti fatura tutarını değiştiriyor. Birimleri kontrol edin.");
  const discount = Number(attributes.discount_value ?? 0);
  if (!Number.isFinite(discount) || discount < 0) throw new Error("Fatura kalemi iskontosu geçersiz.");
  const lineNet = quantity * unitPrice - (attributes.discount_type === "percentage" ? quantity * unitPrice * discount / 100 : discount);
  return {
    lineIndex: selection.lineIndex, sourceName: String(attributes.product_mapping_name || attributes.product_name || attributes.description || "E-Fatura Kalemi"),
    productId: String(product.id), productName: String(product.attributes?.name || ""), inventoryTracking: Boolean(product.attributes?.inventory_tracking),
    sourceUnit, sourceQuantity: quantity, sourceUnitPrice: unitPrice, targetUnit, quantity: convertedQuantity, unitPrice: convertedPrice,
    vatRate, discountType: attributes.discount_type || "amount", discountValue: discount, netTotal: Number(lineNet.toFixed(2)), factor,
  };
}
