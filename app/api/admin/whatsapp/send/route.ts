import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode,
}: {
  to: string;
  templateName: string;
  languageCode?: string;
}) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v23.0";

  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp API ayarları eksik.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode || "tr",
          },
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: jobs, error } = await supabase
    .from("whatsapp_message_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    const { data: lockedRows, error: lockError } = await supabase
      .from("whatsapp_message_queue")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id");

    if (lockError || !lockedRows || lockedRows.length === 0) {
      continue;
    }

    try {
      await sendWhatsAppTemplate({
        to: job.to,
        templateName: job.template_name,
        languageCode: job.language_code || "tr",
      });

      await supabase
        .from("whatsapp_message_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", job.id);

      sent++;
    } catch (err) {
      await supabase
        .from("whatsapp_message_queue")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Bilinmeyen hata",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    message: "WhatsApp queue işlendi",
    found: jobs?.length ?? 0,
    sent,
    failed,
  });
}