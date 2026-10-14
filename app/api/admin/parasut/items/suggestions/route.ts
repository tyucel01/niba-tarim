import { cachedStockSearch } from "@/lib/parasut/stock-search";
import { NextResponse } from "next/server";
import { authorizeWhatsApp, whatsappAdmin } from "@/lib/whatsapp/admin";
import { stockSourceKey } from "@/lib/parasut/stock-conversion";
import { rankStockCandidates, stockSearchTerms } from "@/lib/parasut/stock-suggestions";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const base = "https://api.parasut.com";
export async function POST(request: Request) {
  const admin = whatsappAdmin();
  const denied = await authorizeWhatsApp(request, admin);
  if (denied) return denied;
  try {
    const body = await request.json();
    if (typeof body.supplierId !== "string" || !body.supplierId || !Array.isArray(body.names) || !body.names.length || body.names.length > 30 || body.names.some((name: unknown) => typeof name !== "string" || !name.trim() || name.length > 250)) return NextResponse.json({ success: false, error: "Cari kart ve 1–30 ürün adı gerekli." }, { status: 422 });
    const companyId = process.env.PARASUT_COMPANY_ID;
    if (!companyId) throw new Error("Paraşüt firma bilgisi eksik.");
    const { data: invoices, error } = await admin.from("purchase_invoice_pool").select("stock_line_mappings").eq("supplier_id", body.supplierId).eq("state", "ready").order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error("Önceki stok eşleştirmeleri alınamadı.");
    const remembered = new Map<string, any>();
    for (const invoice of invoices || []) for (const line of invoice.stock_line_mappings || []) {
      const key = stockSourceKey(line.sourceName);
      if (!remembered.has(key)) remembered.set(key, line);
    }
    let access: Promise<string> | undefined;
    const token = () => access ||= (async () => {
      const response = await fetch(`${base}/oauth/token`, { method: "POST", body: new URLSearchParams({ grant_type: "password", client_id: process.env.PARASUT_CLIENT_ID || "", client_secret: process.env.PARASUT_CLIENT_SECRET || "", username: process.env.PARASUT_USERNAME || "", password: process.env.PARASUT_PASSWORD || "" }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.access_token) throw new Error("Stok önerisi servisine ulaşılamadı.");
      return data.access_token as string;
    })();
    const get = async (path: string) => {
      const response = await fetch(`${base}/v4/${companyId}${path}`, { headers: { Authorization: `Bearer ${await token()}`, Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 429 ? "Stok servisi yoğun. Biraz sonra yeniden deneyin." : "Stok önerileri alınamadı.");
      return response.json();
    };
    const search = (term: string) => cachedStockSearch(companyId, term, get);
    const resolved = new Map<string, any>();
    const suggestions = [];
    for (const name of body.names as string[]) {
      const key = stockSourceKey(name);
      if (resolved.has(key)) { suggestions.push(resolved.get(key)); continue; }
      const saved = remembered.get(key);
      let result: any;
      if (saved?.productId) {
        // Only this previously selected card is fetched, not the complete inventory.
        const product = await get(`/products/${encodeURIComponent(saved.productId)}`).catch(() => null);
        if (product?.data && !product.data.attributes?.archived && product.data.attributes?.unit) {
          const candidates = rankStockCandidates(product.data.attributes.name, [product.data]).candidates;
          result = { sourceKey: key, candidates, suggestedId: String(product.data.id), reason: "previous", sourceUnit: saved.sourceUnit, factor: saved.factor };
        }
      }
      if (!result) {
        const products: any[] = [];
        for (const term of stockSearchTerms(name)) {
          products.push(...await search(term));
          const ranked = rankStockCandidates(name, products);
          if (ranked.candidates.length) break;
        }
        result = { sourceKey: key, ...rankStockCandidates(name, products), reason: "content" };
      }
      resolved.set(key, result); suggestions.push(result);
    }
    return NextResponse.json({ success: true, suggestions });
  } catch (reason) { return NextResponse.json({ success: false, error: reason instanceof Error ? reason.message : "Stok önerileri alınamadı." }, { status: 503 }); }
}
