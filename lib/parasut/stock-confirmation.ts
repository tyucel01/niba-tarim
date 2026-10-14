import { createHmac, timingSafeEqual } from "node:crypto";
const lifetime = 15 * 60 * 1000;
function sign(value: unknown, expires: number, secret: string) {
  if (!secret) throw new Error("Stok dönüşümü onay anahtarı bulunamadı.");
  return createHmac("sha256", secret).update(JSON.stringify({ expires, value })).digest("hex");
}
export function stockConfirmation(value: unknown, secret: string, now = Date.now()) {
  const expires = now + lifetime;
  return `${expires}.${sign(value, expires, secret)}`;
}
export function checkStockConfirmation(token: unknown, value: unknown, secret: string, now = Date.now()) {
  const [expiry, signature] = String(token ?? "").split(".");
  const expires = Number(expiry);
  if (!Number.isFinite(expires) || expires <= now || expires > now + lifetime || !/^[a-f0-9]{64}$/.test(signature || "")) return false;
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(value, expires, secret), "hex"));
}
