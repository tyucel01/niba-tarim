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
    const q = searchParams.get("q") || "";

    const token = await getAccessToken();

    const url = `${BASE_URL}/v4/${companyId}/products?page[size]=25${
      q ? `&filter[name]=${encodeURIComponent(q)}` : ""
    }`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data },
        { status: res.status }
      );
    }

    const items = (data.data || []).map((item: any) => ({
      id: item.id,
      type: item.type,
      name: item.attributes?.name || "",
      code: item.attributes?.code || "",
      raw: item,
    }));

    return NextResponse.json({ success: true, items, raw: data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}