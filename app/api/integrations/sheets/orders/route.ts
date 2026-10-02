import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validSecret, validateValues } from "@/lib/orders/sheets";

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
    // Enforce a streaming bound even when Content-Length is absent.
    const reader = request.body?.getReader();
    if (!reader) return reply({ success: false, error: "Boş istek." }, 400);
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 256_000) { await reader.cancel(); return reply({ success: false, error: "En fazla 256 KB." }, 413); } chunks.push(value); }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (body.sourceId !== source) return reply({ success: false, error: "Kaynak eşleşmiyor." }, 403);
    if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 100 || typeof body.dryRun !== "boolean") return reply({ success: false, error: "1–100 satır ve dryRun gerekli." }, 400);
    const timestamp = Date.parse(body.snapshotAt);
    if (!Number.isFinite(timestamp) || timestamp > Date.now() + 60_000 || timestamp < Date.now() - 15 * 60_000) return reply({ success: false, error: "Aktarım zamanı geçersiz veya eski. Yeni aktarım başlatın." }, 400);
    if (!body.dryRun && process.env.SHEETS_SYNC_ENABLED !== "true") return reply({ success: false, error: "Yazma kapalı; önce deneme aktarımı yapın." }, 409);
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const keys = new Set<string>();
    // Reject duplicate IDs in the complete batch before any mutation.
    for (const row of body.rows) { const key = String(row?.values?.satisId || "").trim(); if (key && keys.has(key)) return reply({ success: false, error: "Tekrarlanan Satış ID; hiçbir satır işlenmedi." }, 400); keys.add(key); }
    const results = [];
    for (const [index, row] of body.rows.entries()) {
      const rowNumber = Number.isInteger(row?.rowNumber) && row.rowNumber > 0 ? row.rowNumber : index + 2;
      try {
        const values = validateValues(row?.values);
        const { data, error } = await admin.rpc("sync_order_from_sheet", { p_source: source, p_key: values.satisId, p_values: values, p_snapshot: new Date(timestamp).toISOString(), p_dry_run: body.dryRun });
        if (error) return reply({ success: false, error: "Veritabanı aktarımı tamamlanamadı. Önceki satırlar işlenmiş olabilir; aynı aktarımı güvenle tekrar deneyin.", results }, 503);
        results.push({ rowNumber, ...data });
      } catch (error) { results.push({ rowNumber, status: "invalid", message: error instanceof Error ? error.message : "Satır geçersiz." }); }
    }
    return reply({ success: true, dryRun: body.dryRun, results });
  } catch { return reply({ success: false, error: "Aktarım okunamadı." }, 400); }
}
