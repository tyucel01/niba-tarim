// Older panel invoices were preserved as "legacy" when partial invoicing was introduced.
// Confirm the active official document before including their tonnage in Sheet status.
export function successfulSalesDocument(response: any) {
  const invoice = response?.data;
  if (!["invoice", "export"].includes(invoice?.attributes?.item_type)) return false;
  const ref = invoice.relationships?.active_e_document?.data;
  const document = (response.included || []).find((item: any) => item.type === ref?.type && String(item.id) === String(ref?.id));
  const attributes = document?.attributes;
  if (!attributes || ["rejected", "refunded"].includes(attributes.response_type) || attributes.item_type === "refund") return false;
  if (ref.type === "e_invoices") return attributes.direction === "outbound" && attributes.status === "successful";
  if (ref.type === "e_archives") return ["sent", "printed", "legalized"].includes(attributes.status);
  return false;
}
const cache = new Map<string, { valid: boolean; expires: number }>();
const pending = new Map<string, Promise<boolean>>();
export async function verifiedLegacyInvoices(orders: any[]): Promise<Set<string>> {
  const ids = [...new Set<string>(orders.flatMap(order => (Array.isArray(order.sales_invoice_history) ? order.sales_invoice_history : []).filter((part: any) => part.state === "legacy" && part.id).map((part: any) => String(part.id))))];
  const verified = new Set<string>();
  if (!ids.length) return verified;
  const company = process.env.PARASUT_COMPANY_ID;
  if (!company) throw new Error("Paraşüt firma bilgisi bulunamadı.");
  let access: Promise<string> | undefined;
  const token = () => access ||= (async () => {
    const response = await fetch("https://api.parasut.com/oauth/token", { method: "POST", body: new URLSearchParams({ grant_type: "password", client_id: process.env.PARASUT_CLIENT_ID || "", client_secret: process.env.PARASUT_CLIENT_SECRET || "", username: process.env.PARASUT_USERNAME || "", password: process.env.PARASUT_PASSWORD || "" }), cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.access_token) throw new Error("Paraşüt fatura doğrulama servisine ulaşılamadı.");
    return data.access_token as string;
  })();
  for (const id of ids) {
    const key = `${company}:${id}`;
    const cached = cache.get(key);
    let valid: boolean;
    if (cached && cached.expires > Date.now()) valid = cached.valid;
    else {
      let promise = pending.get(key);
      if (!promise) {
        promise = (async () => {
          const response = await fetch(`https://api.parasut.com/v4/${company}/sales_invoices/${encodeURIComponent(id)}?include=active_e_document`, { headers: { Authorization: `Bearer ${await token()}`, Accept: "application/json" }, cache: "no-store" });
          if (!response.ok) throw new Error("Eski satış faturası Paraşüt'ten doğrulanamadı.");
          const valid = successfulSalesDocument(await response.json());
          if (cache.size >= 500) cache.delete(cache.keys().next().value!);
          cache.set(key, { valid, expires: Date.now() + (valid ? 5 * 60_000 : 60_000) });
          return valid;
        })().finally(() => pending.delete(key));
        pending.set(key, promise);
      }
      valid = await promise;
    }
    if (valid) verified.add(id);
  }
  return verified;
}
