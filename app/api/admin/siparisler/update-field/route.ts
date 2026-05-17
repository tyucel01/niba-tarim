import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const allowedFields = [
  "gts",
  "sevkDurumu",
  "plaka",
  "teslimOlanTonaj",
];
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const id = String(body?.id || "").trim();
    const field = String(body?.field || "").trim();
    const value = body?.value ?? "";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id zorunlu." },
        { status: 400 }
      );
    }

    if (!allowedFields.includes(field)) {
      return NextResponse.json(
        { success: false, error: "Bu alan güncellenemez." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("siparisler")
      .update({
        [field]: value,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      row: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Bilinmeyen hata",
      },
      { status: 500 }
    );
  }
}