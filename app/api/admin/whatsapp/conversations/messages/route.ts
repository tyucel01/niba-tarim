import { NextResponse } from "next/server";
import { authorizeWhatsApp, isUuid, whatsappAdmin } from "@/lib/whatsapp/admin";
import { readableVersion, toChatMessage } from "@/lib/whatsapp/messages";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = whatsappAdmin();
  const denied = await authorizeWhatsApp(req, admin);
  if (denied) return denied;
  const conversationId = new URL(req.url).searchParams.get("conversationId");
  if (!isUuid(conversationId)) return NextResponse.json({ success: false, error: "Geçersiz konuşma." }, { status: 400 });
  const { data: conversation, error: conversationError } = await admin.from("whatsapp_conversations")
    .select("last_message_at, unread_count").eq("id", conversationId).maybeSingle();
  if (conversationError) return NextResponse.json({ success: false, error: "Konuşma yüklenemedi." }, { status: 500 });
  if (!conversation) return NextResponse.json({ success: false, error: "Konuşma bulunamadı." }, { status: 404 });
  const { data, error } = await admin.from("whatsapp_conversation_messages")
    .select("id, conversation_id, direction, message_type, message_text, created_at, raw_payload")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ success: false, error: "Mesajlar yüklenemedi." }, { status: 500 });
  const messages = (data || []).reverse().map(toChatMessage);
  return NextResponse.json({ success: true, messages, readVersion: readableVersion(conversation, messages) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: Request) {
  const admin = whatsappAdmin();
  const denied = await authorizeWhatsApp(req, admin);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const version = body?.readVersion;
  if (!isUuid(body?.conversationId) || typeof version?.last_message_at !== "string" || !Number.isFinite(Date.parse(version.last_message_at)) || !Number.isInteger(version?.unread_count) || version.unread_count < 1) {
    return NextResponse.json({ success: false, error: "Geçersiz okundu bilgisi." }, { status: 400 });
  }
  // Compare-and-set: a newer incoming message must keep its unread badge.
  // Reading does not change waiting/answered or archive the conversation.
  const { data, error } = await admin.from("whatsapp_conversations").update({ unread_count: 0 })
    .eq("id", body.conversationId).eq("last_message_at", version.last_message_at)
    .eq("unread_count", version.unread_count).select("id");
  if (error) return NextResponse.json({ success: false, error: "Okundu bilgisi kaydedilemedi." }, { status: 500 });
  return NextResponse.json({ success: true, markedRead: !!data?.length });
}
