import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;

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
    .eq("group_id", id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true, members: data || [] });
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const { contactId } = await request.json();

  if (!contactId) {
    return NextResponse.json({ success: false, error: "Kişi seçilmedi." });
  }

  const { data, error } = await supabase
    .from("whatsapp_group_members")
    .insert([{ group_id: id, contact_id: contactId }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true, member: data });
}