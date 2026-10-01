"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/whatsapp/messages";
import { sessionHeaders } from "@/lib/whatsapp/use-conversation";

export function MessageContent({ message }: { message: ChatMessage }) {
  const container = useRef<HTMLDivElement>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const media = message.attachment;

  useEffect(() => {
    if (!media || !container.current) return;
    const controller = new AbortController();
    let objectUrl = "";
    let started = false;
    async function load() {
      try {
        setError("");
        const headers = await sessionHeaders();
        if (controller.signal.aborted) return;
        const response = await fetch(`/api/admin/whatsapp/conversations/media?messageId=${message.id}`, {
          headers, signal: controller.signal, cache: "no-store",
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Dosya yüklenemedi.");
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setFileUrl(objectUrl);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Dosya yüklenemedi.");
      }
    }
    // Do not download every attachment in the history (or the hidden mobile /
    // desktop copy). Load only attachments that scroll into the visible chat.
    const observer = new IntersectionObserver((entries) => {
      if (!started && entries.some((entry) => entry.isIntersecting)) { started = true; void load(); }
    });
    observer.observe(container.current);
    return () => { controller.abort(); observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [message.id, media?.id, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (message.reaction !== null) {
    return <div className="break-words"><p className="text-xs text-slate-500">Mesaja tepki</p><p className="mt-1 text-3xl" aria-label={message.reaction || "Tepki kaldırıldı"}>{message.reaction || "Tepki kaldırıldı"}</p></div>;
  }
  if (!media) return <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-slate-800">{message.message_text || "-"}</p>;
  const filename = media.filename || (media.type === "document" ? "Belge" : "WhatsApp eki");
  return (
    <div ref={container} className="min-w-0 max-w-full space-y-2">
      {media.type === "document" && <p className="break-words font-bold [overflow-wrap:anywhere]">📎 {filename}</p>}
      {!fileUrl && !error && <p role="status" className="text-sm text-slate-500">Dosya yükleniyor…</p>}
      {error && <div role="alert" className="text-sm text-red-700"><p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 font-bold underline">Tekrar dene</button></div>}
      {fileUrl && (media.type === "image" || media.type === "sticker") && (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" aria-label={media.type === "sticker" ? "Çıkartmayı aç" : "Görseli büyüt"}>
          {/* Authenticated blob URLs cannot use the image optimization server. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl} alt={media.caption || (media.type === "sticker" ? "Çıkartma" : "Gelen görsel")} className={`max-h-80 max-w-full rounded-xl object-contain ${media.type === "sticker" ? "w-32" : "w-72"}`} onError={() => setError("Görsel görüntülenemedi. Dosyayı indirerek açabilirsiniz.")} />
        </a>
      )}
      {fileUrl && media.type === "audio" && <audio controls src={fileUrl} className="max-w-full" preload="metadata" />}
      {fileUrl && media.type === "video" && <video controls playsInline src={fileUrl} className="max-h-80 max-w-full rounded-xl" preload="metadata" />}
      {media.caption && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{media.caption}</p>}
      {fileUrl && <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-emerald-800">
        {media.type === "document" && <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">{media.mimeType === "application/pdf" ? "PDF’yi aç" : "Belgeyi aç"}</a>}
        <a href={fileUrl} download={media.filename || `whatsapp-${media.id}`} className="inline-flex min-h-11 items-center underline">İndir</a>
      </div>}
    </div>
  );
}
