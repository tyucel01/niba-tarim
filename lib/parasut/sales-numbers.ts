import { cachedIncomingPage } from './incoming-cache';
import { invoiceAdmin } from './invoice-pool';

export function invoiceNumber(response: any): string | null {
  const invoice = response?.data;
  const document = invoice?.relationships?.active_e_document?.data;
  const active = (response?.included || []).find((x: any) => String(x.id) === String(document?.id) && x.type === document?.type);
  const number = String(active?.attributes?.invoice_no || invoice?.attributes?.invoice_no || '').trim();
  return number && number !== String(invoice?.id) && number !== String(document?.id) ? number : null;
}

// Only unresolved numbers are checked; the shared cache limits each invoice to one check per minute.
export async function syncSalesNumbers(orders: any[]) {
  const company = process.env.PARASUT_COMPANY_ID;
  if (!company) return;
  const db = invoiceAdmin();
  let token: Promise<string> | undefined;
  const accessToken = () => token ||= (async () => {
    const res = await fetch('https://api.parasut.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'password',client_id:process.env.PARASUT_CLIENT_ID,client_secret:process.env.PARASUT_CLIENT_SECRET,username:process.env.PARASUT_USERNAME,password:process.env.PARASUT_PASSWORD}),cache:'no-store'});
    const json = await res.json();
    if (!res.ok || !json.access_token) throw new Error('Fatura numarası servisi geçici olarak beklemede.');
    return json.access_token as string;
  })();
  let checked = 0;
  for (const order of orders) {
    const parts = Array.isArray(order.sales_invoice_history) ? [...order.sales_invoice_history] : [];
    if (order.sales_invoice_id && !parts.some((p: any)=>String(p.id)===String(order.sales_invoice_id))) parts.push({id:order.sales_invoice_id,invoice_no:order.sales_invoice_no});
    for (const part of parts) {
      if (!part.id || (part.invoice_no && String(part.invoice_no)!==String(part.id))) continue;
      if (++checked>10) return;
      try {
        const response = await cachedIncomingPage(`sales-number:${company}:${part.id}`,async()=>{
          const auth = await accessToken();
          const res = await fetch(`https://api.parasut.com/v4/${company}/sales_invoices/${encodeURIComponent(part.id)}?include=active_e_document`,{headers:{Authorization:`Bearer ${auth}`,Accept:'application/json'},cache:'no-store'});
          if (!res.ok) throw new Error('Fatura numarası alınamadı.');
          return res.json();
        },true);
        const number = invoiceNumber(response);
        if (!number) continue;
        const {error} = await db.rpc('sync_order_sales_number',{p_order_id:order.id,p_invoice_id:String(part.id),p_number:number});
        if (error) continue;
        if (String(order.sales_invoice_id)===String(part.id)) order.sales_invoice_no=number;
        order.sales_invoice_history=(order.sales_invoice_history || []).map((p: any)=>String(p.id)===String(part.id)?{...p,invoice_no:number}:p);
      } catch { /* Orders stay available while Paraşüt is busy; the next refresh retries safely. */ }
    }
  }
}
