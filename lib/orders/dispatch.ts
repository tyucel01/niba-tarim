const fields = ["gts", "sevkDurumu", "plaka", "teslimOlanTonaj", "sevkYeri", "sevkNo"];

export function dispatchPatch(input: unknown): Record<string, string | number> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Sevk bilgileri geçersiz.");
  const entries = Object.entries(input);
  if (!entries.length || entries.some(([key]) => !fields.includes(key))) throw new Error("Bu alan güncellenemez.");
  const patch: Record<string, string | number> = {};
  for (const [key, value] of entries) {
    if (key === "teslimOlanTonaj") {
      if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") throw new Error("Teslim tonajı geçersiz.");
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) throw new Error("Teslim tonajı sıfır veya daha büyük olmalı.");
      patch[key] = number;
    } else {
      if (typeof value !== "string" || value.length > 250) throw new Error("Sevk bilgisi geçersiz.");
      patch[key] = value.trim();
    }
  }
  return patch;
}
