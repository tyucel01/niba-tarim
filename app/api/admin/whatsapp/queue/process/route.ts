import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processQueue() {
  try {
    const { data: campaign, error: campaignError } = await supabase
      .from("whatsapp_campaigns")
      .select("*")
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (campaignError) {
      return { success: false, error: campaignError.message };
    }

    if (!campaign) {
      return { success: true, message: "Kuyruk boş" };
    }

    await supabase
      .from("whatsapp_campaigns")
      .update({
        status: "processing",
        started_at: campaign.started_at || new Date().toISOString(),
      })
      .eq("id", campaign.id);

    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const version = process.env.WHATSAPP_API_VERSION || "v23.0";

    if (!token || !phoneId) {
      return {
        success: false,
        error: "WhatsApp token veya phone number ID eksik.",
      };
    }

    const { data: items, error: itemsError } = await supabase
      .from("whatsapp_message_queue")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(15);

    if (itemsError) {
      return { success: false, error: itemsError.message };
    }

    for (const item of items || []) {
      try {
        const components: any[] = [];

        if (campaign.header_image_url) {
          components.push({
            type: "header",
            parameters: [
              {
                type: "image",
                image: {
                  link: campaign.header_image_url,
                },
              },
            ],
          });
        }

        if (
          Array.isArray(campaign.body_variables) &&
          campaign.body_variables.length > 0
        ) {
          components.push({
            type: "body",
            parameters: campaign.body_variables.map((value: string) => ({
              type: "text",
              text: value,
            })),
          });
        }

        const payload: any = {
          messaging_product: "whatsapp",
          to: item.phone,
          type: "template",
          template: {
            name: campaign.template_name,
            language: {
              code: campaign.language_code || "tr",
            },
          },
        };

        if (components.length > 0) {
          payload.template.components = components;
        }

        const res = await fetch(
          `https://graph.facebook.com/${version}/${phoneId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        const data = await res.json();

        await supabase
          .from("whatsapp_message_queue")
          .update({
            status: res.ok ? "success" : "failed",
            attempt_count: (item.attempt_count || 0) + 1,
            error: res.ok ? null : JSON.stringify(data),
            whatsapp_response: data,
            sent_at: new Date().toISOString(),
          })
          .eq("id", item.id);

await sleep(900 + Math.random() * 900);
      } catch (error) {
        await supabase
          .from("whatsapp_message_queue")
          .update({
            status: "failed",
            attempt_count: (item.attempt_count || 0) + 1,
            error: String(error),
            sent_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      }
    }

    const { count: pendingCount } = await supabase
      .from("whatsapp_message_queue")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("status", "pending");

    const { count: successCount } = await supabase
      .from("whatsapp_message_queue")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("status", "success");

    const { count: failCount } = await supabase
      .from("whatsapp_message_queue")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("status", "failed");

    const newStatus = pendingCount === 0 ? "completed" : "processing";

    await supabase
      .from("whatsapp_campaigns")
      .update({
        status: newStatus,
        success_count: successCount || 0,
        fail_count: failCount || 0,
        finished_at: pendingCount === 0 ? new Date().toISOString() : null,
      })
      .eq("id", campaign.id);

    return {
      success: true,
      campaignId: campaign.id,
      processed: items?.length || 0,
      pending: pendingCount || 0,
      successCount: successCount || 0,
      failCount: failCount || 0,
      status: newStatus,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function GET() {
  const result = await processQueue();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await processQueue();
  return NextResponse.json(result);
}