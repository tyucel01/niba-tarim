import { salesProgress } from "./sales-progress";

export type OrderRow = Record<string, unknown>;
export type OrderStage = "sevk" | "fatura" | "partial" | "done" | "cancelled";

// Workflow labels do not change the existing Paraşüt invoice eligibility rules.
export function orderStage(order: OrderRow): OrderStage {
  const dispatch = String(order.sevkDurumu || "").toLocaleLowerCase("tr-TR");
  if (dispatch.includes("iptal")) return "cancelled";
  const progress = salesProgress(order);
  if (progress.complete) return "done";
  if (progress.billedTons > 0) return "partial";
  const sent = ["evet", "sevk edildi", "tamam", "yapildi", "yapıldı"].some((s) => dispatch.includes(s));
  return sent && String(order.plaka || "").trim() ? "fatura" : "sevk";
}

export const stageLabels: Record<OrderStage, string> = {
  sevk: "Sevk bekliyor", fatura: "Fatura bekliyor", partial: "Kısmi faturalandı", done: "Faturalandı", cancelled: "İptal",
};

export const depots = ["Mersin", "Hatay", "İskenderun", "Marmara", "Ege", "Akdeniz", "Karadeniz", "Samsun", "Tüm Bölgeler"];
