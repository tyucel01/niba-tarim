import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("status", "waiting")
    .order("last_message_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({
    success: true,
    conversations: data || [],
  });
}