import { salesPart, purchaseAllocation } from "@/lib/orders/sales-progress";
import { createHash } from "node:crypto";
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
  invoiceTons,
  sourceLineId,
  sourceOnly = false,
}: {
  order: any;
  customerId: string;
  purchaseBill: any;
  invoiceTons?: number;
  sourceLineId?: string;
  sourceOnly?: boolean;
}) {
  const included = purchaseBill?.included || [];

  const details = included.filter(
    (x: any) =>
      x?.type === "purchase_bill_details" ||
      x?.type === "sales_invoice_details"
  );

  if (!details.length) throw new Error("Alış faturası kalemleri alınamadı; satış faturası oluşturulmadı.");
  const purchaseCurrency = purchaseBill.data?.attributes?.currency || "TRL";
  if (!["TRL", "TRY"].includes(purchaseCurrency)) throw new Error("Alış faturası döviz cinsinde; TL sipariş fiyatıyla otomatik hesaplanamaz.");
  const part = salesPart(order, invoiceTons);
  const targetTotal = part.invoiceAmount;
  if (!(targetTotal > 0)) throw new Error("KDV dahil satış tutarı geçerli değil.");
  const allocated = purchaseAllocation(order);
  const purchaseTotal = toNumber(purchaseBill.data?.attributes?.net_total);
  const sourceShare = allocated / purchaseTotal;
  if (!(sourceShare > 0) || sourceShare > 1 || !Number.isFinite(sourceShare)) throw new Error("Siparişe ayrılan fatura tutarı doğrulanamadı.");
  const allSourceLines = details.map((row: any) => {
    const attr = row.attributes || {};
    if (attr.vat_rate == null || attr.vat_rate === "" || !Number.isFinite(Number(attr.vat_rate))) throw new Error("Alış faturasında KDV oranı eksik/geçersiz. Sıfır varsayılmadı.");
    const quantity = toNumber(attr.quantity);
    const vatRate = toNumber(attr.vat_rate);
    if (!(quantity > 0) || vatRate < 0 || vatRate > 100) throw new Error("Alış faturasında miktar veya KDV oranı geçersiz.");
    const net = attr.net_total != null ? toNumber(attr.net_total) : quantity * toNumber(attr.unit_price);
    if (!(net > 0)) throw new Error("Alış faturası kalem tutarı geçersiz.");
    if (toNumber(attr.vat_withholding_rate) || toNumber(attr.excise_duty_rate) || toNumber(attr.communications_tax_rate) || toNumber(attr.accommodation_tax_rate)) throw new Error("Ek vergi/tevkifat içeren fatura için otomatik satış hesabı desteklenmiyor; Paraşüt üzerinde kontrol edin.");
    const productId = row.relationships?.product?.data?.id;
    const product = included.find((item: any) => item.type === "products" && String(item.id) === String(productId));
    const unit = clean(attr.unit || attr.unit_name || product?.attributes?.unit);
    if (!unit) throw new Error("Alış faturasında birim bilgisi eksik.");
    const normalizedUnit = unit.toLocaleLowerCase("tr-TR").replace(/\./g, "");
    const tons = ["kg","kilogram","kilogramme"].includes(normalizedUnit) ? quantity / 1000 : ["ton","t","tonne","tonnes","mt"].includes(normalizedUnit) ? quantity : 0;
    if (!(tons > 0)) throw new Error("Alış faturasında kg/ton dışında birim var. Teslim tonajına göre otomatik fatura oluşturulamaz.");
    return { row, quantity, tons, vatRate, net, unit, productId, name: clean(attr.description || product?.attributes?.name || attr.product_name) };
  });
  const choices = allSourceLines.map((line: any) => ({ id: String(line.row.id || ""), name: line.name, tons: line.tons, quantity: line.quantity, unit: line.unit, vatRate: line.vatRate, amount: line.net * (1 + line.vatRate / 100) }));
  if (choices.some((line: any) => !line.id)) throw new Error("Alış faturası kalem kimlikleri alınamadı. Faturayı yeniden yükleyin.");
  if (sourceOnly) return { payload: null, preview: { sourceLines: choices } as any };
  if (!sourceLineId) throw new Error("Önce alış faturasından bu siparişe ait kalemi seçin.");
  const sourceLines = allSourceLines.filter((line: any) => String(line.row.id) === sourceLineId);
  if (sourceLines.length !== 1) throw new Error("Seçilen kalem alış faturasında bulunamadı. Kalemleri yeniden yükleyin.");
  const sourceTons = sourceLines.reduce((sum: number, line: any) => sum + line.tons, 0);
  if (part.tons > sourceTons + .000001) throw new Error("Alış faturasının ürün miktarı teslim tonajını karşılamıyor. Faturayı kontrol edin.");
  const share = part.invoiceTons / sourceTons;
  const sourceTotal = sourceLines.reduce((sum: number, line: any) => sum + line.net * (1 + line.vatRate / 100), 0);
  // Preserve each purchase line's share of the total; the order's selling price is VAT-inclusive.
  const factor = targetTotal / sourceTotal;
  const invoiceDetails = sourceLines.map((line: any) => ({
    type: "sales_invoice_details",
    attributes: {
      description: line.name,
      quantity: Number((line.quantity * share).toFixed(8)),
      unit: line.unit,
      unit_price: Number((line.net * factor / (line.quantity * share)).toFixed(8)),
      vat_rate: line.vatRate,
      discount_type: "amount",
      discount_value: 0,
    },
    ...(line.productId ? { relationships: { product: { data: { id: String(line.productId), type: "products" } } } } : {}),
  }));
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const subtotal = invoiceDetails.reduce((sum: number, line: any) => sum + round(line.attributes.quantity * line.attributes.unit_price), 0);
  const vatTotal = invoiceDetails.reduce((sum: number, line: any) => sum + round(round(line.attributes.quantity * line.attributes.unit_price) * line.attributes.vat_rate / 100), 0);
  const previewTotal = round(subtotal + vatTotal);
  if (Math.abs(previewTotal - targetTotal) > 0.05) throw new Error("Kalem yuvarlamaları sipariş toplamıyla uyuşmuyor. Faturayı Paraşüt üzerinde kontrol edin.");

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
        subtotal: round(d.attributes.quantity * d.attributes.unit_price),
        vat_amount: round(round(d.attributes.quantity * d.attributes.unit_price) * d.attributes.vat_rate / 100),
        purchase_unit_price: toNumber(sourceLines[invoiceDetails.indexOf(d)].row.attributes.unit_price),
      })),
      estimatedTotal: previewTotal,
      subtotal: round(subtotal),
      vatTotal: round(vatTotal),
      targetTotal,
      sourceLineTons: sourceTons,
      invoiceTons: part.invoiceTons,
      billedTons: part.billedTons,
      remainingTons: part.remainingTons - part.invoiceTons,
      remainingTotal: Math.round((part.remainingTotal - targetTotal) * 100) / 100,
      currency: "TRY",
      allocatedPurchaseAmount: allocated,
      sourcePurchaseTotal: purchaseTotal,
      sourceShare,
      partShare: part.partShare,
      pricingNote: "Yalnız seçtiğiniz alış kalemi, belirlediğiniz teslim tonajı kadar satışa alındı. Birim ve KDV oranları korunur; satış fiyatı KDV dahildir. Ürünleri ve miktarları kontrol edin.",
    },
  };
}

async function createEInvoice({
  token,
  companyId,
  salesInvoiceId,
  recipientAlias,
  hasZeroVat,
}: {
  token: string;
  companyId: string;
  salesInvoiceId: string;
  recipientAlias: string;
  hasZeroVat: boolean;
}) {
  const payload = {
    data: {
      id: null,
      type: "e_invoices",
      attributes: {
        vat_withholding_params: [],
        vat_exemption_reason_code: hasZeroVat ? "326" : null,
        vat_exemption_reason: hasZeroVat ? "13/ı Gıda, Tarım ve Hayvancılık Bakanlığı Tarafından Tescil Edilmiş Gübrelerin Teslimi" : null,
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

    if (!customerId && !body.sourceOnly) {
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

    const part = salesPart(order, body.invoiceTons == null ? undefined : Number(body.invoiceTons));
    if (part.blocked) return NextResponse.json({success:false,error:"Önceki satış faturası resmileştirme kontrolü bekliyor. Paraşüt üzerinde kontrol edin."},{status:409});
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
      invoiceTons: part.invoiceTons,
      sourceLineId: clean(body.sourceLineId),
      sourceOnly: Boolean(body.sourceOnly) && !confirm,
    });

    const { data: assignments, error: assignmentError } = await supabase.from("order_purchase_line_assignments").select("order_id,line_id,source_tons,siparisler!inner(teslimOlanTonaj,matched_purchase_invoice_id)").eq("purchase_bill_id", String(order.matched_purchase_invoice_id));
    if (assignmentError) throw new Error("Kalemlerin kalan miktarı alınamadı. Yeniden deneyin.");
    const own = (assignments || []).find((a: any) => a.order_id === order.id);
    const { data: priorOrders, error: priorError } = await supabase.from("siparisler").select("id,sales_invoice_id,sales_invoiced_tonnage").eq("matched_purchase_invoice_id", order.matched_purchase_invoice_id);
    if (priorError) throw new Error("Geçmiş fatura miktarları kontrol edilemedi.");
    const unknownUsage = (priorOrders || []).some((o: any) => (o.sales_invoice_id || Number(o.sales_invoiced_tonnage)>0) && !(assignments || []).some((a: any) => a.order_id === o.id));
    if (body.sourceOnly && !confirm) {
      const lines = preview.sourceLines.map((line: any) => {
        const used = (assignments || []).filter((a: any) => a.line_id === line.id && a.order_id !== order.id && a.siparisler?.matched_purchase_invoice_id === order.matched_purchase_invoice_id).reduce((sum: number, a: any) => sum + Number(a.siparisler?.teslimOlanTonaj || 0), 0);
        return { ...line, remainingTons: Math.max(0, line.tons-used-(own?.line_id === line.id ? Number(order.sales_invoiced_tonnage || 0) : 0)), availableForOrder: Math.max(0,line.tons-used) };
      });
      return NextResponse.json({success:true,sourceLines:lines,selectedLineId:own?.line_id || "",selectionLocked:Boolean(own && Number(order.sales_invoiced_tonnage)>0),warning:unknownUsage ? "Bu alış faturasının geçmiş satışlarında kullanılan kalemler kayıtlı değil. Miktarları Paraşüt üzerinde kontrol etmeden yeni fatura kesilemez." : ""});
    }
    if (!payload) throw new Error("Fatura kalemi seçilmedi.");
    const usedLineTons = (assignments || []).filter((a: any) => a.line_id === clean(body.sourceLineId) && a.order_id !== order.id && a.siparisler?.matched_purchase_invoice_id === order.matched_purchase_invoice_id).reduce((sum: number,a: any)=>sum+Number(a.siparisler?.teslimOlanTonaj || 0),0);
    if (usedLineTons + Number(order.teslimOlanTonaj || 0) > preview.sourceLineTons + .000001) throw new Error("Seçilen kalemin kalan tonajı teslim edilen sipariş için yetersiz.");
    if (unknownUsage) throw new Error("Geçmiş satışların hangi alış kaleminden kesildiği doğrulanamadı. Paraşüt üzerinde mevcut faturaları kontrol edin; yeni fatura oluşturulmadı.");
    if (own && Number(order.sales_invoiced_tonnage)>0 && own.line_id !== clean(body.sourceLineId)) throw new Error("Kısmen faturalanmış siparişin ürün kalemi değiştirilemez.");
    const fingerprint = createHash("sha256").update(JSON.stringify({payload,sourceLineId:clean(body.sourceLineId)})).digest("hex");
    if (confirm && body.previewFingerprint !== fingerprint) return NextResponse.json({ success: false, error: "Fatura bilgileri önizlemeden sonra değişti. Önizlemeyi yeniden oluşturun." }, { status: 409 });
    if (!confirm) {
      return NextResponse.json({
        success: true,
        mode: "preview",
        message:
          "Önizleme hazır. Resmileştirmeden/oluşturmadan önce kullanıcı onayı gerekiyor.",
        preview: { ...preview, fingerprint },
      });
    }

    const { recipientAlias } = await getCustomerRecipientAlias(token, companyId, customerId);
    if (!recipientAlias) return NextResponse.json({success:false,error:"Müşterinin e-fatura posta kutusu bulunamadı. Fatura oluşturulmadı; cari kartı kontrol edin."},{status:400});
    const { data: reservationId, error: reserveError } = await supabase.rpc("reserve_order_sales_line_part", {p_line_id:clean(body.sourceLineId),p_source_tons:preview.sourceLineTons,p_order_id:siparisId,p_tons:part.invoiceTons,p_amount:preview.estimatedTotal,p_customer_id:customerId,p_fingerprint:fingerprint});
    if (reserveError) return NextResponse.json({success:false,error:reserveError.message},{status:409});

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
      if (created.status >= 400 && created.status < 500 && created.status !== 408) await supabase.rpc("finish_order_sales_part",{p_part_id:reservationId,p_state:"failed"});
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
      null;

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

    const { error: recordError } = await supabase.rpc("record_order_sales_part",{p_part_id:reservationId,p_invoice_id:String(salesInvoiceId),p_invoice_no:salesInvoiceNo ? String(salesInvoiceNo) : null});
    if (recordError) throw new Error("Fatura Paraşüt'te oluşturuldu fakat takip kaydı tamamlanamadı. Yeniden kesmeyin; Paraşüt üzerinde kontrol edin.");

    const eInvoice = await createEInvoice({
      token,
      companyId,
      salesInvoiceId: String(salesInvoiceId),
      recipientAlias,
      hasZeroVat: preview.details.some((line: any) => line.vat_rate === 0),
    });

    console.log("PARASUT_E_INVOICE_RESPONSE", JSON.stringify(eInvoice, null, 2));

    if (!eInvoice.ok) {
      await supabase.rpc("finish_order_sales_part",{p_part_id:reservationId,p_state:"needs_review"});

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

    const {error:finishError} = await supabase.rpc("finish_order_sales_part",{p_part_id:reservationId,p_state:"issued"});
    if (finishError) throw new Error("Fatura oluşturuldu; resmileştirme takip kaydı kontrol bekliyor. Tekrar kesmeyin.");

    return NextResponse.json({
      success: true,
      message: "Satış faturası oluşturuldu ve e-fatura resmileştirme başlatıldı.",
      invoiceTons:part.invoiceTons,
      remainingTons:part.remainingTons-part.invoiceTons,
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
