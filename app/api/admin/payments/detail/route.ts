import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "İşlem ID zorunlu." },
        { status: 400 }
      );
    }

    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (transactionError) {
      return NextResponse.json(
        { ok: false, error: transactionError.message },
        { status: 500 }
      );
    }

    const { data: logs, error: logsError } = await supabaseAdmin
      .from("payment_transaction_logs")
      .select("*")
      .eq("transaction_id", id)
      .order("created_at", { ascending: false });

    if (logsError) {
      return NextResponse.json(
        { ok: false, error: logsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      transaction,
      logs: logs || [],
    });
  } catch (error) {
    console.error("PAYMENT_DETAIL_ERROR", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ödeme detayı alınamadı.",
      },
      { status: 500 }
    );
  }
}