// Current source selection remains separate from immutable per-invoice consumption.
export function assignmentLines(assignment: any): { id: string; tons: number }[] {
  return Array.isArray(assignment?.lines) && assignment.lines.length ? assignment.lines : assignment ? [{id: assignment.line_id, tons: Number(assignment.source_tons)}] : [];
}
export function sourceLineKey(primary: string, id: string) { return id.includes(":") ? id : `${primary}:${id}`; }
const billedStates = ["created", "issued", "needs_review"];
const hasSources = (part: any) => Array.isArray(part.source_lines) && part.source_lines.length > 0;
export function canChoosePurchaseSources(order: any, parts: any[]) {
  if (!(Number(order.sales_invoiced_tonnage)>0)) return true;
  const own = parts.filter(part => part.order_id === order.id && part.state !== "failed");
  if (own.some(part => part.state === "creating" || !hasSources(part))) return false;
  const tracked = own.filter(part => billedStates.includes(part.state)).reduce((sum, part) => sum + Number(part.tons), 0);
  return Math.abs(tracked - Number(order.sales_invoiced_tonnage)) < .000001;
}
export function purchaseLineUsedTons(assignments: any[], parts: any[], billId: string, lineId: string, excludedOrderId?: string) {
  const wanted = sourceLineKey(String(billId), lineId);
  const active = parts.filter(part => part.order_id !== excludedOrderId && ["creating", ...billedStates].includes(part.state));
  // Each completed/pending invoice keeps the exact source quantities it consumed.
  const tracked = active.filter(hasSources).reduce((sum, part) => sum + part.source_lines.filter((line: any) => line.id === wanted).reduce((s: number, line: any) => s + Number(line.tons), 0), 0);
  const legacy = assignments.filter(item => item.order_id !== excludedOrderId).reduce((sum, item) => {
    const lines = assignmentLines(item), total = lines.reduce((s, l) => s + Number(l.tons), 0);
    const line = lines.find(l => sourceLineKey(String(item.purchase_bill_id || item.siparisler?.matched_purchase_invoice_id), l.id) === wanted);
    if (!line || !(total>0)) return sum;
    const own = active.filter(part => part.order_id === item.order_id);
    const trackedBilled = own.filter(part => billedStates.includes(part.state) && hasSources(part)).reduce((s, part) => s + Number(part.tons), 0);
    const untrackedPending = own.filter(part => part.state === "creating" && !hasSources(part)).reduce((s, part) => s + Number(part.tons), 0);
    const consumed = Math.max(0,Number(item.siparisler?.sales_invoiced_tonnage || 0)-trackedBilled)+untrackedPending;
    return sum + consumed * Number(line.tons) / total;
  }, 0);
  return tracked + legacy;
}
