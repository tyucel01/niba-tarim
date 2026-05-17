import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL = "https://api.parasut.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAccessToken() {
  const body = new URLSearchParams();

  body.append("grant_type", "password");
  body.append("client_id", process.env.PARASUT_CLIENT_ID || "");
  body.append("client_secret", process.env.PARASUT_CLIENT_SECRET || "");
  body.append("username", process.env.PARASUT_USERNAME || "");
  body.append("password", process.env.PARASUT_PASSWORD || "");

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`Paraşüt token alınamadı: ${JSON.stringify(data)}`);
  }

  return data.access_token as string;
}

function toNumber(value: any) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;

  const raw = String(value).trim();
  if (!raw) return 0;

  // API decimal formatı: 758700.0
  if (/^-?\d+\.\d+$/.test(raw)) {
    return Number(raw);
  }

  // TR formatı: 758.700,00
  let s = raw.replace(/[^\d,.-]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma && !hasDot) {
    s = s.replace(",", ".");
  }

  const parsed = Number(s);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function parasutGet(token: string, companyId: string, path: string) {
  const res = await fetch(`${BASE_URL}/v4/${companyId}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`Paraşüt GET hata: ${JSON.stringify(data)}`);
  }

  return data;
}

async function parasutPost(
  token: string,
  companyId: string,
  path: string,
  payload: any
) {
  const res = await fetch(`${BASE_URL}/v4/${companyId}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { ok: false, status: res.status, data };
  }

  return { ok: true, status: res.status, data };
}

function pickFirstString(...values: any[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function extractRecipientAlias(contactDetail: any) {
  const data = contactDetail?.data || contactDetail;
  const attr = data?.attributes || {};
  const raw = data?.raw || {};
  const rawAttr = raw?.attributes || {};

  const directAlias = pickFirstString(
    attr.e_invoice_address,
    attr.invoicing_preferences?.e_invoice_send_to,
    attr.e_invoice_alias,
    attr.e_invoice_postbox,
    attr.e_document_address,
    attr.invoice_address,
    attr.to_address,
    attr.alias,
    rawAttr.e_invoice_address,
    rawAttr.e_invoice_alias,
    rawAttr.e_invoice_postbox,
    rawAttr.e_document_address,
    rawAttr.invoice_address,
    rawAttr.to_address,
    rawAttr.alias
  );

  if (directAlias) return directAlias;

  const candidates = [
    attr.e_invoice_addresses,
    attr.e_invoice_aliases,
    attr.e_document_addresses,
    attr.aliases,
    rawAttr.e_invoice_addresses,
    rawAttr.e_invoice_aliases,
    rawAttr.e_document_addresses,
    rawAttr.aliases,
    contactDetail?.included,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    for (const item of candidate) {
      const itemAttr = item?.attributes || item || {};
      const alias = pickFirstString(
        itemAttr.address,
        itemAttr.alias,
        itemAttr.value,
        itemAttr.e_invoice_address,
        itemAttr.e_invoice_alias,
        itemAttr.mailbox,
        itemAttr.postbox,
        item?.address,
        item?.alias,
        item?.value
      );

      if (alias) return alias;
    }
  }

  return "";
}

async function getCustomerRecipientAlias(
  token: string,
  companyId: string,
  customerId: string
) {
  const contactDetail = await parasutGet(
    token,
    companyId,
    `/contacts/${customerId}`
  );

  return {
    contactDetail,
    recipientAlias: extractRecipientAlias(contactDetail),
  };
}

function buildSalesInvoicePayload({
  order,
  customerId,
  purchaseBill,
}: {
  order: any;
  customerId: string;
  purchaseBill: any;
}) {
  const included = purchaseBill?.included || [];

  const details = included.filter(
    (x: any) =>
      x?.type === "purchase_bill_details" ||
      x?.type === "sales_invoice_details"
  );

  const firstDetailRow = details?.[0] || null;
  const firstDetail = firstDetailRow?.attributes || {};

  const siparisTonaj = toNumber(
    order.teslimOlanTonaj || order.siparisTonaj || 0
  );

  const pesinSatisFiyati = toNumber(order.pesinSatisFiyati || 0);
  const bayiSatisToplam = toNumber(order.bayiSatisToplam || 0);

  let safeTonUnitPrice =
    siparisTonaj > 0 && bayiSatisToplam > 0
      ? bayiSatisToplam / siparisTonaj
      : pesinSatisFiyati;

  // Fazla sıfır koruması: ton fiyatı anormal yüksekse 10'a böl.
  while (safeTonUnitPrice > 100000) {
    safeTonUnitPrice = safeTonUnitPrice / 10;
  }

  const fallbackQuantity =
    toNumber(order.teslimOlanTonaj) || toNumber(order.siparisTonaj) || 1;

  const quantity = toNumber(firstDetail.quantity) || fallbackQuantity;

  const unit =
    clean(firstDetail.unit) ||
    clean(firstDetail.unit_name) ||
    clean(firstDetail.measurement_unit) ||
    "kg";

  const realProductName =
    clean(firstDetail.product_name) ||
    clean(firstDetail.description) ||
    clean(order.urun) ||
    clean(order.marka) ||
    "Satış Faturası Kalemi";

  const vatRate =
    firstDetail?.vat_rate !== undefined && firstDetail?.vat_rate !== null
      ? toNumber(firstDetail.vat_rate)
      : 0;

  const unitPrice =
    unit.toLowerCase() === "kg"
      ? safeTonUnitPrice / 1000
      : safeTonUnitPrice;

  const firstProductId =
    firstDetail?.product_id ||
    firstDetailRow?.relationships?.product?.data?.id ||
    null;

  const invoiceDetails = [
    {
      type: "sales_invoice_details",
      attributes: {
        description: realProductName,
        quantity,
        unit,
        unit_price: unitPrice,
        vat_rate: vatRate,
        discount_type: "amount",
        discount_value: 0,
      },
      ...(firstProductId
        ? {
            relationships: {
              product: {
                data: {
                  id: String(firstProductId),
                  type: "products",
                },
              },
            },
          }
        : {}),
    },
  ];

  const previewTotal = invoiceDetails.reduce((sum: number, d: any) => {
    const q = toNumber(d.attributes.quantity);
    const price = toNumber(d.attributes.unit_price);
    const vat = toNumber(d.attributes.vat_rate);

    return sum + q * price * (1 + vat / 100);
  }, 0);

  const payload = {
    data: {
      type: "sales_invoices",
      attributes: {
        item_type: "invoice",
        e_invoice: true,
        description: clean(order.plaka) || "",
        issue_date: today(),
        due_date: order.vadeTarihi || today(),
        currency: "TRL",
        exchange_rate: "1.0",
        invoice_series: null,
        invoice_id: null,
      },
      relationships: {
        active_e_document: {
          data: {
            type: "e_documents",
          },
        },
        contact: {
          data: {
            id: String(customerId),
            type: "contacts",
          },
        },
        details: {
          data: invoiceDetails,
        },
      },
    },
  };

  return {
    payload,
    preview: {
      siparisId: order.id,
      satisId: order.satisId,
      bayi: order.bayi,
      customerId,
      matchedPurchaseInvoiceId: order.matched_purchase_invoice_id,
      matchedPurchaseInvoiceNo: order.matched_purchase_invoice_no,
      details: invoiceDetails.map((d: any) => ({
        product_name: d.attributes.description || "-",
        description: clean(order.plaka) || "",
        quantity: d.attributes.quantity,
        unit: d.attributes.unit,
        unit_price: d.attributes.unit_price,
        vat_rate: d.attributes.vat_rate,
      })),
      estimatedTotal: previewTotal,
    },
  };
}

async function createEInvoice({
  token,
  companyId,
  salesInvoiceId,
  recipientAlias,
}: {
  token: string;
  companyId: string;
  salesInvoiceId: string;
  recipientAlias: string;
}) {
  const payload = {
    data: {
      id: null,
      type: "e_invoices",
      attributes: {
        vat_withholding_params: [],
        vat_exemption_reason_code: "326",
        vat_exemption_reason:
          "13/ı Gıda, Tarım ve Hayvancılık Bakanlığı Tarafından Tescil Edilmiş Gübrelerin Teslimi",
        accommodation_tax_exemption_reason_code: null,
        excise_duty_codes: [],
        scenario: "commercial",
        to: recipientAlias,
        custom_requirement_params: null,
        additional_doc_ref: "",
        gtip_diib_codes: [],
      },
      relationships: {
        invoice: {
          data: {
            id: String(salesInvoiceId),
            type: "sales_invoices",
          },
        },
      },
    },
  };

  return parasutPost(token, companyId, "/e_invoices", payload);
}

export async function POST(req: NextRequest) {
  try {
    const companyId = process.env.PARASUT_COMPANY_ID;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "PARASUT_COMPANY_ID eksik." },
        { status: 500 }
      );
    }

    const body = await req.json();

    const siparisId = clean(body?.siparisId);
    const customerId = clean(body?.customerId);
    const confirm = Boolean(body?.confirm);

    if (!siparisId) {
      return NextResponse.json(
        { success: false, error: "siparisId zorunlu." },
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          error: "customerId zorunlu. Bayi cari kartı seçilmeli.",
        },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("siparisler")
      .select("*")
      .eq("id", siparisId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: orderError?.message || "Sipariş bulunamadı." },
        { status: 404 }
      );
    }

    if (!order.matched_purchase_invoice_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Bu siparişte eşleşmiş alış faturası yok. Önce alış faturasını eşleştir.",
        },
        { status: 400 }
      );
    }

    const token = await getAccessToken();

    const purchaseBill = await parasutGet(
      token,
      companyId,
      `/purchase_bills/${order.matched_purchase_invoice_id}?include=details,details.product`
    );

    const { payload, preview } = buildSalesInvoicePayload({
      order,
      customerId,
      purchaseBill,
    });

    if (!confirm) {
      return NextResponse.json({
        success: true,
        mode: "preview",
        message:
          "Önizleme hazır. Resmileştirmeden/oluşturmadan önce kullanıcı onayı gerekiyor.",
        preview,
      });
    }

    const created = await parasutPost(
      token,
      companyId,
      "/sales_invoices",
      payload
    );

    console.log(
      "PARASUT_SALES_INVOICE_RESPONSE",
      JSON.stringify(created, null, 2)
    );

    if (!created.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "create_sales_invoice",
          error: created.data,
          sentPayload: payload,
        },
        { status: created.status }
      );
    }

    const salesInvoiceId = created.data?.data?.id || null;
    const salesInvoiceNo =
      created.data?.data?.attributes?.invoice_no ||
      created.data?.data?.attributes?.invoice_id ||
      salesInvoiceId;

    if (!salesInvoiceId) {
      return NextResponse.json(
        {
          success: false,
          step: "sales_invoice_id_missing",
          error: "Satış faturası oluştu ama salesInvoiceId alınamadı.",
          data: created.data,
        },
        { status: 500 }
      );
    }

    const { contactDetail, recipientAlias } = await getCustomerRecipientAlias(
      
      token,
      companyId,
      customerId
    );
    console.log(
  "PARASUT_CONTACT_DETAIL_FOR_ALIAS",
  JSON.stringify(contactDetail, null, 2)
);

console.log("PARASUT_RECIPIENT_ALIAS", recipientAlias);

    if (!recipientAlias) {
      await supabase
        .from("siparisler")
        .update({
          sales_invoice_id: salesInvoiceId,
          sales_invoice_no: salesInvoiceNo,
          sales_invoice_created_at: new Date().toISOString(),
        })
        .eq("id", siparisId);

      return NextResponse.json(
        {
          success: false,
          step: "recipient_alias_missing",
          error:
            "Satış faturası oluşturuldu fakat müşteri e-fatura alias/posta kutusu bulunamadı. Paraşüt cari kartındaki e-fatura posta kutusunu kontrol et.",
          salesInvoiceId,
          salesInvoiceNo,
          contactDetail,
        },
        { status: 400 }
      );
    }

    const eInvoice = await createEInvoice({
      token,
      companyId,
      salesInvoiceId: String(salesInvoiceId),
      recipientAlias,
    });

    console.log("PARASUT_E_INVOICE_RESPONSE", JSON.stringify(eInvoice, null, 2));

    if (!eInvoice.ok) {
      await supabase
        .from("siparisler")
        .update({
          sales_invoice_id: salesInvoiceId,
          sales_invoice_no: salesInvoiceNo,
          sales_invoice_created_at: new Date().toISOString(),
        })
        .eq("id", siparisId);

      return NextResponse.json(
        {
          success: false,
          step: "create_e_invoice",
          error: eInvoice.data,
          salesInvoiceId,
          salesInvoiceNo,
          recipientAlias,
        },
        { status: eInvoice.status }
      );
    }

    const eInvoiceId = eInvoice.data?.data?.id || null;
    const eInvoiceNo =
      eInvoice.data?.data?.attributes?.invoice_no ||
      eInvoice.data?.data?.attributes?.invoice_id ||
      eInvoice.data?.data?.attributes?.external_id ||
      eInvoiceId;

    await supabase
      .from("siparisler")
      .update({
        sales_invoice_id: salesInvoiceId,
        sales_invoice_no: salesInvoiceNo,
        sales_invoice_created_at: new Date().toISOString(),
      })
      .eq("id", siparisId);

    return NextResponse.json({
      success: true,
      message: "Satış faturası oluşturuldu ve e-fatura resmileştirme başlatıldı.",
      salesInvoiceId,
      salesInvoiceNo,
      eInvoiceId,
      eInvoiceNo,
      recipientAlias,
      salesInvoice: created.data,
      eInvoice: eInvoice.data,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Bilinmeyen hata",
      },
      { status: 500 }
    );
  }
}
