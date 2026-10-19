import { cardLedgerToken as getParasutToken, createCardLedgerTransaction as createParasutContactTransaction } from "@/lib/parasut/card-ledger";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://api.parasut.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteParasutTransaction(transactionId: string) {
  const companyId = process.env.PARASUT_COMPANY_ID;
  if (!companyId) throw new Error("PARASUT_COMPANY_ID eksik");

  const token = await getParasutToken();

  const response = await fetch(
    `${BASE_URL}/v4/${companyId}/transactions/${transactionId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  if (response.status === 204) {
    return { ok: true };
  }

  let json: any = {};
  try {
    json = await response.json();
  } catch {}

  if (!response.ok) {
    throw new Error(
      JSON.stringify({
        message: "Paraşüt kaydı silinemedi",
        detail: json,
      })
    );
  }

  return json;
}

export async function GET() {
  const { data, error } = await supabase
    .from("parasut_card_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, transactions: data || [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      party_type,
      transaction_type,
      parasut_contact_id,
      company_name,
      transaction_date,
      amount,
      description,
      payment_channel,
    } = body;

    if (!party_type || !transaction_type || !parasut_contact_id || !transaction_date || !amount) {
      return NextResponse.json({ ok: false, error: "Zorunlu alanlar eksik" }, { status: 400 });
    }

    const parasutResult = await createParasutContactTransaction({
      contactId: parasut_contact_id,
      transactionType: transaction_type,
      date: transaction_date,
      amount: Number(amount),
      description: description || payment_channel || "Kart çekimi",
    });

    const parasutTransactionId = parasutResult?.data?.id || null;

    const { data, error } = await supabase
      .from("parasut_card_transactions")
      .insert({
        party_type,
        transaction_type,
        parasut_contact_id,
        company_name,
        transaction_date,
        amount: Number(amount),
        description,
        payment_channel,
        status: "parasut_processed",
        parasut_transaction_id: parasutTransactionId,
        parasut_response: parasutResult,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, transaction: data });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Kayıt oluşturulamadı",
        detail: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "Kayıt ID eksik" }, { status: 400 });
    }

    const { data: existing, error: findError } = await supabase
      .from("parasut_card_transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (findError) {
      return NextResponse.json({ ok: false, error: findError.message }, { status: 500 });
    }

    if (existing?.pos_payment_id) return NextResponse.json({ok:false,error:"Paratika tahsilatı bu ekrandan silinemez. Banka iptal/iade ve Paraşüt mutabakatını birlikte kontrol edin."},{status:409});
    if (existing?.parasut_transaction_id) {
      await deleteParasutTransaction(existing.parasut_transaction_id);
    }

    const { error } = await supabase
      .from("parasut_card_transactions")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Kayıt silinemedi",
        detail: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}