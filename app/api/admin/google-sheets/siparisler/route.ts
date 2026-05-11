import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
    const secret = process.env.GOOGLE_SHEET_WEBHOOK_SECRET;
    const sheet = process.env.GOOGLE_SHEET_NAME || "";

    if (!url || !secret) {
      return NextResponse.json(
        { success: false, error: "Google Sheet env bilgileri eksik." },
        { status: 500 },
      );
    }

    const fullUrl =
      `${url}?secret=${encodeURIComponent(secret)}` +
      (sheet ? `&sheet=${encodeURIComponent(sheet)}` : "");

    const res = await fetch(fullUrl, {
      cache: "no-store",
    });

    const data = await res.json();

    if (!data.success) {
      return NextResponse.json(
        { success: false, error: data.error || data },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      rows: data.rows || [],
      count: data.count || 0,
      raw: data,
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