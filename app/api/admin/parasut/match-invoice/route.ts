import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ success: false, error: "Fatura eşleştirmesini siparişin Fatura adımında yapın. Cari, gider kaydı ve kalan tutar birlikte kontrol edilir." }, { status: 409 });
}
