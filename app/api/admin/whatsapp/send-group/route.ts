import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  const { groupId, templateName, languageCode } = await req.json();

  if (!groupId || !templateName) {
    return NextResponse.json({
      success: false,
      error: "Grup ve şablon zorunlu.",
    });
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v23.0";

  if (!token || !phoneNumberId) {
    return NextResponse.json({
      success: false,
      error: "WhatsApp API ayarları eksik.",
    });
  }

  const { data: members, error } = await supabase
    .from("whatsapp_group_members")
    .select(`
      id,
      whatsapp_contacts (
        id,
        name,
        phone
      )
    `)
    .eq("group_id", groupId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  let successCount = 0;
  let failCount = 0;

  const results: any[] = [];

  for (const member of members || []) {
    const contact: any = member.whatsapp_contacts;
    const phone = String(contact?.phone || "").replace(/\D/g, "");

    if (!phone) {
      failCount++;
      results.push({
        name: contact?.name || "-",
        phone: "-",
        status: "failed",
        error: "Telefon yok",
      });
      continue;
    }

    try {
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
            to: phone,
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

      if (response.ok) {
        successCount++;
        results.push({
          name: contact?.name || "-",
          phone,
          status: "success",
          response: data,
        });
      } else {
        failCount++;
        results.push({
          name: contact?.name || "-",
          phone,
          status: "failed",
          error: data,
        });
      }

      await sleep(700);
    } catch (err) {
      failCount++;
      results.push({
        name: contact?.name || "-",
        phone,
        status: "failed",
        error: String(err),
      });
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      total: members?.length || 0,
      successCount,
      failCount,
    },
    results,
  });
}