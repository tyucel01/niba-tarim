import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateCampaignCounts(campaignId: string, totalCount: number) {
  const { count: successCount } = await supabase
    .from("whatsapp_message_queue")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "success");

  const { count: failCount } = await supabase
    .from("whatsapp_message_queue")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "failed");

  const doneCount = (successCount || 0) + (failCount || 0);

  await supabase
    .from("whatsapp_campaigns")
    .update({
      success_count: successCount || 0,
      fail_count: failCount || 0,
      status: doneCount >= totalCount ? "completed" : "processing",
      finished_at: doneCount >= totalCount ? new Date().toISOString() : null,
    })
    .eq("id", campaignId);
}

async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode,
  headerImageUrl,
  bodyVariables,
}: {
  to: string;
  templateName: string;
  languageCode?: string;
  headerImageUrl?: string | null;
  bodyVariables?: string[];
}) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v23.0";

  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp API ayarları eksik.");
  }

  const components: any[] = [];

  // HEADER
  if (headerImageUrl) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "image",
          image: {
            link: headerImageUrl,
          },
        },
      ],
    });
  }

  // BODY (değişkenler)
  if (bodyVariables && bodyVariables.length > 0) {
    components.push({
      type: "body",
      parameters: bodyVariables.map((v) => ({
        type: "text",
        text: v || "",
      })),
    });
  }

  const templatePayload: any = {
    name: templateName,
    language: {
      code: languageCode || "tr",
    },
  };

  if (components.length > 0) {
    templatePayload.components = components;
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
        template: templatePayload,
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

  // 🔥 EN KRİTİK KISIM BURASI
  const { data: jobs, error } = await supabase
    .from("whatsapp_message_queue")
    .select(`
      *,
campaign:whatsapp_campaigns (
  template_name,
  language_code,
  header_image_url,
  body_variables,
  total_count
)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  let sent = 0;
  let failed = 0;

  for (const job of jobs || []) {
    try {
const result = await sendWhatsAppTemplate({
  to: job.phone,
  templateName: job.campaign?.template_name,
  languageCode: job.campaign?.language_code || "tr",
  headerImageUrl: job.campaign?.header_image_url || null,
  bodyVariables: job.campaign?.body_variables || [],
});

const { error: updateError } = await supabase
  .from("whatsapp_message_queue")
  .update({
    status: "success",
    sent_at: new Date().toISOString(),
    whatsapp_response: result,
    error: null,
    attempt_count: (job.attempt_count || 0) + 1,
  })
  .eq("id", job.id);

if (updateError) {
  throw new Error("Status güncellenemedi: " + updateError.message);
}
await updateCampaignCounts(
  job.campaign_id,
  job.campaign?.total_count || 0
);
sent++;
    } catch (err: any) {
const { error: failUpdateError } = await supabase
  .from("whatsapp_message_queue")
  .update({
    status: "failed",
    error: err instanceof Error ? err.message : "Bilinmeyen hata",
    attempt_count: (job.attempt_count || 0) + 1,
  })
  .eq("id", job.id);

if (failUpdateError) {
  console.error("Failed status güncellenemedi:", failUpdateError.message);
}
await updateCampaignCounts(
  job.campaign_id,
  job.campaign?.total_count || 0
);
failed++;

    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    found: jobs?.length || 0,
  });
}