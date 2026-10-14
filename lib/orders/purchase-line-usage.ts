// A purchase line is consumed by invoiced tons and in-flight reservations,
// not by the order's entire delivered quantity.
export function purchaseLineUsedTons(assignments: any[], reservations: any[], billId: string, lineId: string, excludedOrderId?: string) {
  return assignments.filter(item => item.line_id === lineId && item.order_id !== excludedOrderId && String(item.siparisler?.matched_purchase_invoice_id) === String(billId)).reduce((sum, item) => sum + Number(item.siparisler?.sales_invoiced_tonnage || 0) + reservations.filter(part => part.order_id === item.order_id && part.state === "creating").reduce((pending, part) => pending + Number(part.tons || 0), 0), 0);
}
