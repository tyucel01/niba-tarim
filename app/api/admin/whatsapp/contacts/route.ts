import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("whatsapp_contacts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, contacts: data });
}

export async function POST(req: Request) {
  const { name, phone, note } = await req.json();

  if (!phone) {
    return NextResponse.json(
      { success: false, error: "Telefon numarası zorunlu." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("whatsapp_contacts")
    .insert([{ name, phone, note }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, contact: data });
}