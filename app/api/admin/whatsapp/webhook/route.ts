import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

          let messageText = "";

          if (message.type === "text") {
            messageText = message.text?.body || "";
          } else if (message.type === "button") {
            messageText = message.button?.text || "";
          } else if (message.type === "interactive") {
            messageText =
              message.interactive?.button_reply?.title ||
              message.interactive?.list_reply?.title ||
              "";
          } else {
            messageText = `[${message.type || "unknown"} mesaj]`;
          }

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
                message_type: message.type || "text",
                message_text: messageText,
                raw_payload: message,
              },
            ]);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}