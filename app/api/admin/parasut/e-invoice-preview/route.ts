import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL = "https://api.parasut.com";

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

  let s = String(value).trim().replace(/[^\d,.-]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma && !hasDot) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function detectUnit(d: any, quantity: number) {
  const rawUnit = clean(
    d.unit ||
      d.unit_name ||
      d.measurement_unit ||
      d.unit_code ||
      d.base_unit ||
      d.product_unit ||
      ""
  );

  const lowered = rawUnit.toLocaleLowerCase("tr-TR");

  let normalized = rawUnit || "-";

  if (
    lowered.includes("kg") ||
    lowered.includes("kilogram") ||
    lowered === "kgr"
  ) {
    normalized = "kg";
  } else if (lowered.includes("ton") || lowered === "tn") {
    normalized = "ton";
  } else if (
    lowered.includes("adet") ||
    lowered === "ad" ||
    lowered === "c62"
  ) {
    normalized = "Adet";
  } else if (!rawUnit && quantity >= 1000) {
    normalized = "kg";
  }

  return {
    raw: rawUnit || "-",
    normalized,
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
    const eInvoiceId = clean(body?.eInvoiceId || body?.invoiceId);

    if (!eInvoiceId) {
      return NextResponse.json(
        { success: false, error: "eInvoiceId zorunlu." },
        { status: 400 }
      );
    }

    const token = await getAccessToken();

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

    if (!convertRes.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "convert_invoice",
          error: convertData,
        },
        { status: convertRes.status }
      );
    }

    const attr = convertData?.data?.attributes || {};
    const included = convertData?.included || [];

    const detailItems = included.filter(
      (x: any) => x?.type === "e_invoice_preview_detail"
    );

    const supplier =
      included.find((x: any) => x?.type === "contacts")?.attributes || {};

    const details = detailItems.map((item: any) => {
      const d = item.attributes || {};

      const productName =
        clean(d.product_mapping_name) ||
        clean(d.product_name) ||
        clean(d.name) ||
        clean(d.description) ||
        "E-Fatura Kalemi";

      const quantity = toNumber(d.quantity || 1);
      const unitPrice = toNumber(d.unit_price || 0);
      const vatRate = toNumber(d.vat_rate || 0);
      const lineNetTotal =
        toNumber(d.net_total) ||
        toNumber(d.total) ||
        quantity * unitPrice;

      const unit = detectUnit(d, quantity);

      return {
        product_name: productName,
        quantity,
        unit: unit.normalized,
        raw_unit: unit.raw,
        unit_price: unitPrice,
        vat_rate: vatRate,
        line_total: lineNetTotal,
        raw: d,
      };
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id: eInvoiceId,
        invoice_no:
          attr.invoice_no ||
          attr.invoice_id ||
          attr.external_id ||
          attr.document_no ||
          eInvoiceId,
        issue_date: attr.issue_date || null,
        currency: attr.currency || "TRL",
        net_total: toNumber(attr.net_total || attr.gross_total || 0),
        total_vat: toNumber(attr.total_vat || 0),
        gross_total: toNumber(attr.gross_total || attr.net_total || 0),
        supplier_name:
          supplier.name ||
          supplier.display_name ||
          supplier.company_name ||
          attr.contact_name ||
          "-",
        supplier_tax_number:
          supplier.tax_number ||
          attr.from_vkn ||
          "-",
      },
      details,
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