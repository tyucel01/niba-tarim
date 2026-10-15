// Existing single-line assignments remain compatible with multi-line selections.
export function assignmentLines(assignment: any): { id: string; tons: number }[] {
  return Array.isArray(assignment?.lines) && assignment.lines.length ? assignment.lines : assignment ? [{id: assignment.line_id, tons: Number(assignment.source_tons)}] : [];
}
export function purchaseLineUsedTons(assignments: any[], reservations: any[], billId: string, lineId: string, excludedOrderId?: string) {
  return assignments.filter(item => item.order_id !== excludedOrderId && String(item.siparisler?.matched_purchase_invoice_id) === String(billId)).reduce((sum, item) => {
    const lines = assignmentLines(item), total = lines.reduce((s, l) => s + Number(l.tons), 0);
    const line = lines.find(l => l.id === lineId);
    if (!line) return sum;
    const consumed = Number(item.siparisler?.sales_invoiced_tonnage || 0) + reservations.filter(part => part.order_id === item.order_id && part.state === "creating").reduce((s, part) => s + Number(part.tons || 0), 0);
    return sum + consumed * Number(line.tons) / total;
  }, 0);
}
