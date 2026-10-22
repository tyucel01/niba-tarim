// Existing single-line assignments remain compatible with multi-line selections.
export function assignmentLines(assignment: any): { id: string; tons: number }[] {
  return Array.isArray(assignment?.lines) && assignment.lines.length ? assignment.lines : assignment ? [{id: assignment.line_id, tons: Number(assignment.source_tons)}] : [];
}
export function purchaseLineUsedTons(assignments: any[], reservations: any[], billId: string, lineId: string, excludedOrderId?: string) {
  const key = (primary: string, id: string) => id.includes(":") ? id : `${primary}:${id}`;
  const wanted = key(String(billId), lineId);
  return assignments.filter(item => item.order_id !== excludedOrderId).reduce((sum, item) => {
    const lines = assignmentLines(item), total = lines.reduce((s, l) => s + Number(l.tons), 0);
    const line = lines.find(l => key(String(item.purchase_bill_id || item.siparisler?.matched_purchase_invoice_id), l.id) === wanted);
    if (!line) return sum;
    const consumed = Number(item.siparisler?.sales_invoiced_tonnage || 0) + reservations.filter(part => part.order_id === item.order_id && part.state === "creating").reduce((s, part) => s + Number(part.tons || 0), 0);
    return sum + consumed * Number(line.tons) / total;
  }, 0);
}
