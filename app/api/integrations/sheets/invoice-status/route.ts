import { verifiedLegacyInvoices } from "@/lib/parasut/legacy-invoice-status";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validSecret } from "@/lib/orders/sheets";
import { sheetInvoiceStatus } from "@/lib/orders/sheet-invoice-status";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const expected = process.env.SHEETS_SYNC_SECRET || "";
  const source = process.env.SHEETS_SYNC_SOURCE_ID || "";
  if (expected.length < 32 || !source) return reply({ success: false, error: "Aktarım henüz yapılandırılmadı." }, 503);
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1] || "";
  if (!validSecret(token, expected)) return reply({ success: false, error: "Yetkisiz aktarım." }, 401);
  if (!request.headers.get("content-type")?.includes("application/json")) return reply({ success: false, error: "JSON gerekli." }, 415);
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ success: false, error: "Boş istek." }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 32000) { await reader.cancel(); return reply({ success: false, error: "İstek çok büyük." }, 413); } chunks.push(value); }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (body.sourceId !== source) return reply({ success: false, error: "Kaynak eşleşmiyor." }, 403);
    if (!Array.isArray(body.satisIds) || !body.satisIds.length || body.satisIds.length > 100 || body.satisIds.some((id: unknown) => typeof id !== "string" || !id.trim() || id.length > 100)) return reply({ success: false, error: "1–100 satış ID gerekli." }, 422);
    const ids: string[] = body.satisIds.map((id: string) => id.trim());
    if (new Set(ids).size !== ids.length) return reply({ success: false, error: "Tekrarlanan satış ID." }, 422);
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.from("siparisler").select("satisId,teslimOlanTonaj,sales_invoice_history").in("satisId", ids);
    if (error) return reply({ success: false, error: "Fatura durumları okunamadı." }, 503);
    let verifiedLegacyIds: Set<string>;
    try { verifiedLegacyIds = await verifiedLegacyInvoices(data || []); }
    catch { return reply({ success: false, error: "Eski faturalar Paraşüt'ten doğrulanamadı. Sonraki aktarımda yeniden denenecek; Sheet'e yazılmadı." }, 503); }
    const statuses = ids.map(satisId => {
      const rows = (data || []).filter(row => row.satisId === satisId);
      return { satisId, status: rows.length === 1 ? sheetInvoiceStatus(rows[0], verifiedLegacyIds) : null, reason: rows.length > 1 ? "duplicate" : rows.length === 0 ? "missing" : "" };
    });
    return reply({ success: true, statuses });
  } catch { return reply({ success: false, error: "İstek okunamadı." }, 400); }
}
