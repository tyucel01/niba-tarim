import { createHash } from "node:crypto";

export type PosStatus = "creating" | "ready" | "pending" | "paid" | "failed" | "review";
export type PosPayment = {
  id: string; merchant_payment_id: string; merchant: string; mode: "test" | "live";
  amount_minor: number; currency: "TRY"; customer_id: string; customer_name: string;
  customer_email: string; description: string; status: PosStatus; session_token?: string | null;
  pg_transaction_id?: string | null; created_at: string; expires_at: string;
  last_checked_at?: string | null; paid_date?: string | null; parasut_state: string; parasut_transaction_id?: string | null;
};
export function toMinor(value: unknown): number {
  const text = String(value ?? "").trim();
  if (!/^\d{1,10}(?:[.,]\d{1,2})?$/.test(text)) throw new Error("Tutarı en fazla iki ondalık basamakla girin.");
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 100_000_000_000) throw new Error("Tahsilat tutarı geçersiz.");
  return minor;
}
export function money(minor: number) { return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2,"0")}`; }
export function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function posConfig(env = process.env) {
  const mode = env.PARATIKA_MODE === "live" ? "live" : "test";
  if (env.PARATIKA_MODE && !["live","test"].includes(env.PARATIKA_MODE)) throw new Error("PARATIKA_MODE test veya live olmalı.");
  const merchant = env.PARATIKA_MERCHANT || "";
  const user = env.PARATIKA_MERCHANT_USER || "", password = env.PARATIKA_MERCHANT_PASSWORD || "";
  const origin = env.PARATIKA_PUBLIC_ORIGIN || "https://www.nibatarim.com";
  const parsed = new URL(origin);
  if (parsed.protocol !== "https:" || parsed.origin !== origin || parsed.username || parsed.password) throw new Error("PARATIKA_PUBLIC_ORIGIN yalnızca HTTPS site adresi olmalı.");
  const host = mode === "live" ? "https://vpos.paratika.com.tr" : "https://entegrasyon.paratika.com.tr";
  return {mode, merchant, user, password, origin, host, api: `${host}/paratika/api/v2`,
    configured: Boolean(merchant && user && password),
    enabled: env.PARATIKA_ENABLED === "true" && (mode !== "live" || env.PARATIKA_LIVE_ENABLED === "true"),
  };
}
export function checkoutUrl(payment: Pick<PosPayment,"mode"|"session_token">) {
  if (!payment.session_token || !/^[A-Za-z0-9]{20,64}$/.test(payment.session_token)) throw new Error("Ödeme oturumu doğrulanamadı.");
  return `${payment.mode === "live" ? "https://vpos.paratika.com.tr" : "https://entegrasyon.paratika.com.tr"}/payment/${payment.session_token}`;
}
export async function posRequest(action: "SESSIONTOKEN" | "QUERYTRANSACTION", params: Record<string,string>, request = fetch) {
  const config = posConfig();
  if (!config.configured) throw new Error("Paratika API kullanıcı ayarları eksik.");
  if (action === "SESSIONTOKEN" && !config.enabled) throw new Error("Sanal POS tahsilatı henüz etkinleştirilmedi.");
  let response: Response;
  try {
    response = await request(config.api, {method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body: new URLSearchParams({...params,ACTION:action,MERCHANT:config.merchant,MERCHANTUSER:config.user,MERCHANTPASSWORD:config.password}),
      cache:"no-store", redirect:"error", signal:AbortSignal.timeout(20000)});
  } catch { throw new Error("Paratika yanıtı alınamadı; sonuç sorgulanmadan yeniden tahsilat başlatmayın."); }
  let data;
  try { data = await response.json(); } catch { throw new Error("Paratika yanıtı doğrulanamadı; işlem kontrol bekliyor."); }
  if (!response.ok || !data || typeof data !== "object") throw new Error("Paratika servisi geçici olarak yanıt vermiyor.");
  return data;
}
export function sessionParams(payment: PosPayment, callbackState: string, origin: string) {
  return {SESSIONTYPE:"PAYMENTSESSION",SESSIONEXPIRY:"1h",LANGUAGE:"tr",MERCHANTPAYMENTID:payment.merchant_payment_id,
    AMOUNT:money(Number(payment.amount_minor)),CURRENCY:"TRY",CUSTOMER:payment.customer_id,CUSTOMERNAME:payment.customer_name,
    CUSTOMEREMAIL:payment.customer_email,RETURNURL:`${origin}/api/payments/paratika/callback?state=${encodeURIComponent(callbackState)}`,
    ORDERITEMS:JSON.stringify([{productCode:payment.merchant_payment_id,name:"Niba Tarım Tahsilatı",quantity:1,amount:Number(payment.amount_minor)/100}]),
  };
}
export type VerifiedResult = {status: "pending"|"paid"|"failed"|"review"; transactionId?: string; paidDate?: string; reason: string};
// QUERYTRANSACTION must be requested with this payment ID; callbacks are never payment evidence.
export function verifyQuery(payment: PosPayment, data: any): VerifiedResult {
  if (data?.responseCode !== "00" || !Array.isArray(data.transactionList)) return {status:"pending",reason:"İşlem henüz doğrulanamadı."};
  const list = data.transactionList;
  const count = Number(data.totalTransactionCount ?? list.length);
  if (!Number.isFinite(count) || count !== list.length) return {status:"review",reason:"İşlem listesi eksik; kontrol gerekiyor."};
  const sales = list.filter((t: any) => t.transactionType === "SALE");
  const approved = sales.filter((t: any) => t.transactionStatus === "AP");
  if (approved.length > 1) return {status:"review",reason:"Birden fazla onaylı satış var; kontrol gerekiyor."};
  if (approved.length === 1) {
    const t = approved[0];let minor;
    try {minor = toMinor(t.amount);} catch {return {status:"review",reason:"İşlem tutarı doğrulanamadı."};}
    // The documented response identifies the merchant payment via pgOrderId.
    const reference = t.merchantPaymentId ?? t.pgOrderId;
    if (![payment.merchant_payment_id,`${payment.merchant}-${payment.merchant_payment_id}`].includes(reference)
      || t.customerId !== payment.customer_id || t.currency !== payment.currency || minor !== Number(payment.amount_minor)
      || typeof t.pgTranId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(t.pgTranId)) return {status:"review",reason:"Ödeme referansı, müşteri, para birimi veya tutar uyuşmuyor."};
    // A refund/void may change the financial meaning of an earlier sale.
    if (list.some((x: any) => ["VOID","REFUND","PTREFUND","CREDIT"].includes(x.transactionType) && x.transactionStatus === "AP")) return {status:"review",reason:"İade veya iptal işlemi var; kontrol gerekiyor."};
    const paidDate = typeof t.timeCreated === "string" ? t.timeCreated.slice(0,10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate) || !Number.isFinite(Date.parse(paidDate)) || new Date(paidDate).toISOString().slice(0,10)!==paidDate) return {status:"review",reason:"Banka işlem tarihi doğrulanamadı."};
    return {status:"paid",transactionId:t.pgTranId,paidDate,reason:"Paratika üzerinden tahsilat doğrulandı."};
  }
  if (sales.length && sales.every((t: any) => ["FA","CA","VD"].includes(t.transactionStatus))) return {status:"failed",reason:"Onaylanmış tahsilat bulunmuyor."};
  return {status:"pending",reason:"Ödeme sonucu bekleniyor; yeniden tahsilat başlatmayın."};
}
export function queryDate(value: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Istanbul",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(value).map(x=>[x.type,x.value]));
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}
