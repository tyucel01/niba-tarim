import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Context = {
  params: Promise<{ id: string }>;
};

function cleanPhone(phone: string) {
  return String(phone || "").replace(/\s/g, "").trim();
}

export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  const { name, phone, note } = await req.json();

  const cleanedPhone = cleanPhone(phone);

  if (!cleanedPhone) {
    return NextResponse.json({
      success: false,
      error: "Telefon numarası zorunlu.",
    });
  }

  const { data: existing } = await supabase
    .from("whatsapp_contacts")
    .select("id")
    .eq("phone", cleanedPhone)
    .neq("id", id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      success: false,
      error: "Bu telefon numarası başka bir kişide kayıtlı.",
    });
  }

  const { data, error } = await supabase
    .from("whatsapp_contacts")
    .update({
      name,
      phone: cleanedPhone,
      note,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  await supabase
    .from("whatsapp_conversations")
    .update({
      name: name || "WhatsApp Kişisi",
      phone: cleanedPhone,
    })
    .eq("contact_id", id);

  return NextResponse.json({ success: true, contact: data });
}

export async function DELETE(req: Request, context: Context) {
  const { id } = await context.params;

  await supabase.from("whatsapp_group_members").delete().eq("contact_id", id);
  await supabase.from("whatsapp_message_queue").delete().eq("contact_id", id);
  await supabase.from("whatsapp_conversation_messages").delete().eq("contact_id", id);
  await supabase.from("whatsapp_conversations").delete().eq("contact_id", id);

  const { error } = await supabase.from("whatsapp_contacts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true });
}