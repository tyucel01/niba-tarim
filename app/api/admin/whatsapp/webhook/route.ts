import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  createTelegramForumTopic,
  sendTelegramMessage,
} from "@/lib/telegram";

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

// ---------------------------------------------------------
// Meta webhook verification
// ---------------------------------------------------------

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken =
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    token === verifyToken
  ) {
    return new Response(challenge || "", {
      status: 200,
    });
  }

  return new Response("Forbidden", {
    status: 403,
  });
}

// ---------------------------------------------------------
// Incoming WhatsApp messages
// ---------------------------------------------------------

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const entries = body?.entry || [];

    for (const entry of entries) {
      const changes = entry?.changes || [];

      for (const change of changes) {
        const value = change?.value || {};
        console.log(
  "WHATSAPP VALUE:",
  JSON.stringify(value, null, 2)
);

        const messages =
          value?.messages || [];

        const contacts =
          value?.contacts || [];

        for (const message of messages) {
          const phone =
            message?.from;

          if (!phone) {
            continue;
          }

          // -------------------------------------------------
          // Contact information
          // -------------------------------------------------

          const contactProfile =
            contacts.find(
              (contact: any) =>
                contact?.wa_id === phone
            );

          const name =
            contactProfile?.profile?.name ||
            null;

          const messageText =
            parseWhatsAppMessage(message);

          const messageType =
            message?.type || "unknown";

          // -------------------------------------------------
          // Find/create WhatsApp contact
          // -------------------------------------------------

          const {
            data: existingContact,
            error: contactReadError,
          } = await supabase
            .from("whatsapp_contacts")
            .select("id, name")
            .eq("phone", phone)
            .maybeSingle();

          if (contactReadError) {
            console.error(
              "WhatsApp contact read error:",
              contactReadError
            );
          }

          let contactId =
            existingContact?.id || null;

          if (!contactId) {
            const {
              data: newContact,
              error: contactCreateError,
            } = await supabase
              .from("whatsapp_contacts")
              .insert([
                {
                  name:
                    name ||
                    "WhatsApp Kişisi",

                  phone,

                  note:
                    "WhatsApp cevabından otomatik oluştu",
                },
              ])
              .select("id")
              .single();

            if (contactCreateError) {
              console.error(
                "WhatsApp contact create error:",
                contactCreateError
              );
            }

            contactId =
              newContact?.id || null;
          }

          // -------------------------------------------------
          // Find/create conversation
          // -------------------------------------------------

          const {
            data: existingConversation,
            error: conversationReadError,
          } = await supabase
            .from("whatsapp_conversations")
            .select(
              "id, unread_count"
            )
            .eq("phone", phone)
            .maybeSingle();

          if (conversationReadError) {
            console.error(
              "WhatsApp conversation read error:",
              conversationReadError
            );
          }

          let conversationId =
            existingConversation?.id ||
            null;

          const unreadCount =
            existingConversation?.unread_count ||
            0;

          const displayName =
            existingContact?.name ||
            name ||
            "WhatsApp Kişisi";

          if (!conversationId) {
            const {
              data: newConversation,
              error:
                conversationCreateError,
            } = await supabase
              .from(
                "whatsapp_conversations"
              )
              .insert([
                {
                  contact_id:
                    contactId,

                  phone,

                  name:
                    displayName,

                  status:
                    "waiting",

                  archived:
                    false,

                  last_message:
                    messageText,

                  last_message_at:
                    new Date().toISOString(),

                  unread_count:
                    1,
                },
              ])
              .select("id")
              .single();

            if (
              conversationCreateError
            ) {
              console.error(
                "WhatsApp conversation create error:",
                conversationCreateError
              );
            }

            conversationId =
              newConversation?.id ||
              null;
          } else {
            const {
              error:
                conversationUpdateError,
            } = await supabase
              .from(
                "whatsapp_conversations"
              )
              .update({
                contact_id:
                  contactId,

                name:
                  displayName,

                status:
                  "waiting",

                archived:
                  false,

                last_message:
                  messageText,

                last_message_at:
                  new Date().toISOString(),

                unread_count:
                  unreadCount + 1,
              })
              .eq(
                "id",
                conversationId
              );

            if (
              conversationUpdateError
            ) {
              console.error(
                "WhatsApp conversation update error:",
                conversationUpdateError
              );
            }
          }

          if (!conversationId) {
            console.error(
              "WhatsApp conversation oluşturulamadı:",
              phone
            );

            continue;
          }

          // -------------------------------------------------
          // Save incoming message
          // -------------------------------------------------

          const {
            error: messageInsertError,
          } = await supabase
            .from(
              "whatsapp_conversation_messages"
            )
            .insert([
              {
                conversation_id:
                  conversationId,

                contact_id:
                  contactId,

                phone,

                direction:
                  "inbound",

                message_type:
                  messageType,

                message_text:
                  messageText,

                raw_payload:
                  message,
              },
            ]);

          if (messageInsertError) {
            console.error(
              "WhatsApp message insert error:",
              messageInsertError
            );
          }

          // -------------------------------------------------
          // Telegram Topic
          // -------------------------------------------------

          try {
            // Bu WhatsApp konuşmasının daha önce
            // açılmış bir Telegram topic'i var mı?

            const {
              data:
                existingTelegramMapping,
              error:
                existingTelegramMappingError,
            } = await supabase
              .from(
                "whatsapp_telegram_messages"
              )
              .select(
                "telegram_thread_id"
              )
              .eq(
                "conversation_id",
                conversationId
              )
              .not(
                "telegram_thread_id",
                "is",
                null
              )
              .limit(1)
              .maybeSingle();

            if (
              existingTelegramMappingError
            ) {
              console.error(
                "Telegram thread lookup error:",
                existingTelegramMappingError
              );
            }

            let telegramThreadId:
              | number
              | null = null;

            if (
              existingTelegramMapping?.telegram_thread_id
            ) {
              telegramThreadId =
                Number(
                  existingTelegramMapping
                    .telegram_thread_id
                );
            }

            // İlk mesaj ise kişi için yeni topic aç.

            if (!telegramThreadId) {
              const topic =
                await createTelegramForumTopic({
                  name:
                    `${displayName} • ${phone}`,
                });

              telegramThreadId =
                Number(
                  topic.message_thread_id
                );

              if (
                !telegramThreadId ||
                Number.isNaN(
                  telegramThreadId
                )
              ) {
                throw new Error(
                  "Telegram topic oluşturuldu fakat message_thread_id alınamadı."
                );
              }
            }

            // WhatsApp mesajını kişinin topic'ine gönder.

            const telegramMessage =
              await sendTelegramMessage({
                messageThreadId:
                  telegramThreadId,

                text:
                  `🟢 <b>NIBA WHATSAPP</b>\n\n` +
                  `👤 <b>${escapeHtml(
                    displayName
                  )}</b>\n` +
                  `📱 ${escapeHtml(
                    phone
                  )}\n\n` +
                  `💬 ${escapeHtml(
                    messageText
                  )}\n\n` +
                  `↩️ <i>Bu konuya mesaj yazarak WhatsApp'tan cevap verebilirsiniz.</i>`,
              });

            // Telegram mesajı ile WhatsApp konuşmasını eşleştir.

            const {
              error:
                telegramMappingInsertError,
            } = await supabase
              .from(
                "whatsapp_telegram_messages"
              )
              .insert([
                {
                  whatsapp_phone:
                    phone,

                  whatsapp_name:
                    displayName,

                  whatsapp_message_id:
                    message?.id ||
                    null,

                  telegram_chat_id:
                    String(
                      telegramMessage
                        ?.chat
                        ?.id
                    ),

                  telegram_message_id:
                    telegramMessage
                      ?.message_id,

                  telegram_thread_id:
                    telegramThreadId,

                  conversation_id:
                    conversationId,

                  direction:
                    "incoming",
                },
              ]);

            if (
              telegramMappingInsertError
            ) {
              console.error(
                "Telegram mapping insert error:",
                telegramMappingInsertError
              );
            }
          } catch (
            telegramError
          ) {
            console.error(
              "Telegram bildirim hatası:",
              telegramError
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "WhatsApp webhook error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}