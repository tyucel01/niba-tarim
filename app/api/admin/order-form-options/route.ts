import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("order_form_options")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true, options: data || [] });
}

export async function POST(req: Request) {
  const { type, name } = await req.json();

  const cleanType = String(type || "").trim();
  const cleanName = String(name || "").trim();

  if (!cleanType || !cleanName) {
    return NextResponse.json({
      success: false,
      error: "Tip ve isim zorunlu.",
    });
  }

  const { data: existing } = await supabase
    .from("order_form_options")
    .select("id")
    .eq("type", cleanType)
    .ilike("name", cleanName)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      success: false,
      error: "Bu kayıt zaten var.",
    });
  }

  const { data, error } = await supabase
    .from("order_form_options")
    .insert({
      type: cleanType,
      name: cleanName,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true, option: data });
}