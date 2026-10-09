import { purchaseAllocation } from "@/lib/orders/sales-progress";
import { createClient } from "@supabase/supabase-js";
export function invoiceAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function reusableInvoices() {
  const db = invoiceAdmin();
  const { data: pool, error } = await db.from("purchase_invoice_pool").select("*").eq("state", "ready").order("created_at", { ascending: false });
  if (error) throw new Error("Fatura bakiyeleri okunamadı.");
  if (!pool?.length) return [];
  const ids = pool.map(invoice => invoice.purchase_bill_id).filter(Boolean);
  let orders: any[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error: usageError } = await db.from("siparisler").select("matched_purchase_invoice_id,matched_purchase_allocated_amount,matched_purchase_invoice_total,teslimOlanTonaj,alisFiyati,sales_invoice_id,sales_invoice_history,purchase_difference_mode,purchase_difference_amount").in("matched_purchase_invoice_id", ids).range(start, start + 999);
    if (usageError) throw new Error("Faturaya ayrılan tutarlar okunamadı.");
    orders = orders.concat(data || []);
    if (!data || data.length < 1000) break;
  }
  return pool.map(invoice => {
    const used = orders.filter(order => order.matched_purchase_invoice_id === invoice.purchase_bill_id).reduce((sum, order) => sum + purchaseAllocation(order) + (order.purchase_difference_mode === "refund" ? Number(order.purchase_difference_amount || 0) : 0), 0);
    const remaining = Math.round((Number(invoice.total) - used) * 100) / 100;
    return { id: invoice.e_invoice_id, purchase_bill_id: invoice.purchase_bill_id, reusable: true, supplier_id: invoice.supplier_id, supplier_name: invoice.supplier_name, from_vkn: invoice.supplier_tax_no,
      allocated_amount: Math.round(used * 100) / 100, remaining_amount: remaining,
      attributes: { invoice_no: invoice.invoice_no, net_total: invoice.total, currency: invoice.currency, from_vkn: invoice.supplier_tax_no, issue_date: invoice.issue_date } };
  }).filter(invoice => invoice.remaining_amount > 0.005);
}
