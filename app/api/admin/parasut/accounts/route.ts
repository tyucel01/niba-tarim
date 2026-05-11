import { NextResponse } from "next/server";

const BASE_URL = "https://api.parasut.com";

async function getParasutToken() {
  const response = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "password",
      client_id: process.env.PARASUT_CLIENT_ID,
      client_secret: process.env.PARASUT_CLIENT_SECRET,
      username: process.env.PARASUT_USERNAME,
      password: process.env.PARASUT_PASSWORD,
      redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
    }),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.access_token as string;
}

export async function GET() {
  try {
    const companyId = process.env.PARASUT_COMPANY_ID;

    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: "PARASUT_COMPANY_ID eksik" },
        { status: 500 }
      );
    }

    const token = await getParasutToken();

    const response = await fetch(
      `${BASE_URL}/v4/${companyId}/accounts?page[size]=25`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const json = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: "Paraşüt hesapları alınamadı", detail: json },
        { status: response.status }
      );
    }

    const accounts = (json?.data || []).map((item: any) => ({
      id: item.id,
      type: item.type,
      name: item?.attributes?.name,
      account_type: item?.attributes?.account_type,
      currency: item?.attributes?.currency,
      balance: item?.attributes?.balance,
      raw: item,
    }));

    return NextResponse.json({ ok: true, count: accounts.length, accounts });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Hesaplar alınırken hata oluştu",
        detail: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}