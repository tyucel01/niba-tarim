// The original match stays the primary source for existing sales/partial invoices.
export function purchaseMatches(order: any): any[] {
  if (Array.isArray(order.purchase_invoice_matches) && order.purchase_invoice_matches.length) return order.purchase_invoice_matches;
  if (!order.matched_purchase_invoice_id) return [];
  const legacy = order.sales_invoice_id && (!Array.isArray(order.sales_invoice_history) || order.sales_invoice_history.some((row: any) => row.state === "legacy"));
  const allocated = ["accept", "refund"].includes(order.purchase_difference_mode) || legacy || !(Number(order.teslimOlanTonaj)>0)
    ? Number(order.matched_purchase_allocated_amount ?? order.matched_purchase_invoice_total ?? 0)
    : Math.round(Number(order.alisFiyati || 0)*Number(order.teslimOlanTonaj)*100)/100;
  return [{ purchaseBillId: String(order.matched_purchase_invoice_id), invoiceNo: order.matched_purchase_invoice_no || order.gelenFatura,
    total: Number(order.matched_purchase_invoice_total || 0), allocatedAmount: allocated }];
}
export function remainingPurchaseAmount(order: any, expected: number) {
  const allocated = purchaseMatches(order).reduce((sum, match) => sum + Number(match.allocatedAmount || 0), 0);
  return Math.max(0, Math.round((expected - allocated) * 100) / 100);
}
export function purchaseBillIds(order: any): string[] { return purchaseMatches(order).map(match => String(match.purchaseBillId)); }
export function hasPurchaseMatch(order: any, eInvoiceId: string, purchaseBillId?: string) {
  return purchaseMatches(order).some(match => (match.eInvoiceId && String(match.eInvoiceId) === eInvoiceId) || (purchaseBillId && String(match.purchaseBillId) === purchaseBillId));
}
