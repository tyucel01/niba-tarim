export const PRICE_HANDOFF_KEY = "niba-whatsapp-price-image";
export type PriceHandoff = { dataUrl: string; name: string; createdAt: number };
export function parsePriceHandoff(raw: string | null): PriceHandoff | null {
  try {
    const value = JSON.parse(raw || "null");
    if (!value || typeof value.dataUrl !== "string" || typeof value.name !== "string" || typeof value.createdAt !== "number") return null;
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value.dataUrl) || value.dataUrl.length > 4200000) return null;
    if (Date.now() - value.createdAt > 30 * 60 * 1000 || value.createdAt > Date.now() + 60000) return null;
    return { dataUrl: value.dataUrl, name: value.name.slice(0,160), createdAt: value.createdAt };
  } catch { return null; }
}
export function handoffFile(draft: PriceHandoff): File {
  const bytes = Uint8Array.from(atob(draft.dataUrl.split(',')[1]), c => c.charCodeAt(0));
  return new File([bytes], draft.name, { type: 'image/jpeg' });
}
