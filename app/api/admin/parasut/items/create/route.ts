import { NextRequest, NextResponse } from "next/server";

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

function toNumber(value: any) {
  const n = Number(String(value || "0").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: NextRequest) {
  try {
    const companyId = process.env.PARASUT_COMPANY_ID;
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "PARASUT_COMPANY_ID eksik." },
        { status: 500 }
      );
    }

    const body = await req.json();

    const name = String(body?.name || "").trim();
    const vatRate = toNumber(body?.vatRate || 20);

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Ürün adı zorunlu." },
        { status: 400 }
      );
    }

    const token = await getAccessToken();

    const payload = {
      data: {
        type: "products",
        attributes: {
          name,
          code: body?.code || "",
          vat_rate: vatRate,
          unit: body?.unit || "ton",
          archived: false,
        },
      },
    };

    const res = await fetch(`${BASE_URL}/v4/${companyId}/products`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data, sentPayload: payload },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      item: {
        id: data.data?.id,
        name: data.data?.attributes?.name,
        raw: data.data,
      },
      raw: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}