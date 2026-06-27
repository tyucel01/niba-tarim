import type { CreatePaymentInput, PaymentProviderCode } from "./types";

export class PaymentRouter {
  selectProvider(input: CreatePaymentInput): PaymentProviderCode {
    if (input.providerCode) return input.providerCode;

    // Şimdilik tüm tarım kart işlemleri Paratika'ya gidiyor.
    // İleride komisyon/bloke/maliyet tablosuna göre burada seçim yapacağız.
    return "paratika";
  }
}