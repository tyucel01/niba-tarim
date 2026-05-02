import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data } = await supabase
    .from("whatsapp_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const fallback = {
    whatsapp_token: process.env.WHATSAPP_TOKEN || "",
    whatsapp_phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    whatsapp_api_version: process.env.WHATSAPP_API_VERSION || "v23.0",
    whatsapp_waba_id:
      process.env.WHATSAPP_WABA_ID ||
      process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ||
      "",
    whatsapp_webhook_verify_token:
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
  };

  return NextResponse.json({
    success: true,
    settings: {
      whatsapp_token: data?.whatsapp_token || fallback.whatsapp_token,
      whatsapp_phone_number_id:
        data?.whatsapp_phone_number_id || fallback.whatsapp_phone_number_id,
      whatsapp_api_version:
        data?.whatsapp_api_version || fallback.whatsapp_api_version,
      whatsapp_waba_id: data?.whatsapp_waba_id || fallback.whatsapp_waba_id,
      whatsapp_webhook_verify_token:
        data?.whatsapp_webhook_verify_token ||
        fallback.whatsapp_webhook_verify_token,
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  const { error } = await supabase.from("whatsapp_settings").upsert({
    id: 1,
    whatsapp_token: body.whatsapp_token || null,
    whatsapp_phone_number_id: body.whatsapp_phone_number_id || null,
    whatsapp_api_version: body.whatsapp_api_version || "v23.0",
    whatsapp_waba_id: body.whatsapp_waba_id || null,
    whatsapp_webhook_verify_token:
      body.whatsapp_webhook_verify_token || null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}