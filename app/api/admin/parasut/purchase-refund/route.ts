import { authorizeWhatsApp } from "@/lib/whatsapp/admin";
import { NextRequest, NextResponse } from "next/server";
import { invoiceAdmin } from "@/lib/parasut/invoice-pool";
import { refundPayload, refundSourceLines, upstreamRefundError, priceDifferenceEDocument } from "@/lib/parasut/purchase-refund";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const base = "https://api.parasut.com";
async function accessToken() {
  const body = new URLSearchParams({grant_type:"password",client_id:process.env.PARASUT_CLIENT_ID || "",client_secret:process.env.PARASUT_CLIENT_SECRET || "",username:process.env.PARASUT_USERNAME || "",password:process.env.PARASUT_PASSWORD || ""});
  const response = await fetch(`${base}/oauth/token`,{method:"POST",body,cache:"no-store"});
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("Paraşüt bağlantısı kurulamadı.");
  return data.access_token;
}
async function priceDifferenceProduct(headers: Record<string,string>, company: string, vatRate: number) {
  const response = await fetch(`${base}/v4/${company}/products?filter[name]=${encodeURIComponent("Fiyat farkı")}&page[size]=25`,{headers,cache:"no-store"});
  const result = await response.json();
  if (!response.ok) throw new Error("Fiyat farkı hizmet kartı aranamadı.");
  const exact = (result.data || []).find((product: any) => product.attributes?.name === "Fiyat farkı" && !product.attributes?.archived && product.attributes?.inventory_tracking === false);
  if (exact) return String(exact.id);
  const createdResponse = await fetch(`${base}/v4/${company}/products`,{method:"POST",headers,cache:"no-store",body:JSON.stringify({data:{type:"products",attributes:{name:"Fiyat farkı",unit:"Adet",vat_rate:vatRate,inventory_tracking:false,archived:false}}})});
  const created = await createdResponse.json();
  if (!createdResponse.ok || !created.data?.id) throw new Error(upstreamRefundError(created));
  return String(created.data.id);
}
async function context(orderId: string) {
  const db = invoiceAdmin();
  const {data:order,error} = await db.from("siparisler").select("*").eq("id",orderId).single();
  if (error || !order) throw new Error("Sipariş bulunamadı.");
  if (!["accept","refund"].includes(order.purchase_difference_mode) || !(Number(order.purchase_difference_amount)>0)) throw new Error("Bu satışta iade edilebilecek onaylı fazla tutar yok.");
  const {data:bill,error:billError} = await db.from("purchase_invoice_pool").select("*").eq("purchase_bill_id",order.matched_purchase_invoice_id).single();
  if (billError || !bill || bill.state !== "ready") throw new Error("Kaynak alış faturası doğrulanamadı.");
  const token = await accessToken();
  const company = process.env.PARASUT_COMPANY_ID;
  if (!company) throw new Error("Paraşüt firma bilgisi eksik.");
  const headers = {Authorization:`Bearer ${token}`,Accept:"application/json","Content-Type":"application/json"};
  const response = await fetch(`${base}/v4/${company}/purchase_bills/${encodeURIComponent(bill.purchase_bill_id)}?include=details,details.product,supplier`,{headers,cache:"no-store"});
  const source = await response.json();
  const supplier = source.data?.relationships?.supplier?.data?.id;
  if (!response.ok || String(supplier || "")!==String(bill.supplier_id) || (!Number.isFinite(Number(source.data?.attributes?.net_total)) || Math.abs(Number(source.data?.attributes?.net_total)-Number(bill.total))>.01) || source.data?.attributes?.item_type !== "purchase_bill") throw new Error("Kaynak faturanın tutarı veya tedarikçisi değişmiş. Paraşüt üzerinde kontrol edin.");
  const incomingResponse = await fetch(`${base}/v4/${company}/e_invoices/${encodeURIComponent(bill.e_invoice_id)}`, {headers,cache:"no-store"});
  const incoming = await incomingResponse.json();
  if (!incomingResponse.ok || String(incoming.data?.id) !== String(bill.e_invoice_id)) throw new Error("Kaynak e-faturanın vergi bilgileri doğrulanamadı.");
  return {db,order,bill,headers,company,sourceLines:refundSourceLines(source,incoming)};
}
export async function GET(req: NextRequest) {
  try {
    const denied = await authorizeWhatsApp(req, invoiceAdmin()); if (denied) return denied;
    const {order,bill,sourceLines,company} = await context(req.nextUrl.searchParams.get("orderId") || "");
    return NextResponse.json({success:true,amount:Number(order.purchase_difference_amount),supplierName:bill.supplier_name,invoiceNo:bill.invoice_no,sourceLines,state:order.purchase_refund_state,issueState:order.purchase_refund_issue_state,savedSource:order.purchase_refund_source,refundId:order.purchase_refund_id,refundUrl:order.purchase_refund_id ? `https://app.parasut.com/${company}/sales_invoices/${order.purchase_refund_id}` : null});
  } catch (error) {return NextResponse.json({success:false,error:error instanceof Error ? error.message : "İade önizlemesi alınamadı."},{status:422});}
}
async function issueDifference(order: any, bill: any, db: ReturnType<typeof invoiceAdmin>, headers: Record<string,string>, company: string, body: any) {
  const source = order.purchase_refund_source;
  if (!order.purchase_refund_id || order.purchase_refund_state !== "verified" || !source) throw new Error("Önce fiyat farkı satış faturasını oluşturup doğrulayın.");
  if (body.confirm !== true || body.exemptionCode !== source.exemptionCode || body.vatRate !== source.vatRate) throw new Error("Faturanın kaynak KDV ve istisna kodunu onaylayın.");
  if (order.purchase_refund_issue_state !== "pending") throw new Error("e-Fatura işlemi başlatılmış veya kontrol bekliyor. Paraşüt üzerinde kontrol edin; tekrar gönderilmedi.");
  const contactResponse = await fetch(`${base}/v4/${company}/contacts/${encodeURIComponent(bill.supplier_id)}`,{headers,cache:"no-store"});
  const contact = await contactResponse.json();
  if (!contactResponse.ok) throw new Error("Tedarikçinin e-Fatura adresi doğrulanamadı.");
  const attributes = contact.data?.attributes || {};
  let recipient = attributes.e_invoice_address || attributes.invoicing_preferences?.e_invoice_send_to;
  if (!recipient && /^\d{10,11}$/.test(String(attributes.tax_number || ""))) {
    const inboxResponse = await fetch(`${base}/v4/${company}/e_invoice_inboxes?filter[vkn]=${encodeURIComponent(attributes.tax_number || "")}`,{headers,cache:"no-store"});
    const inboxes = await inboxResponse.json();
    if (inboxResponse.ok) recipient = inboxes.data?.[0]?.attributes?.e_invoice_address || inboxes.data?.[0]?.attributes?.address;
  }
  if (!recipient) throw new Error("Tedarikçinin e-Fatura posta kutusu bulunamadı. Paraşüt'ten resmileştirin.");
  // Verify the existing invoice before submission; never send an edited invoice using stale tax metadata.
  const checkResponse = await fetch(`${base}/v4/${company}/sales_invoices/${order.purchase_refund_id}?include=contact,details,details.product`,{headers,cache:"no-store"});
  const invoice = await checkResponse.json();
  const details = (invoice.included || []).filter((row:any)=>row.type==='sales_invoice_details');
  if (!checkResponse.ok || String(invoice.data?.relationships?.contact?.data?.id) !== String(bill.supplier_id) || Math.abs(Number(invoice.data?.attributes?.net_total)-Number(order.purchase_difference_amount))>.01 || details.length!==1 || Number(details[0].attributes?.vat_rate)!==source.vatRate) throw new Error("Fiyat farkı faturası değişmiş. Paraşüt üzerinde kontrol edin.");
  const detail = details[0];
  if (!Number.isFinite(Number(invoice.data?.attributes?.net_total)) || Number(detail.attributes?.quantity) !== source.quantity || Math.abs(Number(detail.attributes?.unit_price)-Number(source.invoiceUnitPrice))>.000001 || String(detail.relationships?.product?.data?.id) !== String(source.refundProductId)) throw new Error("İade faturası kalemi onaylanan ürün veya miktarla eşleşmiyor. Paraşüt'ten kontrol edin.");
  const {data:locked,error} = await db.from("siparisler").update({purchase_refund_issue_state:"sending"}).eq("id",order.id).eq("purchase_refund_issue_state","pending").select("id");
  if (error || !locked?.length) throw new Error("e-Fatura için başka bir işlem başlatılmış. Tekrar gönderilmedi.");
  const response = await fetch(`${base}/v4/${company}/e_invoices`,{method:"POST",headers,cache:"no-store",body:JSON.stringify(priceDifferenceEDocument(order.purchase_refund_id,recipient,source))});
  const document = await response.json().catch(()=>null);
  if (!response.ok) {
    if ([400,401,403,404,422].includes(response.status)) await db.from("siparisler").update({purchase_refund_issue_state:"pending"}).eq("id",order.id).eq("purchase_refund_issue_state","sending");
    throw new Error(upstreamRefundError(document));
  }
  const {error:saveError} = await db.from("siparisler").update({purchase_refund_issue_state:"submitted"}).eq("id",order.id);
  if (saveError) throw new Error("e-Fatura gönderimi başlatıldı fakat takip kaydı güncellenemedi. Tekrar göndermeyin.");
  return NextResponse.json({success:true,issued:true,refundId:order.purchase_refund_id,refundUrl:`https://app.parasut.com/${company}/sales_invoices/${order.purchase_refund_id}`});
}
export async function POST(req: NextRequest) {
  try {
    const denied = await authorizeWhatsApp(req, invoiceAdmin()); if (denied) return denied;
    const body = await req.json();
    const {db,order,bill,headers,company,sourceLines} = await context(String(body.orderId || ""));
    if (body.issue === true) return await issueDifference(order, bill, db, headers, company, body);
    if (order.purchase_refund_id && order.purchase_refund_state !== "verified") throw new Error("Önceki iade kaydı kontrol bekliyor. Paraşüt üzerinde kontrol edin; tekrar oluşturulmaz.");
    if (order.purchase_refund_id) return NextResponse.json({success:true,refundId:order.purchase_refund_id,refundUrl:`https://app.parasut.com/${company}/sales_invoices/${order.purchase_refund_id}`,reused:true});
    const sourceLine = sourceLines.find(line => line.id === String(body.sourceLineId || ""));
    if (body.confirm !== true || !sourceLine || Number(body.amount)!==Number(order.purchase_difference_amount) || body.vatRate !== sourceLine.vatRate || (body.exemptionCode || null) !== sourceLine.exemptionCode) throw new Error("Kaynak ürün, KDV oranı veya istisna kodu değişti. Önizlemeyi yenileyip onaylayın.");
    const returnType = body.returnType;
    if (!["price","product"].includes(returnType)) throw new Error("Fiyat farkı veya ürün iadesini seçin.");
    const quantity = returnType === "product" ? Number(body.quantity) : 1;
    const productId = returnType === "product" ? String(sourceLine.productId || "") : await priceDifferenceProduct(headers,company,sourceLine.vatRate);
    const payload = refundPayload(order,bill,sourceLine,productId,new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),returnType,quantity);
    const {error:reserveError} = await db.rpc("reserve_purchase_difference_refund",{p_order_id:order.id,p_amount:Number(body.amount)});
    if (reserveError) throw new Error(reserveError.message);
    // An ambiguous external POST must never be retried automatically.
    const response = await fetch(`${base}/v4/${company}/sales_invoices`,{method:"POST",headers,body:JSON.stringify(payload),cache:"no-store"});
    const created = await response.json().catch(()=>null);
    const refundId = created?.data?.id;
    if (!response.ok && [400,401,403,404,422].includes(response.status)) {
      const message = upstreamRefundError(created);
      const {error:resetError} = await db.from("siparisler").update({purchase_refund_state:"pending"}).eq("id",order.id).eq("purchase_refund_state","creating");
      if (resetError) throw new Error(`${message} İşlem durumu güncellenemedi; tekrar denemeden kayıtları kontrol edin.`);
      throw new Error(message);
    }
    if (!response.ok || !refundId) throw new Error("İade işlemi kontrol bekliyor. Paraşüt satış faturalarını kontrol edin; tekrar iade oluşturulmadı.");
    const {error:saveError} = await db.from("siparisler").update({purchase_refund_id:String(refundId),purchase_refund_state:"created",purchase_refund_at:new Date().toISOString(),purchase_refund_source:{...sourceLine,returnType,quantity,refundProductId:productId,invoiceUnitPrice:payload.data.relationships.details.data[0].attributes.unit_price},purchase_refund_issue_state:"pending"}).eq("id",order.id);
    if (saveError) throw new Error("Paraşüt iade kaydı oluştu ancak satışa kaydedilemedi. Tekrar oluşturmayın; Paraşüt üzerinde kontrol edin.");
    const verify = await fetch(`${base}/v4/${company}/sales_invoices/${refundId}?include=contact,details,details.product`,{headers,cache:"no-store"});
    const verified = await verify.json().catch(()=>null);
    if (!verify.ok || String(verified?.data?.relationships?.contact?.data?.id || "") !== String(bill.supplier_id) || Math.abs(Number(verified?.data?.attributes?.total_vat)-payload.data.attributes.total_vat)>.01 || verified?.data?.attributes?.item_type!=="invoice" || (!Number.isFinite(Number(verified?.data?.attributes?.net_total)) || Math.abs(Number(verified?.data?.attributes?.net_total)-Number(body.amount))>.01)) throw new Error("Fiyat farkı satış faturası oluştu fakat tutarı doğrulanamadı. Paraşüt üzerinde kontrol edin.");
    const {error:verifiedError} = await db.from("siparisler").update({purchase_refund_state:"verified"}).eq("id",order.id);
    if (verifiedError) throw new Error("İade oluştu; takip durumu güncellenemedi. Tekrar oluşturmayın.");
    return NextResponse.json({success:true,refundId:String(refundId),refundUrl:`https://app.parasut.com/${company}/sales_invoices/${refundId}`,amount:Number(body.amount),sourceLine});
  } catch (error) {return NextResponse.json({success:false,error:error instanceof Error ? error.message : "İade oluşturulamadı."},{status:409});}
}
