import { purchaseBillIds } from "@/lib/orders/purchase-matches";

// Keep original line IDs for the first bill so existing partial selections stay valid.
export function mergePurchaseSources(order: any, bills: any[]) {
  const ids = purchaseBillIds(order);
  if (bills.length !== ids.length || !bills.length) throw new Error("Alış faturası kaynakları doğrulanamadı.");
  for (let index = 0; index < bills.length; index++) {
    if (String(bills[index]?.data?.id) !== ids[index] || !["TRY", "TRL"].includes(bills[index]?.data?.attributes?.currency)) throw new Error("Alış faturası kaynağı veya TL tutarı doğrulanamadı.");
  }
  if (bills.length === 1) return bills[0];
  return { data: { ...bills[0].data, attributes: { ...bills[0].data.attributes, net_total: bills.reduce((sum, bill) => sum + Number(bill.data.attributes.net_total), 0) } },
    included: bills.flatMap((bill, index) => (bill.included || []).map((row: any) => row.type === "purchase_bill_details" ? { ...row, id: index === 0 ? String(row.id) : `${ids[index]}:${row.id}`, source_invoice_no: bill.data.attributes.invoice_no } : row)) };
}

export async function purchaseSourceUsage(db: any, billIds: string[]) {
  let orders: any[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db.from("siparisler").select("id,matched_purchase_invoice_id,purchase_invoice_matches,sales_invoice_id,sales_invoiced_tonnage").not("matched_purchase_invoice_id", "is", null).range(start, start + 999);
    if (error) throw new Error("Geçmiş fatura miktarları kontrol edilemedi.");
    orders.push(...(data || []).filter((order: any) => purchaseBillIds(order).some(id => billIds.includes(id))));
    if (!data || data.length < 1000) break;
  }
  let assignments: any[] = [], reservations: any[] = [];
  for (let start = 0; start < orders.length; start += 200) {
    const ids = orders.slice(start, start + 200).map(order => order.id);
    for (const [table, fields] of [["order_purchase_line_assignments", "order_id,purchase_bill_id,line_id,source_tons,lines"], ["order_sales_invoice_parts", "order_id,tons,state,source_lines"]]) {
      // Reservations/history may exceed a single Data API page.
      for (let offset = 0; ; offset += 1000) {
        let query = db.from(table).select(fields).in("order_id", ids);
        if (table === "order_sales_invoice_parts") query = query.neq("state", "failed");
        const {data, error} = await query.range(offset, offset + 999);
        if (error) throw new Error("Kalemlerin kalan miktarı alınamadı. Yeniden deneyin.");
        if (table === "order_purchase_line_assignments") assignments.push(...(data || []).map((row: any) => ({...row, siparisler: orders.find(order => order.id === row.order_id)})));
        else reservations.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
    }
  }
  return {orders, assignments, reservations};
}
