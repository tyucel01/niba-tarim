import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // Telegram webhook güvenlik kontrolü
    const receivedSecret = req.headers.get(
      "x-telegram-bot-api-secret-token"
    );

    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (
      expectedSecret &&
      receivedSecret !== expectedSecret
    ) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const message = body?.message;

    // Mesaj değilse sorun yok
    if (!message) {
      return NextResponse.json({ ok: true });
    }

const chatId = String(message?.chat?.id || "");

console.log("TELEGRAM INCOMING:", {
  chatId,
  chatTitle: message?.chat?.title,
  chatType: message?.chat?.type,
  from: message?.from?.first_name,
  text: message?.text,
});

const allowedChatId = String(
  process.env.TELEGRAM_CHAT_ID || ""
);

    // Sadece bizim Telegram sohbetimizden cevap kabul et
    if (!chatId || chatId !== allowedChatId) {
      return NextResponse.json({ ok: true });
    }

    const replyToMessageId =
      message?.reply_to_message?.message_id;

    const text = message?.text?.trim();

    // Sadece Telegram'daki Niba mesajına Reply kabul ediyoruz
    if (!replyToMessageId || !text) {
      return NextResponse.json({ ok: true });
    }

    // Telegram mesajının hangi WhatsApp konuşmasına ait olduğunu bul
    const { data: mapping, error: mappingError } =
      await supabase
        .from("whatsapp_telegram_messages")
        .select(
          "conversation_id, whatsapp_phone, whatsapp_name"
        )
        .eq("telegram_chat_id", chatId)
        .eq("telegram_message_id", replyToMessageId)
        .maybeSingle();

    if (mappingError) {
      console.error("Telegram mapping error:", mappingError);

      return NextResponse.json(
        {
          ok: false,
          error: "Telegram mesaj eşleşmesi okunamadı.",
        },
        { status: 500 }
      );
    }

    if (!mapping) {
      console.log(
        "Telegram reply mapping bulunamadı:",
        replyToMessageId
      );

      return NextResponse.json({ ok: true });
    }

    if (!mapping.conversation_id || !mapping.whatsapp_phone) {
      return NextResponse.json(
        {
          ok: false,
          error: "conversation_id veya telefon eksik.",
        },
        { status: 500 }
      );
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID;

    const apiVersion =
      process.env.WHATSAPP_API_VERSION || "v23.0";

    if (!token || !phoneNumberId) {
      return NextResponse.json(
        {
          ok: false,
          error: "WhatsApp API ayarları eksik.",
        },
        { status: 500 }
      );
    }

    // WhatsApp'a gönder
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
          to: mapping.whatsapp_phone,
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
      console.error(
        "Telegram -> WhatsApp error:",
        JSON.stringify(data)
      );

      return NextResponse.json(
        {
          ok: false,
          error: data,
        },
        { status: response.status }
      );
    }

    // Paneldeki konuşmaya da outbound mesaj olarak kaydet
    await supabase
      .from("whatsapp_conversation_messages")
      .insert([
        {
          conversation_id: mapping.conversation_id,
          phone: mapping.whatsapp_phone,
          direction: "outbound",
          message_type: "text",
          message_text: text,
          raw_payload: {
            source: "telegram",
            telegram_message_id: message.message_id,
            whatsapp_response: data,
          },
        },
      ]);

    // Paneldeki konuşma durumunu güncelle
    await supabase
      .from("whatsapp_conversations")
      .update({
        status: "answered",
        archived: false,
        last_message: text,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      })
      .eq("id", mapping.conversation_id);

    return NextResponse.json({
      ok: true,
      sent: true,
    });
  } catch (error) {
    console.error("Telegram webhook error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}