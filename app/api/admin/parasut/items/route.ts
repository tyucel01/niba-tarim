import { cachedStockSearch } from "@/lib/parasut/stock-search";
import { manualStockSearchTerms, stockMatchNote, stockMatchScore } from "@/lib/parasut/stock-suggestions";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE_URL = "https://api.parasut.com";

async function getAccessToken() {
  const body = new URLSearchParams();

  body.append("grant_type", "password");
  body.append("client_id", process.env.PARASUT_CLIENT_ID || "");
  body.append("client_secret", process.env.PARASUT_CLIENT_SECRET || "");
  body.append("username", process.env.PARASUT_USERNAME || "");
  body.append("password", process.env.PARASUT_PASSWORD || "");

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) throw new Error(JSON.stringify(data));

  return data.access_token as string;
}

export async function GET(req: Request) {
  try {
    const companyId = process.env.PARASUT_COMPANY_ID;
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "PARASUT_COMPANY_ID eksik." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const sourceName = (searchParams.get("sourceName") || "").trim();
    if (q.length < 2 || q.length > 250 || sourceName.length > 250) return NextResponse.json({ success: false, error: "Ürün adından en az iki karakter yazın." }, { status: 422 });
    let access: Promise<string> | undefined;
    const token = () => access ||= getAccessToken();
    const products = new Map<string, any>();
    const get = async (path: string) => {
      const response = await fetch(`${BASE_URL}/v4/${companyId}${path}`, { headers: { Authorization: `Bearer ${await token()}`, Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 429 ? "Stok servisi yoğun. Biraz sonra tekrar deneyin." : "Stok ürünleri alınamadı.");
      return response.json();
    };
    for (const term of manualStockSearchTerms(q, sourceName)) {
      const matches = await cachedStockSearch(companyId, term, get);
      for (const product of matches) if (!product.attributes?.archived) products.set(String(product.id), product);
      if (products.size) break;
    }
    const items = [...products.values()].map((item: any) => ({
      id: item.id,
      type: item.type,
      name: item.attributes?.name || "",
      code: item.attributes?.code || "",
      unit: item.attributes?.unit || "",
      inventoryTracking: Boolean(item.attributes?.inventory_tracking),
      matchNote: sourceName ? stockMatchNote(sourceName, item.attributes?.name) : "",
      score: sourceName ? stockMatchScore(sourceName, item.attributes?.name) : undefined,
      raw: item,
    }));

    items.sort((a, b) => (b.score || 0) - (a.score || 0));
    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}