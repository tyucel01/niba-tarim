import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("whatsapp_groups")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true, groups: data });
}

export async function POST(req: Request) {
  const { name } = await req.json();
  const cleanName = String(name || "").trim();

  if (!cleanName) {
    return NextResponse.json({ success: false, error: "Grup adı zorunlu." });
  }

  const { data: existingGroup } = await supabase
    .from("whatsapp_groups")
    .select("id")
    .ilike("name", cleanName)
    .maybeSingle();

  if (existingGroup) {
    return NextResponse.json({
      success: false,
      error: "Bu isimde bir grup zaten var.",
    });
  }

  const { data, error } = await supabase
    .from("whatsapp_groups")
    .insert([{ name: cleanName }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true, group: data });
}