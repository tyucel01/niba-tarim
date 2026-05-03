import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { conversationId, phone, text } = await req.json();

    if (!conversationId || !phone || !text) {
      return NextResponse.json({
        success: false,
        error: "conversationId, phone ve text zorunlu.",
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
          type: "text",
          text: {
            preview_url: false,
            body: text,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: data,
      });
    }

    await supabase.from("whatsapp_conversation_messages").insert([
      {
        conversation_id: conversationId,
        phone,
        direction: "outbound",
        message_type: "text",
        message_text: text,
        raw_payload: data,
      },
    ]);

    await supabase
      .from("whatsapp_conversations")
      .update({
        status: "answered",
        archived: false,
        last_message: text,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      })
      .eq("id", conversationId);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}