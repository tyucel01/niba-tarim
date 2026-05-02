import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { groupId, contactId } = await req.json();

  if (!groupId || !contactId) {
    return NextResponse.json({
      success: false,
      error: "groupId veya contactId eksik.",
    });
  }

  const { error } = await supabase
    .from("whatsapp_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("contact_id", contactId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true });
}