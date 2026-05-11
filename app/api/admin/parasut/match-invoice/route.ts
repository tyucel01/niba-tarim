    import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      eInvoiceId,
      invoiceNo,
      invoiceUuid,
      supplierName,
      supplierVkn,
      supplierId,
      siparisId,
      invoiceTotal,
    } = body;

    if (!eInvoiceId || !siparisId) {
      return NextResponse.json(
        { success: false, error: "eInvoiceId ve siparisId zorunlu." },
        { status: 400 },
      );
    }

    const { error: matchError } = await supabase
      .from("parasut_invoice_matches")
      .upsert(
        {
          e_invoice_id: eInvoiceId,
          invoice_no: invoiceNo || null,
          invoice_uuid: invoiceUuid || null,
          supplier_name: supplierName || null,
          supplier_vkn: supplierVkn || null,
          supplier_id: supplierId || null,
          siparis_id: siparisId,
          match_type: "manual",
          match_score: 100,
          status: "matched",
        },
        { onConflict: "e_invoice_id" },
      );

    if (matchError) {
      return NextResponse.json(
        { success: false, error: matchError.message },
        { status: 500 },
      );
    }

    const { error: siparisError } = await supabase
      .from("siparisler")
      .update({
        matched_purchase_invoice_id: eInvoiceId,
        matched_purchase_invoice_no: invoiceNo || null,
        matched_purchase_invoice_total: invoiceTotal || null,
        matched_purchase_invoice_at: new Date().toISOString(),
      })
      .eq("id", siparisId);

    if (siparisError) {
      return NextResponse.json(
        { success: false, error: siparisError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
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