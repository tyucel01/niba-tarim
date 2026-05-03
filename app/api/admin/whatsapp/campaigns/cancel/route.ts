import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { campaignId } = await req.json();

  if (!campaignId) {
    return NextResponse.json({
      success: false,
      error: "campaignId eksik.",
    });
  }

  const { error } = await supabase
    .from("whatsapp_message_queue")
    .update({
      status: "cancelled",
      error: "Kampanya admin tarafından iptal edildi.",
    })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  await supabase
    .from("whatsapp_campaigns")
    .update({
      status: "cancelled",
      finished_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return NextResponse.json({ success: true });
}