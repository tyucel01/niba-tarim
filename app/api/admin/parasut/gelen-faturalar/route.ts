import { cachedIncomingPage } from "@/lib/parasut/incoming-cache";
import { invoiceAdmin, reusableInvoices } from "@/lib/parasut/invoice-pool";
import { NextResponse } from "next/server";

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
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.access_token as string;
}

export async function GET(req: Request) {
  try {
    const companyId = process.env.PARASUT_COMPANY_ID;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "PARASUT_COMPANY_ID eksik." },
        { status: 500 },
      );
    }

    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const token = await getAccessToken();
      const { data: stored, error: poolError } = await invoiceAdmin().from("purchase_invoice_pool").select("*").eq("e_invoice_id", id).maybeSingle();
      if (poolError) throw new Error("Fatura takip kaydı okunamadı.");
      const endpoint = stored?.state === "ready" ? `/purchase_bills/${encodeURIComponent(stored.purchase_bill_id)}?include=details,details.product` : `/e_invoices/${encodeURIComponent(id)}/convert`;
      const response = await fetch(`${BASE_URL}/v4/${companyId}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) return NextResponse.json({ success: false, error: "Paraşüt fatura detayı alınamadı." }, { status: response.status });
      return NextResponse.json({ success: true, invoice: {
        ...payload.data?.attributes,
        gross_total: payload.data?.attributes?.gross_total ?? (payload.data?.attributes?.net_total != null && payload.data?.attributes?.total_vat != null ? Number(payload.data.attributes.net_total) - Number(payload.data.attributes.total_vat) : null),
        details: (payload.included || []).filter((item: any) => ["e_invoice_preview_detail", "purchase_bill_details"].includes(item.type)).map((item: any) => {
          const attributes = item.attributes || {};
          const base = Number(attributes.quantity) * Number(attributes.unit_price);
          const discount = attributes.discount_type === "percentage" ? base * Number(attributes.discount_value || 0) / 100 : Number(attributes.discount_value || 0);
          return { ...attributes, net_total: attributes.net_total ?? base - discount };
        }),
      } });
    }

    const page = Math.max(1, Number(new URL(req.url).searchParams.get("page")) || 1);
    const url = `${BASE_URL}/v4/${companyId}/e_invoices?page[number]=${page}&page[size]=25&scope=importable&sort=-issue_date`;

    const data = await cachedIncomingPage(`incoming:${companyId}:${page}`, async () => {
      const token = await getAccessToken();
      const res = await fetch(url, {headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},cache:"no-store"});
      const payload = await res.json();
      if (!res.ok) throw new Error(`Paraşüt fatura listesi alınamadı (HTTP ${res.status}); 1 dakika sonra yeniden deneyin.`);
      return payload;
    }, new URL(req.url).searchParams.get("refresh") === "1");

    const incomingInvoices = (data.data || []).map((item: any) => {
      const attr = item.attributes || {};

      return {
        id: item.id,
        type: item.type,
        supplier_name: attr.contact_name || attr.from_vkn || "Tedarikçi",
        attributes: {
          invoice_no: attr.external_id || item.id,
          issue_date: attr.issue_date || null,
          net_total: attr.net_total ?? null,
          total_amount: attr.net_total ?? null,
          currency: attr.currency || "TRL",
          status: attr.status || "-",
          response_type: attr.response_type || null,
          from_vkn: attr.from_vkn || null,
          from_address: attr.from_address || null,
          to_vkn: attr.to_vkn || null,
          direction: attr.direction || null,
          pdf_url: attr.pdf_url
            ? `https://uygulama.parasut.com${attr.pdf_url}`
            : null,
          html_url: attr.html_url
            ? `https://uygulama.parasut.com${attr.html_url}`
            : null,
          uuid: attr.uuid || null,
        },
        raw: item,
      };
    });

    const { data: tracked, error: trackedError } = await invoiceAdmin().from("purchase_invoice_pool").select("e_invoice_id").eq("state", "ready");
    if (trackedError) throw new Error("Fatura takip kayıtları okunamadı.");
    const trackedIds = new Set((tracked || []).map(row => row.e_invoice_id));
    const invoices = incomingInvoices.filter((row: any) => !trackedIds.has(String(row.id)));
    const reusable = page === 1 ? await reusableInvoices() : [];
    const taxNo = new URL(req.url).searchParams.get("taxNo")?.replace(/\D/g, "");
    const supplierId = new URL(req.url).searchParams.get("supplierId");
    const matchesSupplier = (row: any) => !taxNo || String(row.from_vkn || row.attributes?.from_vkn || "").replace(/\D/g, "") === taxNo || (row.reusable && row.supplier_id === supplierId);
    const selectedInvoices = invoices.filter(matchesSupplier);
    const selectedReusable = reusable.filter(matchesSupplier);
    return NextResponse.json({
      success: true,
      invoices: [...selectedReusable, ...selectedInvoices],
      reusableCount: selectedReusable.length,
      incomingInvoices: selectedInvoices,
      nextPage: data.links?.next || Number(data.meta?.total_pages) > page ? page + 1 : null,
      meta: data.meta || null,
      links: data.links || null,
      raw: data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}