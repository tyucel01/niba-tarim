import { NextResponse } from "next/server";

const BASE_URL = "https://api.parasut.com";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getParasutToken() {
  await sleep(1000);

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

async function fetchWithRetry(url: string, token: string) {
  let lastJson: any = null;
  let lastStatus = 500;

  for (let attempt = 1; attempt <= 8; attempt++) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    lastStatus = response.status;
    lastJson = await response.json();

    const isRateLimited =
      response.status === 429 ||
      JSON.stringify(lastJson).toLowerCase().includes("too many requests");

    if (!isRateLimited) {
      return { response, json: lastJson };
    }

    await sleep(2000 * attempt);
  }

  return {
    response: { ok: false, status: lastStatus } as Response,
    json: lastJson,
  };
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

    const allContacts: any[] = [];
    const maxPages = 20;

    for (let page = 1; page <= maxPages; page++) {
      await sleep(1500);

      const { response, json } = await fetchWithRetry(
        `${BASE_URL}/v4/${companyId}/contacts?page[size]=25&page[number]=${page}`,
        token
      );

      if (!response.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: "Paraşüt carileri alınamadı",
            page,
            detail: json,
          },
          { status: response.status || 500 }
        );
      }

      const pageData = json?.data || [];
      allContacts.push(...pageData);

      if (pageData.length < 25) break;
    }

    const contacts = allContacts.map((item: any) => ({
      id: item.id,
      name: item?.attributes?.name || "İsimsiz Cari",
      email: item?.attributes?.email || "",
      phone: item?.attributes?.phone || "",
      taxNumber: item?.attributes?.tax_number || "",
      city: item?.attributes?.city || "",
    }));

    return NextResponse.json({
      ok: true,
      count: contacts.length,
      contacts,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Paraşüt carileri alınırken hata oluştu",
        detail: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}