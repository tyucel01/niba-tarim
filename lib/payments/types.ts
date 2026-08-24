export type PaymentProviderCode = "paratika";

export type PaymentStatus =
  | "pending"
  | "approved"
  | "failed"
  | "refunded"
  | "voided";

export type PaymentPurpose =
  | "order_collection"
  | "advance_payment"
  | "general_collection";

export type PaymentMethod =
  | "tarim_card"
  | "credit_card"
  | "bank_transfer"
  | "fast"
  | "cash"
  | "cheque"
  | "payment_link";

export type CollectionChannel =
  | "admin_charge"
  | "payment_link";

export type AgricultureBank =
  | "denizbank"
  | "isbank"
  | "kuveytturk"
  | "sekerbank"
  | "teb"
  | "vakifbank";

export type AgricultureProductType =
  | "gubre"
  | "akaryakit"
  | "ilac"
  | "tohum"
  | "diger";

export type CreatePaymentInput = {
  providerCode?: PaymentProviderCode;

  orderId?: string | null;
  linkedOrderId?: string | null;

  paymentPurpose?: PaymentPurpose;
  paymentMethod?: PaymentMethod;
  collectionChannel?: CollectionChannel;

  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerIp?: string | null;

  amount: number;
  currency?: "TRY";

  bankCode: AgricultureBank;
  maturityMonth: number;
  productType: AgricultureProductType;

  cardHolderName: string;
  cardPan: string;
  cardExpiry: string;
  cardCvv: string;

  invoiceNo?: string | null;
  salesmanNo?: string | null;
  note?: string | null;
  createdBy?: string | null;
};

export type PaymentResult = {
  ok: boolean;
  status: PaymentStatus;
  providerCode: PaymentProviderCode;
  providerTransactionId?: string | null;
  providerOrderId?: string | null;
  responseCode?: string | null;
  responseMessage?: string | null;
  rawResponse?: unknown;
};