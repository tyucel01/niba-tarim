import type {
  AgricultureBank,
  AgricultureProductType,
  CreatePaymentInput,
  PaymentResult,
} from "../types";
import type { PaymentProvider } from "../provider";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} eksik`);
  return value;
}

function cleanCardPan(cardPan: string) {
  return cardPan.replace(/\D/g, "");
}

function getParatikaUrl() {
  return process.env.PARATIKA_MODE === "live"
    ? "https://vpos.paratika.com.tr/paratika/api/v2"
    : "https://entegrasyon.paratika.com.tr/paratika/api/v2";
}

function getIsbankProductCode(productType: AgricultureProductType) {
  const map: Record<AgricultureProductType, string> = {
    gubre: "1",
    akaryakit: "2",
    ilac: "3",
    tohum: "4",
    diger: "5",
  };

  return map[productType];
}

function buildAgricultureExtra(input: CreatePaymentInput): Record<string, unknown> {
  const month = String(input.maturityMonth);

  switch (input.bankCode as AgricultureBank) {
    case "denizbank":
      return {
        "DenizbankAgriculture.PaymentFrequency": month,
        "DenizbankAgriculture.MaturityPeriod": month,
        "DenizbankAgriculture.AgricultureTxnFlag": "T",
      };

    case "isbank":
      return {
        IMCKOD: getIsbankProductCode(input.productType),
        FDONEM: month,
      };

    case "kuveytturk":
      return {
        "KUVEYTURK.DEFERRINGCOUNT": month,
      };

    case "sekerbank":
      return {
        HASATKARTSATIS: "",
        VADEKODU: "01",
        VADEADEDI: month,
        URUNKODU: "B0",
        PLASIYERNO: input.salesmanNo || "",
        FATURANO: input.invoiceNo || "",
      };

    case "teb":
      return {};

    case "vakifbank":
      return {
        "VakifbankAgriculture.TransactionType": "TKSale",
        "VakifbankAgriculture.CustomInstallments": {
          "VakifbankAgriculture.MaturityPeriod": month,
          "VakifbankAgriculture.Frequency": month,
        },
      };

    default:
      return {};
  }
}

export class ParatikaProvider implements PaymentProvider {
  code = "paratika";

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const url = getParatikaUrl();

    const merchantPaymentId =
      input.orderId || crypto.randomUUID();

    const params = new URLSearchParams();

    params.set("ACTION", "SALE");
    params.set("MERCHANT", requireEnv("PARATIKA_MERCHANT"));
    params.set("MERCHANTUSER", requireEnv("PARATIKA_MERCHANT_USER"));
    params.set("MERCHANTPASSWORD", requireEnv("PARATIKA_MERCHANT_PASSWORD"));

    params.set("AMOUNT", input.amount.toFixed(2));
    params.set("CURRENCY", input.currency || "TRY");
    params.set("MERCHANTPAYMENTID", merchantPaymentId);

    params.set("CUSTOMER", input.customerPhone || input.customerEmail || input.customerName || "NIBA_CUSTOMER");
    params.set("CUSTOMEREMAIL", input.customerEmail || "finans@nibatarim.com");
    params.set("CUSTOMERNAME", input.customerName || input.cardHolderName);
    params.set("CUSTOMERPHONE", input.customerPhone || "");
    params.set("CUSTOMERIP", input.customerIp || "127.0.0.1");

    params.set("CARDPAN", cleanCardPan(input.cardPan));
    params.set("CARDEXPIRY", input.cardExpiry);
    params.set("CARDCVV", input.cardCvv);
    params.set("NAMEONCARD", input.cardHolderName);

    params.set("EXTRA", JSON.stringify(buildAgricultureExtra(input)));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      cache: "no-store",
    });

    const text = await response.text();

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    const responseCode = parsed?.responseCode || parsed?.pgTranReturnCode || null;
    const responseMessage = parsed?.responseMsg || parsed?.pgTranResponseMsg || null;

    const approved = response.ok && (responseCode === "00" || responseMessage === "Approved");

    return {
      ok: approved,
      status: approved ? "approved" : "failed",
      providerCode: "paratika",
      providerTransactionId:
        parsed?.pgTranId ||
        parsed?.transactionId ||
        parsed?.pgTranRefId ||
        null,
      providerOrderId:
        parsed?.merchantPaymentId ||
        parsed?.MERCHANTPAYMENTID ||
        merchantPaymentId,
      responseCode,
      responseMessage,
      rawResponse: parsed,
    };
  }
}