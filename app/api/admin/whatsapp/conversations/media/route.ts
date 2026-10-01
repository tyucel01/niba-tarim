import { NextResponse } from "next/server";
import { authorizeWhatsApp, isUuid, whatsappAdmin } from "@/lib/whatsapp/admin";
import { getAttachment } from "@/lib/whatsapp/messages";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = whatsappAdmin();
  const denied = await authorizeWhatsApp(req, admin);
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("messageId");
  if (!isUuid(id)) return NextResponse.json({ error: "Geçersiz mesaj." }, { status: 400 });
  const { data: message, error } = await admin.from("whatsapp_conversation_messages")
    .select("message_type,raw_payload").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "Dosya bilgisi alınamadı." }, { status: 500 });
  const media = message && getAttachment(message.message_type, message.raw_payload);
  if (!media) return NextResponse.json({ error: "Bu mesajın dosyası bulunamadı." }, { status: 404 });
  const { data: settings } = await admin.from("whatsapp_settings")
    .select("whatsapp_token,whatsapp_api_version").eq("id", 1).maybeSingle();
  const token = settings?.whatsapp_token || process.env.WHATSAPP_TOKEN;
  const version = settings?.whatsapp_api_version || process.env.WHATSAPP_API_VERSION || "v23.0";
  if (!token || !/^v\d+\.\d+$/.test(version)) return NextResponse.json({ error: "WhatsApp medya bağlantısı yapılandırılmamış." }, { status: 503 });
  try {
    const metadata = await fetch(`https://graph.facebook.com/${version}/${media.id}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!metadata.ok) return NextResponse.json({ error: "Dosya WhatsApp üzerinden alınamadı. Eski dosyaların erişim süresi dolmuş olabilir." }, { status: 502 });
    const info = await metadata.json();
    const url = new URL(info.url);
    // Only follow Meta's media hosts, never an arbitrary client-supplied URL.
    if (url.protocol !== "https:" || !["fbsbx.com", "fbcdn.net", "whatsapp.net", "facebook.com"].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
      return NextResponse.json({ error: "Geçersiz medya adresi." }, { status: 502 });
    }
    const file = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000),
    });
    if (!file.ok || !file.body) return NextResponse.json({ error: "Dosya indirilemedi. Tekrar deneyin." }, { status: 502 });
    const mime = (file.headers.get("content-type") || media.mimeType || "application/octet-stream").split(";")[0];
    const safeInline = /^(image\/(jpeg|png|webp|gif)|application\/pdf|audio\/(mpeg|mp4|ogg|aac|amr)|video\/(mp4|3gpp))$/.test(mime);
    return new Response(file.body, { headers: {
      "Content-Type": safeInline ? mime : "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(media.filename || `whatsapp-${media.id}`)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch {
    return NextResponse.json({ error: "Dosya yüklenemedi. Lütfen tekrar deneyin." }, { status: 502 });
  }
}
