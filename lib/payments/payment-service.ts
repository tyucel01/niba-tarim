import { PaymentRouter } from "./payment-router";
import { ParatikaProvider } from "./providers/paratika";
import type { CreatePaymentInput, PaymentResult } from "./types";

export class PaymentService {
  private router = new PaymentRouter();

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const providerCode = this.router.selectProvider(input);

    if (providerCode === "paratika") {
      return new ParatikaProvider().createPayment(input);
    }

    return {
      ok: false,
      status: "failed",
      providerCode,
      responseCode: "UNSUPPORTED_PROVIDER",
      responseMessage: `Desteklenmeyen ödeme sağlayıcısı: ${providerCode}`,
    };
  }
}