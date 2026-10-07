import { createHash, timingSafeEqual } from "node:crypto";

export const textFields = ["bayi", "tedarikciler", "siparisAlan", "urun", "marka", "satisTuru", "vadeSuresi", "not", "plaka", "sevkYeri", "sevkDurumu", "sevkNo", "gts"] as const;
export const numberFields = ["alisFiyati", "pesinSatisFiyati", "siparisTonaj", "teslimOlanTonaj", "vadeFarki", "nakliye"] as const;
const dateFields = ["satisTarihi", "vadeTarihi"];
export type SheetValues = Record<string, string | number>;

export function validSecret(provided: string, expected: string) {
  if (expected.length < 32 || !provided || provided.length > 512) return false;
  return timingSafeEqual(createHash("sha256").update(provided).digest(), createHash("sha256").update(expected).digest());
}
export function parseNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e12) return value;
  if (typeof value !== "string") throw new Error("Sayı biçimi geçersiz.");
  let str = value.trim().replace(/\s|₺|TL/gi, "");
  // Strings follow the existing Turkish Excel format; Apps Script sends actual numeric cells as numbers.
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) str = str.replace(/\./g, "");
  else if (!/^\d+(?:[.,]\d+)?$/.test(str)) throw new Error("Sayı biçimi geçersiz.");
  const n = Number(str.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1e12) throw new Error("Sayı aralık dışında.");
  return n;
}
export function validateValues(input: unknown): SheetValues {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Satır biçimi geçersiz.");
  const out: SheetValues = {};
  for (const [key, value] of Object.entries(input)) {
    if (!["satisId", ...textFields, ...numberFields, ...dateFields].includes(key)) throw new Error("İzin verilmeyen sütun.");
    if (value === "" || value === null || value === undefined) continue; // Blank cells never erase saved data.
    if ((numberFields as readonly string[]).includes(key)) out[key] = parseNumber(value);
    else {
      if (typeof value !== "string" || value.length > (key === "not" ? 2000 : 250)) throw new Error("Metin biçimi geçersiz.");
      const text = value.trim();
      if (!text) continue;
      if (dateFields.includes(key) && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0,10) !== text)) throw new Error("Tarih YYYY-MM-DD biçiminde olmalı.");
      out[key] = text;
    }
  }
  if (typeof out.satisId !== "string" || !out.satisId || out.satisId.length > 100) throw new Error("Satış ID zorunlu ve değişmez olmalı.");
  if (out.sevkDurumu && !["Bekliyor", "Kısmi Sevk", "Sevk Edildi", "Tamamlandı", "İptal"].includes(String(out.sevkDurumu))) throw new Error("Sevk durumu tanınmıyor.");
  if (typeof out.gts === "string") {
    const gtsKey = out.gts.normalize("NFKC").toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]/g, "");
    if (/e+[vw]+e*[td]+/.test(gtsKey)) out.gts = "Girildi";
  }
  if (out.gts && !["Yok", "Bekliyor", "Girildi"].includes(String(out.gts))) throw new Error("GTS durumu tanınmıyor.");
  return out;
}
