import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function toNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ ok: false, error: "orderId zorunlu." }, { status: 400 });
    }

    const { data: transactions, error } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("linked_order_id", orderId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const approvedTransactions = (transactions || []).filter(
      (tx) => tx.status === "approved"
    );

    const collectedAmount = approvedTransactions.reduce(
      (sum, tx) => sum + toNumber(tx.allocated_amount || tx.amount),
      0
    );

    return NextResponse.json({
      ok: true,
      orderId,
      collectedAmount,
      transactionCount: transactions?.length || 0,
      approvedTransactionCount: approvedTransactions.length,
      transactions: transactions || [],
    });
  } catch (error) {
    console.error("PAYMENT_ORDER_SUMMARY_ERROR", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Sipariş tahsilat özeti alınamadı.",
      },
      { status: 500 }
    );
  }
}
