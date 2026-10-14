// Only invoices created by this panel and accepted for e-invoice issuance count.
// Purchase matching, previews, failed creation and review states never produce a Sheet mark.
export function sheetInvoiceStatus(order: any): "Evet" | "Kısmi Evet" | null {
  const history = Array.isArray(order.sales_invoice_history) ? order.sales_invoice_history : [];
  const issued = history.filter((part: any) => part.state === "issued" && part.id);
  if (!issued.length) return null;
  const tons = Number(order.teslimOlanTonaj);
  const issuedTons = issued.reduce((sum: number, part: any) => sum + Number(part.tons || 0), 0);
  if (!Number.isFinite(tons) || tons <= 0 || !Number.isFinite(issuedTons) || issuedTons <= 0 || issuedTons > tons + .000001) return null;
  return tons - issuedTons < .000001 ? "Evet" : "Kısmi Evet";
}
