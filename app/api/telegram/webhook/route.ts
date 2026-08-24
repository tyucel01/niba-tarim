import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // Telegram webhook güvenliği
    const receivedSecret = req.headers.get(
      "x-telegram-bot-api-secret-token"
    );

    const expectedSecret =
      process.env.TELEGRAM_WEBHOOK_SECRET;

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

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(
      message?.chat?.id || ""
    );

    const allowedChatId = String(
      process.env.TELEGRAM_CHAT_ID || ""
    );

    // Sadece Niba Telegram grubundan kabul et
    if (
      !chatId ||
      !allowedChatId ||
      chatId !== allowedChatId
    ) {
      return NextResponse.json({ ok: true });
    }

    // Bot mesajlarını tekrar işleme
    if (message?.from?.is_bot) {
      return NextResponse.json({ ok: true });
    }

    const text =
      message?.text?.trim();

    if (!text) {
      return NextResponse.json({ ok: true });
    }

    const replyToMessageId =
      message?.reply_to_message?.message_id;

    const messageThreadId =
      message?.message_thread_id;

    // General içine normal mesaj yazılırsa işlem yapma.
    // Ya bot mesajına Reply olacak ya da bir Topic içinde olacak.
    if (
      !replyToMessageId &&
      !messageThreadId
    ) {
      return NextResponse.json({ ok: true });
    }

    let mapping: any = null;
    let mappingError: any = null;

    // 1) Eski Reply yöntemi
    if (replyToMessageId) {
      const result = await supabase
        .from("whatsapp_telegram_messages")
        .select(
          "conversation_id, whatsapp_phone, whatsapp_name, telegram_thread_id"
        )
        .eq(
          "telegram_chat_id",
          chatId
        )
        .eq(
          "telegram_message_id",
          replyToMessageId
        )
        .maybeSingle();

      mapping = result.data;
      mappingError = result.error;
    }

    // 2) Topic içinden direkt mesaj
    if (
      !mapping &&
      messageThreadId
    ) {
      const result = await supabase
        .from("whatsapp_telegram_messages")
        .select(
          "conversation_id, whatsapp_phone, whatsapp_name, telegram_thread_id"
        )
        .eq(
          "telegram_chat_id",
          chatId
        )
        .eq(
          "telegram_thread_id",
          messageThreadId
        )
        .order(
          "created_at",
          { ascending: false }
        )
        .limit(1)
        .maybeSingle();

      mapping = result.data;
      mappingError = result.error;
    }

    if (mappingError) {
      console.error(
        "Telegram mapping error:",
        mappingError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "Telegram mesaj eşleşmesi okunamadı.",
        },
        { status: 500 }
      );
    }

    if (!mapping) {
      console.log(
        "Telegram mapping bulunamadı:",
        {
          replyToMessageId,
          messageThreadId,
        }
      );

      return NextResponse.json({
        ok: true,
      });
    }

    if (
      !mapping.conversation_id ||
      !mapping.whatsapp_phone
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "conversation_id veya telefon eksik.",
        },
        { status: 500 }
      );
    }

    const token =
      process.env.WHATSAPP_TOKEN;

    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID;

    const apiVersion =
      process.env.WHATSAPP_API_VERSION ||
      "v23.0";

    if (
      !token ||
      !phoneNumberId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "WhatsApp API ayarları eksik.",
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
          Authorization:
            `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          messaging_product:
            "whatsapp",
          to:
            mapping.whatsapp_phone,
          type:
            "text",
          text: {
            preview_url: false,
            body: text,
          },
        }),
      }
    );

    const data =
      await response.json();

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
        {
          status: response.status,
        }
      );
    }

    // Panel konuşmasına outbound olarak kaydet
    await supabase
      .from(
        "whatsapp_conversation_messages"
      )
      .insert([
        {
          conversation_id:
            mapping.conversation_id,

          phone:
            mapping.whatsapp_phone,

          direction:
            "outbound",

          message_type:
            "text",

          message_text:
            text,

          raw_payload: {
            source:
              "telegram",

            telegram_message_id:
              message.message_id,

            telegram_thread_id:
              messageThreadId || null,

            telegram_sender: {
              id:
                message?.from?.id ||
                null,

              first_name:
                message?.from?.first_name ||
                null,

              last_name:
                message?.from?.last_name ||
                null,

              username:
                message?.from?.username ||
                null,
            },

            whatsapp_response:
              data,
          },
        },
      ]);

    // Conversation durumunu güncelle
    await supabase
      .from(
        "whatsapp_conversations"
      )
      .update({
        status:
          "answered",

        archived:
          false,

        last_message:
          text,

        last_message_at:
          new Date().toISOString(),

        unread_count:
          0,
      })
      .eq(
        "id",
        mapping.conversation_id
      );

    return NextResponse.json({
      ok: true,
      sent: true,
      conversationId:
        mapping.conversation_id,
      telegramThreadId:
        messageThreadId || null,
    });
  } catch (error) {
    console.error(
      "Telegram webhook error:",
      error
    );

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