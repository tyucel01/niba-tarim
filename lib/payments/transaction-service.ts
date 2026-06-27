import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CreatePaymentInput, PaymentResult } from "./types";
import { generatePaymentNo, getCardLast4, maskSensitivePaymentData } from "./utils";

export class PaymentTransactionService {
  async createPending(input: CreatePaymentInput) {
    const paymentNo = generatePaymentNo();
    const purpose = input.paymentPurpose || "order_collection";

    const { data, error } = await supabaseAdmin
      .from("payment_transactions")
      .insert({
        payment_no: paymentNo,
        provider_code: input.providerCode || "paratika",

        order_id: input.orderId || null,
        linked_order_id: input.linkedOrderId || input.orderId || null,

        payment_purpose: purpose,
        payment_method: input.paymentMethod || "tarim_card",

        customer_name: input.customerName || null,
        amount: input.amount,
        currency: input.currency || "TRY",

        allocated_amount:
          purpose === "order_collection" ? input.amount : 0,
        remaining_amount:
          purpose === "advance_payment" ? input.amount : 0,

        bank_code: input.bankCode,
        card_holder_name: input.cardHolderName,
        card_last4: getCardLast4(input.cardPan),

        status: "pending",
        provider_order_id: paymentNo,
        note: input.note || null,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Ödeme kaydı oluşturulamadı: ${error.message}`);
    }

    await this.log(data.id, "info", "Ödeme işlemi pending olarak oluşturuldu", {
      paymentNo,
      purpose,
      input: maskSensitivePaymentData(input),
    });

    return data;
  }

  async markResult(transactionId: string, result: PaymentResult) {
    const { data, error } = await supabaseAdmin
      .from("payment_transactions")
      .update({
        status: result.status,
        provider_transaction_id: result.providerTransactionId || null,
        provider_order_id: result.providerOrderId || null,
        error_code: result.ok ? null : result.responseCode || null,
        error_message: result.ok ? null : result.responseMessage || null,
        raw_response: result.rawResponse || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Ödeme sonucu güncellenemedi: ${error.message}`);
    }

    await this.log(
      transactionId,
      result.ok ? "info" : "error",
      result.ok ? "Ödeme başarılı" : "Ödeme başarısız",
      {
        result: maskSensitivePaymentData(result),
      }
    );

    return data;
  }

  async log(
    transactionId: string,
    level: "info" | "warn" | "error",
    message: string,
    data?: unknown
  ) {
    await supabaseAdmin.from("payment_transaction_logs").insert({
      transaction_id: transactionId,
      level,
      message,
      data: maskSensitivePaymentData(data || {}),
    });
  }
}