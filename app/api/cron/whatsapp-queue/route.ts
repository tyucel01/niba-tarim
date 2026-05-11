import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MAX_RETRY = 3;
const BATCH_SIZE = 15;
const STUCK_MINUTES = 10;

async function updateCampaign(campaignId: string) {
  const { count: successCount = 0 } = await supabase
    .from("whatsapp_message_queue")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "success");

  const { count: failCount = 0 } = await supabase
    .from("whatsapp_message_queue")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "failed");

  const { count: totalCount = 0 } = await supabase
    .from("whatsapp_message_queue")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const success = successCount || 0;
  const fail = failCount || 0;
  const total = totalCount || 0;
  const done = success + fail;

  await supabase
    .from("whatsapp_campaigns")
    .update({
      success_count: success,
      fail_count: fail,
      total_count: total,
      status: total > 0 && done >= total ? "completed" : "processing",
      finished_at: total > 0 && done >= total ? new Date().toISOString() : null,
    })
    .eq("id", campaignId);
}

async function resetStuckProcessing() {
  const stuckDate = new Date(
    Date.now() - STUCK_MINUTES * 60 * 1000,
  ).toISOString();

  await supabase
    .from("whatsapp_message_queue")
    .update({
      status: "pending",
      processing_at: null,
    })
    .eq("status", "processing")
    .lt("processing_at", stuckDate);
}

async function sendTemplate({
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

  if (headerImageUrl) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "image",
          image: { link: headerImageUrl },
        },
      ],
    });
  }

  if (bodyVariables && bodyVariables.length > 0) {
    components.push({
      type: "body",
      parameters: bodyVariables.map((value) => ({
        type: "text",
        text: value || "",
      })),
    });
  }

  const templatePayload: any = {
    name: templateName,
    language: { code: languageCode || "tr" },
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
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

async function claimJob(jobId: string) {
  const { data, error } = await supabase
    .from("whatsapp_message_queue")
    .update({
      status: "processing",
      processing_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "pending")
    .select(`
      *,
      campaign:whatsapp_campaigns (
        id,
        template_name,
        language_code,
        header_image_url,
        body_variables
      )
    `)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    if (searchParams.get("secret") !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await resetStuckProcessing();

    const { data: pendingJobs, error } = await supabase
      .from("whatsapp_message_queue")
      .select("id, campaign_id, attempt_count, created_at")
      .eq("status", "pending")
      .or(`attempt_count.is.null,attempt_count.lt.${MAX_RETRY}`)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        sent: 0,
        failed: 0,
      });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    const touchedCampaigns = new Set<string>();

    for (const pendingJob of pendingJobs) {
      let job: any = null;

      try {
        job = await claimJob(pendingJob.id);

        if (!job) {
          skipped++;
          continue;
        }

        if (job.campaign_id) {
          touchedCampaigns.add(job.campaign_id);
        }

        const result = await sendTemplate({
          to: job.phone,
          templateName: job.campaign?.template_name,
          languageCode: job.campaign?.language_code || "tr",
          headerImageUrl: job.campaign?.header_image_url || null,
          bodyVariables: job.campaign?.body_variables || [],
        });

        await supabase
          .from("whatsapp_message_queue")
          .update({
            status: "success",
            sent_at: new Date().toISOString(),
            processing_at: null,
            error: null,
            whatsapp_response: result,
          })
          .eq("id", job.id);

        sent++;
      } catch (err) {
        const attempt = (job?.attempt_count || pendingJob.attempt_count || 0) + 1;
        const errorMessage = err instanceof Error ? err.message : String(err);

        await supabase
          .from("whatsapp_message_queue")
          .update({
            status: attempt >= MAX_RETRY ? "failed" : "pending",
            attempt_count: attempt,
            processing_at: null,
            error: errorMessage,
          })
          .eq("id", job?.id || pendingJob.id);

        if (job?.campaign_id || pendingJob.campaign_id) {
          touchedCampaigns.add(job?.campaign_id || pendingJob.campaign_id);
        }

        failed++;
      }
    }

    for (const campaignId of touchedCampaigns) {
      await updateCampaign(campaignId);
    }

    return NextResponse.json({
      ok: true,
      batch_size: BATCH_SIZE,
      processed: pendingJobs.length,
      sent,
      failed,
      skipped,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}