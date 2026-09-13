import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "fra1";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MAX_RETRY = 3;
const BATCH_SIZE = 15;
const STUCK_MINUTES = 10;

const QUERY_RETRY_COUNT = 3;
const QUERY_RETRY_DELAY_MS = 1000;

const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function supabaseErrorDetails(error: any) {
  return {
    message: error?.message || "Bilinmeyen Supabase hatası",
    code: error?.code ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
  };
}

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
      finished_at:
        total > 0 && done >= total ? new Date().toISOString() : null,
    })
    .eq("id", campaignId);
}

async function resetStuckProcessing() {
  const stuckDate = new Date(
    Date.now() - STUCK_MINUTES * 60 * 1000,
  ).toISOString();

  const { error } = await supabase
    .from("whatsapp_message_queue")
    .update({
      status: "pending",
      processing_at: null,
    })
    .eq("status", "processing")
    .lt("processing_at", stuckDate);

  return error;
}

async function fetchPendingJobsWithRetry() {
  let lastError: any = null;

  for (let attempt = 1; attempt <= QUERY_RETRY_COUNT; attempt++) {
    const { data, error } = await supabase
      .from("whatsapp_message_queue")
      .select("id, campaign_id, attempt_count, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (!error) {
      return {
        data,
        error: null,
        attempts: attempt,
      };
    }

    lastError = error;

    console.warn(
      "[WHATSAPP_QUEUE] pending sorgusu tekrar denenecek",
      {
        attempt,
        ...supabaseErrorDetails(error),
      },
    );

    if (attempt < QUERY_RETRY_COUNT) {
      await wait(QUERY_RETRY_DELAY_MS * attempt);
    }
  }

  return {
    data: null,
    error: lastError,
    attempts: QUERY_RETRY_COUNT,
  };
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
  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(req.url);

    if (searchParams.get("secret") !== process.env.CRON_SECRET) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const resetError = await resetStuckProcessing();

    if (resetError) {
      console.warn(
        "[WHATSAPP_QUEUE] reset_stuck_processing geçici olarak başarısız",
        supabaseErrorDetails(resetError),
      );
    }

    const {
      data: pendingJobs,
      error,
      attempts: queryAttempts,
    } = await fetchPendingJobsWithRetry();

    if (error) {
      const errorInfo = supabaseErrorDetails(error);

      console.error(
        "[WHATSAPP_QUEUE] pending_jobs_query tüm denemelerde başarısız",
        {
          query_attempts: queryAttempts,
          ...errorInfo,
        },
      );

      return NextResponse.json(
        {
          ok: false,
          stage: "pending_jobs_query",
          query_attempts: queryAttempts,
          ...errorInfo,
          duration_ms: Date.now() - startedAt,
        },
        {
          status: 500,
        },
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        sent: 0,
        failed: 0,
        query_attempts: queryAttempts,
        duration_ms: Date.now() - startedAt,
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
        const attempt =
          (job?.attempt_count || pendingJob.attempt_count || 0) + 1;

        const errorMessage =
          err instanceof Error ? err.message : String(err);

        console.error(
          "[WHATSAPP_QUEUE] mesaj gönderimi başarısız",
          {
            job_id: job?.id || pendingJob.id,
            campaign_id:
              job?.campaign_id || pendingJob.campaign_id,
            attempt,
            error: errorMessage,
          },
        );

        await supabase
          .from("whatsapp_message_queue")
          .update({
            status:
              attempt >= MAX_RETRY ? "failed" : "pending",
            attempt_count: attempt,
            processing_at: null,
            error: errorMessage,
          })
          .eq("id", job?.id || pendingJob.id);

        if (job?.campaign_id || pendingJob.campaign_id) {
          touchedCampaigns.add(
            job?.campaign_id || pendingJob.campaign_id,
          );
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
      query_attempts: queryAttempts,
      duration_ms: Date.now() - startedAt,
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : String(err);

    console.error(
      "[WHATSAPP_QUEUE] beklenmeyen hata",
      err,
    );

    return NextResponse.json(
      {
        ok: false,
        stage: "unexpected_error",
        error: errorMessage,
        duration_ms: Date.now() - startedAt,
      },
      {
        status: 500,
      },
    );
  }
}