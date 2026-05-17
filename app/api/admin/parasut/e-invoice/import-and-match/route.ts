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
    throw new Error(`Token alınamadı: ${JSON.stringify(data)}`);
  }

  return data.access_token as string;
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function toNumber(value: any) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;

  let s = String(value).trim();

  s = s.replace(/[^\d,.-]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Türk formatı: 999.000,50
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma && !hasDot) {
    // Türk decimal: 999000,50
    s = s.replace(",", ".");
  } else {
    // Paraşüt API formatı: 999000.00
    // Noktaya dokunma.
  }

  const parsed = Number(s);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractInvoiceNo(data: any) {
  const attr = data?.data?.attributes || data?.attributes || {};

  return (
    attr.invoice_no ||
    attr.invoice_id ||
    attr.document_no ||
    attr.external_id ||
    attr.description ||
    data?.data?.id ||
    data?.id ||
    ""
  );
}

function extractInvoiceTotal(data: any) {
  const attr = data?.data?.attributes || data?.attributes || {};

  return toNumber(
    attr.net_total ||
      attr.gross_total ||
      attr.total_amount ||
      attr.remaining ||
      attr.total ||
      0
  );
}

function getDetailName(detail: any) {
  const attr = detail?.attributes || {};

  return (
    clean(attr.product_name) ||
    clean(attr.name) ||
    clean(attr.description) ||
    clean(attr.item_name) ||
    "Gelen E-Fatura Ürünü"
  );
}

function getVatRate(detail: any) {
  const attr = detail?.attributes || {};
  return toNumber(attr.vat_rate ?? attr.vatRate ?? 20);
}

async function findProductByName(token: string, companyId: string, name: string) {
  const res = await fetch(
    `${BASE_URL}/v4/${companyId}/products?page[size]=25&filter[name]=${encodeURIComponent(
      name
    )}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const data = await res.json().catch(() => null);
  if (!res.ok) return null;

  const products = data?.data || [];

  return (
    products.find(
      (p: any) =>
        String(p?.attributes?.name || "").trim().toLowerCase() ===
        name.trim().toLowerCase()
    ) ||
    products[0] ||
    null
  );
}

async function createProduct(
  token: string,
  companyId: string,
  name: string,
  vatRate = 20
) {
  const payload = {
    data: {
      type: "products",
      attributes: {
        name,
        code: "",
        vat_rate: vatRate,
        unit: "ton",
        archived: false,
      },
    },
  };

  const res = await fetch(`${BASE_URL}/v4/${companyId}/products`, {
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
    throw new Error(`Ürün oluşturulamadı: ${JSON.stringify(data)}`);
  }

  return data?.data;
}

async function getOrCreateProduct(
  token: string,
  companyId: string,
  name: string,
  vatRate = 20
) {
  const found = await findProductByName(token, companyId, name);
  if (found?.id) return found;

  return await createProduct(token, companyId, name, vatRate);
}

async function enrichDetailsWithProducts(
  token: string,
  companyId: string,
  details: any[]
) {
  const enriched: any[] = [];

  for (const detail of details) {
    const nextDetail = JSON.parse(JSON.stringify(detail));

    delete nextDetail.id;

    nextDetail.type = "purchase_bill_details";
    nextDetail.attributes = nextDetail.attributes || {};

    const productName = getDetailName(nextDetail);
    const vatRate = getVatRate(nextDetail);

    const product = await getOrCreateProduct(
      token,
      companyId,
      productName,
      vatRate || 20
    );

    nextDetail.relationships = nextDetail.relationships || {};
    nextDetail.relationships.product = {
      data: {
        id: String(product.id),
        type: "products",
      },
    };

    enriched.push(nextDetail);
  }

  return enriched;
}

async function buildPurchaseBillPayload(
  convertData: any,
  supplierId: string,
  eInvoiceId: string
) {
  const converted = convertData?.data;

  if (!converted) {
    throw new Error("Convert cevabında data bulunamadı.");
  }

  const attr = converted.attributes || {};
  const included = convertData?.included || [];

  const detailItems = included.filter(
    (x: any) => x?.type === "e_invoice_preview_detail"
  );

  if (!detailItems.length) {
    throw new Error("Convert cevabında e-fatura kalemi bulunamadı.");
  }

  const supplierFromConvert =
    included.find((x: any) => x?.type === "contacts") || null;

  const details = detailItems.map((detail: any) => {
    const d = detail.attributes || {};

    const productName =
      clean(d.product_mapping_name) ||
      clean(d.description) ||
      "E-Fatura Kalemi";

 const quantity = toNumber(d.quantity || 1);
const unitPrice = toNumber(d.unit_price || 0);
const vatRate = toNumber(d.vat_rate || 0);
const netTotal = quantity * unitPrice;

let unit = "Adet";

const rawUnit = String(
  d.unit ||
    d.unit_name ||
    d.measurement_unit ||
    d.unit_code ||
    d.base_unit ||
    d.product_unit ||
    ""
).toLowerCase();

if (
  rawUnit.includes("kg") ||
  rawUnit.includes("kilogram") ||
  rawUnit === "kgr"
) {
  unit = "kg";
} else if (
  rawUnit.includes("ton") ||
  rawUnit.includes("tn")
) {
  unit = "ton";
} else if (
  rawUnit.includes("adet") ||
  rawUnit === "ad"
) {
  unit = "Adet";
} else if (quantity >= 1000) {
  unit = "kg";
}

    return {
      type: "purchase_bill_details",
attributes: {
  unit_price: unitPrice,
  quantity,
  unit,
        discount_type: d.discount_type || "amount",
        discount: "0.00",
        invoice_discount: "0.00",
        vat: "0.00",
        excise_duty_type: d.excise_duty_type || "amount",
        excise_duty: "0.00",
        communications_tax: "0.00",
        accommodation_tax: "0.00",
        net_total_without_invoice_discount: 0,
        detail_no: null,
        description: productName,
        net_total: netTotal.toFixed(2),
        discount_value: "0.00",
        discount_rate: 0,
        vat_rate: vatRate.toFixed(2),
        excise_duty_value: "0.00",
        excise_duty_rate: 0,
        communications_tax_rate: "0.00",
        accommodation_tax_rate: "0.00",
        accommodation_tax_exempt: false,
        vat_withholding: "0.00",
        vat_withholding_rate: "0.00",
        unrefunded_quantity: quantity,
      },
      relationships: {
        product: {
          data: {
            type: "products",
            attributes: {
              name: productName,
              code: null,
              barcode: null,
              unit,
              buying_price: unitPrice,
              buying_price_in_trl: 0,
              list_price: 0,
              list_price_in_trl: 0,
              buying_currency: attr.currency || "TRL",
              currency: attr.currency || "TRL",
              inventory_tracking: false,
              archived: false,
              vat_rate: vatRate.toFixed(2),
              sales_excise_duty_type: "percentage",
              sales_excise_duty: "0.0",
              purchase_excise_duty_type: "amount",
              purchase_excise_duty: "0.0",
              communications_tax_rate: "0.0",
              accommodation_tax_rate: "0.0",
              item_type: "SimpleProduct",
            },
          },
        },
        invoice: {
          data: {
            type: "purchase_bills",
            id: null,
          },
        },
      },
    };
  });

  const grossTotal = toNumber(attr.net_total || 0);
  const totalVat = toNumber(attr.total_vat || 0);
  const netTotal = grossTotal;

  return {
    data: {
      type: "purchase_bills",
      attributes: {
        currency: attr.currency || "TRL",
        total_discount: "0.00",
        total_invoice_discount: "0.00",
        invoice_discount_type: attr.invoice_discount_type || "amount",
        withholding: "0.00",
        total_vat_withholding: attr.total_vat_withholding || "0.00",
        total_excise_duty: "0.00",
        total_communications_tax: "0.00",
        total_accommodation_tax: attr.total_accommodation_tax || "0.00",
        gross_total: grossTotal.toFixed(2),
        total_vat: totalVat.toFixed(2),
        exchange_rate: attr.exchange_rate || "1.0000",
        net_total: netTotal.toFixed(2),
        net_total_in_trl: netTotal.toFixed(2),
        remaining: 0,
        issue_date: attr.issue_date,
        due_date: attr.due_date || attr.issue_date,
        payment_status: "unpaid",
        days_overdue: null,
        days_till_due_date: null,
        is_recurred_item: false,
        photo: {
          new_file_name: null,
          temp_file_url: null,
          is_changed: false,
          is_removed: false,
        },
        description: attr.description || null,

        // KRİTİK: Paraşüt web arayüzü bunu böyle gönderiyor
        item_type: "purchase_bill",

        archived: false,
        invoice_no: attr.invoice_no,
        invoice_discount: attr.invoice_discount || "0.00",
        withholding_rate: attr.withholding_rate || "0.00",
        total_paid: "0.00",
        payment_amount: 0,
        remaining_in_trl: 0,
        remaining_reimbursement: 0,
        remaining_reimbursement_in_trl: 0,
        shipment_included: true,
        reimbursement_tx_id: null,
        non_standard_fields: attr.non_standard_fields || [],
        other_taxes: attr.other_taxes || [],
        total_stamp_tax: attr.total_stamp_tax || "0.00",
        rounding_amount: attr.rounding_amount || "0.00",

        tax_number: supplierFromConvert?.attributes?.tax_number || null,
        tax_office: supplierFromConvert?.attributes?.tax_office || null,
        billing_address: supplierFromConvert?.attributes?.address || null,
        district: supplierFromConvert?.attributes?.district || null,
        city: supplierFromConvert?.attributes?.city || null,
        country: supplierFromConvert?.attributes?.country || null,
        contact_type: supplierFromConvert?.attributes?.contact_type || "company",
        is_abroad: supplierFromConvert?.attributes?.is_abroad || false,
        is_detailed: true,
      },
      relationships: {
        tags: {},
        category: {},
        supplier: {
          data: {
            type: "contacts",
            id: String(supplierId),
          },
        },
        spender: {},
        paid_by_employee: {},
        details: {
          data: details,
        },
        payment_account: {},

        // EN KRİTİK KISIM:
        // Bu olmazsa kayıt manuel gider gibi oluşur, e-fatura içeri alınmış sayılmaz.
        active_e_document: {
          data: {
            type: "e_invoices",
            id: String(eInvoiceId),
          },
        },
      },
    },
  };
}

async function verifyPurchaseBill(
  token: string,
  companyId: string,
  purchaseBillId: string
) {
  const res = await fetch(
    `${BASE_URL}/v4/${companyId}/purchase_bills/${purchaseBillId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const data = await res.json().catch(() => null);

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
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
    const eInvoiceId = clean(body?.eInvoiceId || body?.invoiceId);
    const supplierId = clean(body?.supplierId);

    if (!siparisId) {
      return NextResponse.json(
        { success: false, error: "siparisId zorunlu." },
        { status: 400 }
      );
    }

    if (!eInvoiceId) {
      return NextResponse.json(
        { success: false, error: "eInvoiceId zorunlu." },
        { status: 400 }
      );
    }

    if (!supplierId) {
      return NextResponse.json(
        {
          success: false,
          error: "supplierId zorunlu. Cari kart seçilmeden giderleştirme yapılamaz.",
        },
        { status: 400 }
      );
    }
    const { data: existingOrder, error: existingOrderError } = await supabase
  .from("siparisler")
  .select("id, gelenFatura, matched_purchase_invoice_id, matched_purchase_invoice_no")
  .eq("id", siparisId)
  .single();

if (existingOrderError) {
  return NextResponse.json(
    {
      success: false,
      step: "supabase_existing_order_check",
      error: existingOrderError.message,
    },
    { status: 500 }
  );
}

if (existingOrder?.matched_purchase_invoice_id) {
  return NextResponse.json(
    {
      success: false,
      step: "already_matched",
      message: `Bu sipariş zaten ${existingOrder.matched_purchase_invoice_no || existingOrder.gelenFatura || "bir fatura"} ile eşleşmiş. Tekrar gider kaydı oluşturmadım.`,
    },
    { status: 409 }
  );
}

    const token = await getAccessToken();

    // 1) E-FATURAYI KABUL ET
    // Daha önce kabul edildiyse hata gelebilir. Bu durumda convert denemeye devam ediyoruz.
    const acceptRes = await fetch(
      `${BASE_URL}/v4/${companyId}/e_invoices/${eInvoiceId}/respond`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            attributes: {
              response_type: "accept",
            },
          },
        }),
        cache: "no-store",
      }
    );

    const acceptData = await acceptRes.json().catch(() => null);

    // 2) E-FATURAYI GİDER KAYDI FORMATINA ÇEVİR
    const convertRes = await fetch(
      `${BASE_URL}/v4/${companyId}/e_invoices/${eInvoiceId}/convert`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const convertData = await convertRes.json().catch(() => null);
    console.log("PARASUT_CONVERT_DATA_FULL", JSON.stringify(convertData, null, 2));

    if (!convertRes.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "convert_invoice",
          message:
            "Fatura kabul edilmiş olabilir ama Paraşüt convert adımı başarısız oldu. Bu nedenle gider kaydı oluşmadı.",
          acceptStatus: acceptRes.status,
          acceptOk: acceptRes.ok,
          acceptData,
          error: convertData,
        },
        { status: convertRes.status }
      );
    }

    // 3) PURCHASE_BILLS PAYLOAD HAZIRLA
const purchaseBillPayload = await buildPurchaseBillPayload(
  convertData,
  supplierId,
  eInvoiceId
);

    // 4) GERÇEK GİDER / ALIŞ FATURASI KAYDI OLUŞTUR
    const createRes = await fetch(`${BASE_URL}/v4/${companyId}/purchase_bills`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(purchaseBillPayload),
      cache: "no-store",
    });

    const createData = await createRes.json().catch(() => null);

    if (!createRes.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "create_purchase_bill",
          message:
            "Fatura kabul/convert edildi ama Paraşüt gider kaydı oluşturulamadı.",
          acceptStatus: acceptRes.status,
          acceptOk: acceptRes.ok,
          acceptData,
          error: createData,
          sentPayload: purchaseBillPayload,
        },
        { status: createRes.status }
      );
    }

    const purchaseBillId = createData?.data?.id ? String(createData.data.id) : "";

    if (!purchaseBillId) {
      return NextResponse.json(
        {
          success: false,
          step: "purchase_bill_missing_id",
          message:
            "Paraşüt create cevabı başarılı döndü gibi ama purchase_bill id gelmedi. Bu yüzden gider kaydı doğrulanamadı.",
          acceptStatus: acceptRes.status,
          acceptOk: acceptRes.ok,
          acceptData,
          createData,
          sentPayload: purchaseBillPayload,
        },
        { status: 500 }
      );
    }

    // 5) EN KRİTİK KONTROL:
    // Paraşüt'te oluşturulan purchase_bill gerçekten okunabiliyor mu?
    const verify = await verifyPurchaseBill(token, companyId, purchaseBillId);

    if (!verify.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "verify_purchase_bill",
          message:
            "Paraşüt create cevabı döndü ama oluşturulan gider kaydı geri okunamadı. Bu nedenle başarılı saymadım.",
          purchaseBillId,
          verifyStatus: verify.status,
          verifyData: verify.data,
          createData,
          sentPayload: purchaseBillPayload,
        },
        { status: 500 }
      );
    }

    const purchaseBillNo =
      extractInvoiceNo(verify.data) ||
      extractInvoiceNo(createData) ||
      extractInvoiceNo(convertData) ||
      eInvoiceId;

    const purchaseBillTotal =
      extractInvoiceTotal(verify.data) ||
      extractInvoiceTotal(createData) ||
      extractInvoiceTotal(convertData);

    // 6) SUPABASE SİPARİŞ EŞLEŞTİR
    const { data: updatedOrder, error: updateError } = await supabase
      .from("siparisler")
      .update({
        matched_purchase_invoice_id: purchaseBillId,
        matched_purchase_invoice_no: purchaseBillNo || "Eşleşti",
        matched_purchase_invoice_total: purchaseBillTotal,
        matched_purchase_invoice_at: new Date().toISOString(),
        gelenFatura: purchaseBillNo || "Eşleşti",
      })
      .eq("id", siparisId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          step: "supabase_update",
          message:
            "Paraşüt gider kaydı oluştu ve doğrulandı ama Supabase sipariş eşleşmesi güncellenemedi.",
          error: updateError.message,
          purchaseBillId,
          verifyData: verify.data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "E-fatura kabul edildi, Paraşüt giderlerine gerçek alış/gider faturası olarak kaydedildi ve siparişle eşleştirildi.",
      eInvoiceId,
      supplierId,
      purchaseBillId,
      purchaseBillNo,
      purchaseBillTotal,
      order: updatedOrder,
      debug: {
        acceptStatus: acceptRes.status,
        acceptOk: acceptRes.ok,
        acceptedOrAlreadyAccepted: true,
        converted: true,
        purchaseBillCreated: true,
        purchaseBillVerified: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        step: "server_error",
        error: err?.message || "Bilinmeyen hata",
      },
      { status: 500 }
    );
  }
}