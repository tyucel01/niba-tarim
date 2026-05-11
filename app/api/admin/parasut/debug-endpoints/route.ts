import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE_URL = "https://api.parasut.com";

const endpoints = [
  "e_invoice_inboxes",
  "e_invoice_inboxes?page[size]=5",
  "purchase_bills?page[size]=5",
  "purchase_bills?page[size]=5&include=supplier",
  "purchase_bills?page[size]=5&include=supplier,details",
  "purchase_bills?page[size]=5&include=active_e_document",
  "sales_invoices?page[size]=5",
  "sales_invoices?page[size]=5&include=active_e_document",
  "e_invoices?page[size]=5",
  "e_archives?page[size]=5",
  "trackable_jobs?page[size]=5",
];

async function getAccessToken() {
  const body = new URLSearchParams();

  body.append("grant_type", "password");
  body.append("client_id", process.env.PARASUT_CLIENT_ID || "");
  body.append("client_secret", process.env.PARASUT_CLIENT_SECRET || "");
  body.append("username", process.env.PARASUT_USERNAME || "");
  body.append("password", process.env.PARASUT_PASSWORD || "");

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.access_token as string;
}

function summarize(data: any) {
  const first = Array.isArray(data?.data) ? data.data[0] : data?.data;

  return {
    count: Array.isArray(data?.data) ? data.data.length : data?.data ? 1 : 0,
    meta: data?.meta || null,
    links: data?.links || null,
    included_count: Array.isArray(data?.included) ? data.included.length : 0,
    first_item: first
      ? {
          id: first.id,
          type: first.type,
          attributes: first.attributes,
          relationships: first.relationships,
        }
      : null,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const secret = searchParams.get("secret");

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const companyId = process.env.PARASUT_COMPANY_ID;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "PARASUT_COMPANY_ID eksik." },
        { status: 500 },
      );
    }

    const token = await getAccessToken();

    const results = [];

    for (const endpoint of endpoints) {
      const url = `${BASE_URL}/v4/${companyId}/${endpoint}`;

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const text = await res.text();

        let data: any = null;

        try {
          data = JSON.parse(text);
        } catch {
          data = { rawText: text.slice(0, 500) };
        }

        results.push({
          endpoint,
          ok: res.ok,
          status: res.status,
          summary: res.ok ? summarize(data) : null,
          error: res.ok ? null : data,
        });
      } catch (err) {
        results.push({
          endpoint,
          ok: false,
          status: "FETCH_ERROR",
          summary: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      checked_at: new Date().toISOString(),
      results,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}