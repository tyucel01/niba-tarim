import type { CreatePaymentInput, PaymentResult } from "./types";

export interface PaymentProvider {
  code: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
}