import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toNumber(value: any) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;

  const normalized = String(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const id = params?.id;

    const body = await req.json();

    const invoiceId = body?.invoiceId || null;
    const invoiceNo = String(body?.invoiceNo || "").trim();
    const invoiceTotal = toNumber(body?.invoiceTotal);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Sipariş ID bulunamadı.",
        },
        { status: 400 }
      );
    }

    if (!invoiceId && !invoiceNo) {
      return NextResponse.json(
        {
          success: false,
          error: "Fatura bilgisi bulunamadı.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("siparisler")
      .update({
        matched_purchase_invoice_id: invoiceId,
        matched_purchase_invoice_no: invoiceNo,
        matched_purchase_invoice_total: invoiceTotal,
        matched_purchase_invoice_at: new Date().toISOString(),
        gelenFatura: invoiceNo || "Eşleşti",
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
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