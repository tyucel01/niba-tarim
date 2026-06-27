import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const bankCode = searchParams.get("bankCode");
    const customerName = searchParams.get("customerName");
    const orderId = searchParams.get("orderId");

    const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

    let query = supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (bankCode && bankCode !== "all") {
      query = query.eq("bank_code", bankCode);
    }

    if (customerName) {
      query = query.ilike("customer_name", `%${customerName}%`);
    }

    if (orderId) {
      query = query.eq("order_id", orderId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      transactions: data || [],
    });
  } catch (error) {
    console.error("PAYMENT_LIST_ERROR", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ödeme işlemleri listelenemedi.",
      },
      { status: 500 }
    );
  }
}