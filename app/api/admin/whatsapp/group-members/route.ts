import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");

  if (!groupId) {
    return NextResponse.json({ success: false, error: "groupId yok" });
  }

  const { data, error } = await supabase
    .from("whatsapp_group_members")
    .select(`
      id,
      contact_id,
      whatsapp_contacts (
        id,
        name,
        phone,
        note
      )
    `)
    .eq("group_id", groupId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true, members: data || [] });
}

export async function POST(req: Request) {
  const { groupId, contactId } = await req.json();

  if (!groupId) {
    return NextResponse.json({ success: false, error: "groupId yok" });
  }

  if (!contactId) {
    return NextResponse.json({ success: false, error: "contactId yok" });
  }

  const { data: existing } = await supabase
    .from("whatsapp_group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      success: false,
      error: "Bu kişi zaten bu grupta var.",
    });
  }

  const { data, error } = await supabase
    .from("whatsapp_group_members")
    .insert([{ group_id: groupId, contact_id: contactId }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true, member: data });
}