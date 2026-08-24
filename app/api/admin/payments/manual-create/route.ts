import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generatePaymentNo } from "@/lib/payments/utils";

export const runtime = "nodejs";

type ManualPaymentMethod = "bank_transfer" | "cash" | "manual";

type ManualPaymentPurpose =
  | "order_collection"
  | "advance_payment"
  | "general_collection";

function isValidMethod(value: string): value is ManualPaymentMethod {
  return ["bank_transfer", "cash", "manual"].includes(value);
}

function isValidPurpose(value: string): value is ManualPaymentPurpose {
  return ["order_collection", "advance_payment", "general_collection"].includes(value);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const amount = Number(body.amount || 0);
    const paymentMethod = String(body.paymentMethod || "bank_transfer");
    const paymentPurpose = String(body.paymentPurpose || "order_collection");

    if (!amount || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Tutar zorunlu." }, { status: 400 });
    }

    if (!isValidMethod(paymentMethod)) {
      return NextResponse.json({ ok: false, error: "Geçersiz tahsilat yöntemi." }, { status: 400 });
    }

    if (!isValidPurpose(paymentPurpose)) {
      return NextResponse.json({ ok: false, error: "Geçersiz tahsilat amacı." }, { status: 400 });
    }

    if (paymentPurpose === "order_collection" && !body.linkedOrderId) {
      return NextResponse.json(
        { ok: false, error: "Sipariş tahsilatı için sipariş ID zorunlu." },
        { status: 400 }
      );
    }

    const paymentNo = generatePaymentNo();

    const { data: transaction, error } = await supabaseAdmin
      .from("payment_transactions")
      .insert({
        payment_no: paymentNo,
        provider_code: "manual",
        order_id: body.linkedOrderId || null,
        linked_order_id: body.linkedOrderId || null,
        payment_purpose: paymentPurpose,
        payment_method: paymentMethod,
        collection_channel: "admin_charge",

        customer_name: body.customerName || null,
        amount,
        currency: "TRY",

        allocated_amount: paymentPurpose === "order_collection" ? amount : 0,
        remaining_amount: paymentPurpose === "advance_payment" ? amount : 0,

        bank_code: body.bankCode || null,
        card_holder_name: null,
        card_last4: null,

        status: "approved",
        provider_order_id: paymentNo,
        provider_transaction_id: paymentNo,

        note: body.note || null,
        created_by: body.createdBy || null,
        linked_at: body.linkedOrderId ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await supabaseAdmin.from("payment_transaction_logs").insert({
      transaction_id: transaction.id,
      level: "info",
      message: "Manuel/EFT tahsilat kaydı oluşturuldu",
      data: {
        paymentNo,
        paymentPurpose,
        paymentMethod,
        amount,
        linkedOrderId: body.linkedOrderId || null,
      },
    });

    return NextResponse.json({ ok: true, transaction });
  } catch (error) {
    console.error("PAYMENT_MANUAL_CREATE_ERROR", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Manuel tahsilat oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}
