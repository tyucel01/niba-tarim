import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/lib/payments/payment-service";
import { PaymentTransactionService } from "@/lib/payments/transaction-service";
import type { CreatePaymentInput } from "@/lib/payments/types";

export const runtime = "nodejs";

function getClientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

function validateInput(input: Partial<CreatePaymentInput>) {
  if (!input.amount || input.amount <= 0) return "Tutar zorunlu.";
  if (!input.bankCode) return "Banka zorunlu.";
  if (!input.maturityMonth) return "Tarım kart vadesi zorunlu.";
  if (!input.productType) return "Ürün tipi zorunlu.";
  if (!input.cardHolderName) return "Kart üzerindeki isim zorunlu.";
  if (!input.cardPan) return "Kart numarası zorunlu.";
  if (!input.cardExpiry) return "Son kullanma tarihi zorunlu.";
  if (!input.cardCvv) return "CVV zorunlu.";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CreatePaymentInput>;

    const validationError = validateInput(body);
    if (validationError) {
      return NextResponse.json(
        { ok: false, error: validationError },
        { status: 400 }
      );
    }

    const input: CreatePaymentInput = {
      providerCode: body.providerCode || "paratika",
      orderId: body.orderId || null,
      customerName: body.customerName || null,
      customerEmail: body.customerEmail || null,
      customerPhone: body.customerPhone || null,
      customerIp: body.customerIp || getClientIp(req),

      amount: Number(body.amount),
      currency: "TRY",

      bankCode: body.bankCode!,
      maturityMonth: Number(body.maturityMonth),
      productType: body.productType!,

      cardHolderName: body.cardHolderName!,
      cardPan: body.cardPan!,
      cardExpiry: body.cardExpiry!,
      cardCvv: body.cardCvv!,

      invoiceNo: body.invoiceNo || null,
      salesmanNo: body.salesmanNo || null,
    };

    const transactionService = new PaymentTransactionService();
    const paymentService = new PaymentService();

    const pendingTransaction = await transactionService.createPending(input);

    const result = await paymentService.createPayment({
      ...input,
      orderId: pendingTransaction.provider_order_id,
    });

    const finalTransaction = await transactionService.markResult(
      pendingTransaction.id,
      result
    );

    return NextResponse.json({
      ok: result.ok,
      transaction: finalTransaction,
      result,
    });
  } catch (error) {
    console.error("PAYMENT_CREATE_ERROR", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ödeme işlemi oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}