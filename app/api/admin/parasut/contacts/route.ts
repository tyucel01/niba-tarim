import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL = "https://api.parasut.com";

let cachedContacts: any[] | null = null;
let cachedAt = 0;
const CACHE_MS = 15 * 60 * 1000;

async function getParasutToken() {
  const response = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error_description || data?.error || "Paraşüt token alınamadı"
    );
  }

  return data.access_token as string;
}

function mapContact(item: any) {
  const attr = item?.attributes || {};

  return {
    id: item.id,
    name: attr.name || "İsimsiz Cari",
    display_name: attr.name || "İsimsiz Cari",
    email: attr.email || "",
    phone: attr.phone || "",
    taxNumber: attr.tax_number || "",
    tax_number: attr.tax_number || "",
    tax_no: attr.tax_number || "",
    vkn: attr.tax_number || "",
    tckn: attr.tax_number || "",
    city: attr.city || "",
    district: attr.district || "",
    address: attr.address || "",
    attributes: attr,
    raw: item,
  };
}

export async function GET(req: Request) {
  try {
    const companyId = process.env.PARASUT_COMPANY_ID;

    if (!companyId) {
      return NextResponse.json(
        { success: false, ok: false, error: "PARASUT_COMPANY_ID eksik" },
        { status: 500 }
      );
    }

    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";

    if (
      !refresh &&
      cachedContacts &&
      Date.now() - cachedAt < CACHE_MS
    ) {
      return NextResponse.json({
        success: true,
        ok: true,
        cached: true,
        contacts: cachedContacts,
        items: cachedContacts,
        data: cachedContacts,
        count: cachedContacts.length,
      });
    }

    const token = await getParasutToken();

    const allContacts: any[] = [];
    const pageSize = 25;
    const maxPages = 20;

    for (let page = 1; page <= maxPages; page++) {
      const response = await fetch(
        `${BASE_URL}/v4/${companyId}/contacts?page[number]=${page}&page[size]=${pageSize}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 429 && cachedContacts) {
          return NextResponse.json({
            success: true,
            ok: true,
            cached: true,
            stale: true,
            warning: "Paraşüt rate limit verdi, eski cache döndürüldü.",
            contacts: cachedContacts,
            items: cachedContacts,
            data: cachedContacts,
            count: cachedContacts.length,
          });
        }

        return NextResponse.json(
          {
            success: false,
            ok: false,
            error: "Paraşüt carileri alınamadı",
            page,
            detail: json,
          },
          { status: response.status }
        );
      }

      const rows = json?.data || [];
      allContacts.push(...rows.map(mapContact));

      if (rows.length < pageSize) break;

      await new Promise((r) => setTimeout(r, 250));
    }

    cachedContacts = allContacts;
    cachedAt = Date.now();

    return NextResponse.json({
      success: true,
      ok: true,
      cached: false,
      contacts: allContacts,
      items: allContacts,
      data: allContacts,
      count: allContacts.length,
    });
  } catch (error: any) {
    if (cachedContacts) {
      return NextResponse.json({
        success: true,
        ok: true,
        cached: true,
        stale: true,
        warning: error?.message || "Hata oldu, eski cache döndürüldü.",
        contacts: cachedContacts,
        items: cachedContacts,
        data: cachedContacts,
        count: cachedContacts.length,
      });
    }

    return NextResponse.json(
      {
        success: false,
        ok: false,
        error: error?.message || "Bilinmeyen hata",
      },
      { status: 500 }
    );
  }
}