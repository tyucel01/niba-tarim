import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { conversationId } = await req.json();

  if (!conversationId) {
    return NextResponse.json({
      success: false,
      error: "conversationId eksik.",
    });
  }

  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({
      archived: true,
      status: "archived",
      unread_count: 0,
    })
    .eq("id", conversationId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true });
}