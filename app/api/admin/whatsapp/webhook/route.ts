import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseWhatsAppMessage(message: any) {
  const type = message?.type || "unknown";

  if (type === "text") {
    return message.text?.body || "";
  }

  if (type === "reaction") {
    return message.reaction?.emoji || "👍";
  }

  if (type === "button") {
    return message.button?.text || "[buton cevabı]";
  }

  if (type === "interactive") {
    return (
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      "[interaktif cevap]"
    );
  }

  if (type === "image") {
    return message.image?.caption
      ? `🖼️ Görsel: ${message.image.caption}`
      : "🖼️ Görsel gönderildi";
  }

  if (type === "video") {
    return message.video?.caption
      ? `🎥 Video: ${message.video.caption}`
      : "🎥 Video gönderildi";
  }

  if (type === "audio") {
    return "🎧 Sesli mesaj gönderildi";
  }

  if (type === "voice") {
    return "🎙️ Sesli mesaj gönderildi";
  }

  if (type === "document") {
    return message.document?.filename
      ? `📎 Belge: ${message.document.filename}`
      : "📎 Belge gönderildi";
  }

  if (type === "sticker") {
    return "🧩 Sticker gönderildi";
  }

  if (type === "location") {
    return "📍 Konum gönderildi";
  }

  if (type === "contacts") {
    return "👤 Kişi kartı gönderildi";
  }

  return `[${type} mesaj]`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge || "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const value = change.value || {};
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (const message of messages) {
          const phone = message.from;
          const contactProfile = contacts.find((c: any) => c.wa_id === phone);
          const name = contactProfile?.profile?.name || null;

          const messageText = parseWhatsAppMessage(message);
          const messageType = message.type || "unknown";

          const { data: existingContact } = await supabase
            .from("whatsapp_contacts")
            .select("id, name")
            .eq("phone", phone)
            .maybeSingle();

          let contactId = existingContact?.id || null;

          if (!contactId) {
            const { data: newContact } = await supabase
              .from("whatsapp_contacts")
              .insert([
                {
                  name: name || "WhatsApp Kişisi",
                  phone,
                  note: "WhatsApp cevabından otomatik oluştu",
                },
              ])
              .select("id")
              .single();

            contactId = newContact?.id || null;
          }

          const { data: existingConversation } = await supabase
            .from("whatsapp_conversations")
            .select("id, unread_count")
            .eq("phone", phone)
            .maybeSingle();

          let conversationId = existingConversation?.id || null;
          const unreadCount = existingConversation?.unread_count || 0;

          if (!conversationId) {
            const { data: newConversation } = await supabase
              .from("whatsapp_conversations")
              .insert([
                {
                  contact_id: contactId,
                  phone,
                  name: existingContact?.name || name || "WhatsApp Kişisi",
                  status: "waiting",
                  archived: false,
                  last_message: messageText,
                  last_message_at: new Date().toISOString(),
                  unread_count: 1,
                },
              ])
              .select("id")
              .single();

            conversationId = newConversation?.id || null;
          } else {
            await supabase
              .from("whatsapp_conversations")
              .update({
                contact_id: contactId,
                name: existingContact?.name || name || "WhatsApp Kişisi",
                status: "waiting",
                archived: false,
                last_message: messageText,
                last_message_at: new Date().toISOString(),
                unread_count: unreadCount + 1,
              })
              .eq("id", conversationId);
          }

if (conversationId) {
  await supabase.from("whatsapp_conversation_messages").insert([
    {
      conversation_id: conversationId,
      contact_id: contactId,
      phone,
      direction: "inbound",
      message_type: messageType,
      message_text: messageText,
      raw_payload: message,
    },
  ]);

  try {
    const displayName =
      existingContact?.name ||
      name ||
      "WhatsApp Kişisi";

    const telegramMessage = await sendTelegramMessage({
      text:
        `🟢 <b>NIBA WHATSAPP</b>\n\n` +
        `👤 <b>${escapeHtml(displayName)}</b>\n` +
        `📱 ${escapeHtml(phone)}\n\n` +
        `💬 ${escapeHtml(messageText)}\n\n` +
        `↩️ <i>Bu mesaja Reply yaparak WhatsApp'tan cevap verebilirsiniz.</i>`,
    });

    await supabase
      .from("whatsapp_telegram_messages")
      .insert([
        {
          whatsapp_phone: phone,
          whatsapp_name: displayName,
          whatsapp_message_id: message.id || null,
          telegram_chat_id: String(telegramMessage.chat.id),
          telegram_message_id: telegramMessage.message_id,
          conversation_id: conversationId,
          direction: "incoming",
        },
      ]);
  } catch (telegramError) {
    console.error(
      "Telegram bildirim hatası:",
      telegramError
    );
  }
}
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}