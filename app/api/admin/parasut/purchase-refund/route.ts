import { authorizeWhatsApp } from "@/lib/whatsapp/admin";
import { NextRequest, NextResponse } from "next/server";
import { invoiceAdmin } from "@/lib/parasut/invoice-pool";
import { refundPayload, refundVatRates } from "@/lib/parasut/purchase-refund";
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
  const response = await fetch(`${base}/v4/${company}/purchase_bills/${encodeURIComponent(bill.purchase_bill_id)}?include=details,supplier`,{headers,cache:"no-store"});
  const source = await response.json();
  const supplier = source.data?.relationships?.supplier?.data?.id;
  if (!response.ok || String(supplier || "")!==String(bill.supplier_id) || (!Number.isFinite(Number(source.data?.attributes?.net_total)) || Math.abs(Number(source.data?.attributes?.net_total)-Number(bill.total))>.01) || source.data?.attributes?.item_type !== "purchase_bill") throw new Error("Kaynak faturanın tutarı veya tedarikçisi değişmiş. Paraşüt üzerinde kontrol edin.");
  return {db,order,bill,headers,company,vatRates:refundVatRates(source)};
}
export async function GET(req: NextRequest) {
  try {
    const denied = await authorizeWhatsApp(req, invoiceAdmin()); if (denied) return denied;
    const {order,bill,vatRates,company} = await context(req.nextUrl.searchParams.get("orderId") || "");
    return NextResponse.json({success:true,amount:Number(order.purchase_difference_amount),supplierName:bill.supplier_name,invoiceNo:bill.invoice_no,vatRates,state:order.purchase_refund_state,refundId:order.purchase_refund_id,refundUrl:order.purchase_refund_id ? `https://app.parasut.com/${company}/purchase_bills/${order.purchase_refund_id}` : null});
  } catch (error) {return NextResponse.json({success:false,error:error instanceof Error ? error.message : "İade önizlemesi alınamadı."},{status:422});}
}
export async function POST(req: NextRequest) {
  try {
    const denied = await authorizeWhatsApp(req, invoiceAdmin()); if (denied) return denied;
    const body = await req.json();
    const {db,order,bill,headers,company,vatRates} = await context(String(body.orderId || ""));
    if (order.purchase_refund_id && order.purchase_refund_state !== "verified") throw new Error("Önceki iade kaydı kontrol bekliyor. Paraşüt üzerinde kontrol edin; tekrar oluşturulmaz.");
    if (order.purchase_refund_id) return NextResponse.json({success:true,refundId:order.purchase_refund_id,refundUrl:`https://app.parasut.com/${company}/purchase_bills/${order.purchase_refund_id}`,reused:true});
    if (body.confirm !== true || typeof body.vatRate !== "number" || Number(body.amount)!==Number(order.purchase_difference_amount) || !vatRates.includes(Number(body.vatRate))) throw new Error("İade tutarı ve kaynak KDV oranını kontrol ederek onaylayın.");
    const payload = refundPayload(order,bill,Number(body.vatRate),new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()));
    const {error:reserveError} = await db.rpc("reserve_purchase_difference_refund",{p_order_id:order.id,p_amount:Number(body.amount)});
    if (reserveError) throw new Error(reserveError.message);
    // An ambiguous external POST must never be retried automatically.
    const response = await fetch(`${base}/v4/${company}/purchase_bills`,{method:"POST",headers,body:JSON.stringify(payload),cache:"no-store"});
    const created = await response.json().catch(()=>null);
    const refundId = created?.data?.id;
    if (!response.ok || !refundId) throw new Error("İade işlemi kontrol bekliyor. Paraşüt alış iade kayıtlarını kontrol edin; tekrar iade oluşturulmadı.");
    const {error:saveError} = await db.from("siparisler").update({purchase_refund_id:String(refundId),purchase_refund_state:"created",purchase_refund_at:new Date().toISOString()}).eq("id",order.id);
    if (saveError) throw new Error("Paraşüt iade kaydı oluştu ancak satışa kaydedilemedi. Tekrar oluşturmayın; Paraşüt üzerinde kontrol edin.");
    const verify = await fetch(`${base}/v4/${company}/purchase_bills/${refundId}?include=supplier`,{headers,cache:"no-store"});
    const verified = await verify.json().catch(()=>null);
    if (!verify.ok || String(verified?.data?.relationships?.supplier?.data?.id || "") !== String(bill.supplier_id) || Math.abs(Number(verified?.data?.attributes?.total_vat)-payload.data.attributes.total_vat)>.01 || verified?.data?.attributes?.item_type!=="refund" || (!Number.isFinite(Number(verified?.data?.attributes?.net_total)) || Math.abs(Number(verified?.data?.attributes?.net_total)-Number(body.amount))>.01)) throw new Error("İade kaydı oluştu fakat tutarı doğrulanamadı. Paraşüt üzerinde kontrol edin.");
    const {error:verifiedError} = await db.from("siparisler").update({purchase_refund_state:"verified"}).eq("id",order.id);
    if (verifiedError) throw new Error("İade oluştu; takip durumu güncellenemedi. Tekrar oluşturmayın.");
    return NextResponse.json({success:true,refundId:String(refundId),refundUrl:`https://app.parasut.com/${company}/purchase_bills/${refundId}`,amount:Number(body.amount)});
  } catch (error) {return NextResponse.json({success:false,error:error instanceof Error ? error.message : "İade oluşturulamadı."},{status:409});}
}
