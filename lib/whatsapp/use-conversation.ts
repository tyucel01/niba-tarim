"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ChatMessage, ReadVersion } from "./messages";

export async function sessionHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Oturumunuz sona erdi. Tekrar giriş yapın.");
  return { Authorization: `Bearer ${data.session.access_token}` };
}

type Snapshot = { conversationId: string; messages: ChatMessage[]; readVersion: ReadVersion | null };

export function useConversation(conversationId: string | undefined, onRead: () => void) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!conversationId) return;
    const controller = new AbortController();
    let inFlight = false;
    async function load() {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const headers = await sessionHeaders();
        if (controller.signal.aborted) return;
        const response = await fetch(`/api/admin/whatsapp/conversations/messages?conversationId=${conversationId}`, {
          headers, cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Mesajlar yüklenemedi.");
        if (!controller.signal.aborted) {
          setSnapshot({ conversationId: conversationId!, messages: data.messages, readVersion: data.readVersion });
          setError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Mesajlar yüklenemedi.");
      } finally { inFlight = false; }
    }
    void load();
    const interval = setInterval(load, 3000);
    document.addEventListener("visibilitychange", load);
    return () => { controller.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", load); };
  }, [conversationId, revision]);

  // Runs after the loaded messages have been rendered, never for a closed or
  // background conversation. Failed acknowledgements are retried by polling.
  useEffect(() => {
    if (!snapshot?.readVersion || snapshot.conversationId !== conversationId || document.visibilityState !== "visible") return;
    const controller = new AbortController();
    async function acknowledge() {
      try {
        const headers = await sessionHeaders();
        if (controller.signal.aborted || document.visibilityState !== "visible") return;
        const response = await fetch("/api/admin/whatsapp/conversations/messages", {
          method: "POST", headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, readVersion: snapshot!.readVersion }), signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Okundu bilgisi kaydedilemedi.");
        if (!controller.signal.aborted && data.markedRead) onRead();
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Okundu bilgisi kaydedilemedi.");
      }
    }
    void acknowledge();
    const onVisibility = () => { if (document.visibilityState !== "visible") controller.abort(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { controller.abort(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [snapshot, conversationId, onRead]);

  return {
    messages: snapshot && snapshot.conversationId === conversationId ? snapshot.messages : [],
    loading: !!conversationId && snapshot?.conversationId !== conversationId,
    error, refresh,
  };
}
