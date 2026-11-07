"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const IDLE_TIMEOUT = 3 * 60 * 60 * 1000;
const ACTIVITY_KEY = "nibaAdminActivity";
const SESSION_VERIFIED = "niba-admin-session-verified";
const LEGACY_OTP_KEY = "adminOtpVerified";
const activityEvents = ["pointerdown", "keydown", "wheel", "touchend"];

type Status = "loading" | "signedOut" | "signedIn";
type SessionClaims = { session_id?: string; amr?: { method?: string }[] };
const AdminSessionContext = createContext<Status>("loading");

export function useAdminSession() {
  return useContext(AdminSessionContext);
}

function sessionClaims(session: Session | null) {
  try {
    const payload = session?.access_token.split(".")[1];
    if (!payload) return null;
    const claims: SessionClaims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof claims.session_id !== "string" || !claims.session_id) return null;
    return { sessionId: claims.session_id, usedOtp: claims.amr?.some((method) => method.method === "otp") };
  } catch {
    return null;
  }
}

function lastActivity(sessionId: string): number | null {
  try {
    const activity = JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? "null");
    return activity?.sessionId === sessionId && Number.isFinite(activity.lastActiveAt)
      ? activity.lastActiveAt
      : null;
  } catch {
    return null;
  }
}

function recordActivity(sessionId: string, lastActiveAt: number) {
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify({ sessionId, lastActiveAt }));
    return true;
  } catch {
    return false;
  }
}

export function markAdminSessionVerified(session: Session) {
  const claims = sessionClaims(session);
  if (!claims || !recordActivity(claims.sessionId, Date.now())) return false;
  window.dispatchEvent(new Event(SESSION_VERIFIED));
  return true;
}

export function AdminSession({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let sessionId: string | null = null;
    let timer: number | undefined;
    let signOutTimer: number | undefined;

    function checkActivity() {
      window.clearTimeout(timer);
      const activeAt = sessionId ? lastActivity(sessionId) : null;
      if (activeAt === null) {
        setStatus("signedOut");
        return;
      }

      const remaining = activeAt + IDLE_TIMEOUT - Date.now();
      if (remaining <= 0) {
        setStatus("signedOut");
        const expiredSession = sessionId;
        window.clearTimeout(signOutTimer);
        // Auth callbacks run under Supabase's session lock.
        signOutTimer = window.setTimeout(() => {
          if (sessionId === expiredSession) void supabase.auth.signOut({ scope: "local" });
        }, 0);
        return;
      }

      setStatus("signedIn");
      timer = window.setTimeout(checkActivity, remaining);
    }

    function handleActivity(event: Event) {
      if (!event.isTrusted || document.visibilityState !== "visible" || !sessionId) return;
      const activeAt = lastActivity(sessionId);
      if (activeAt === null) return;
      const now = Date.now();
      if (now - activeAt < IDLE_TIMEOUT) {
        recordActivity(sessionId, now);
      } else {
        checkActivity();
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === ACTIVITY_KEY || event.key === null) checkActivity();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const claims = sessionClaims(session);
      sessionId = claims?.sessionId ?? null;
      if (event === "INITIAL_SESSION" && sessionStorage.getItem(LEGACY_OTP_KEY) === "true") {
        sessionStorage.removeItem(LEGACY_OTP_KEY);
        if (claims?.usedOtp && lastActivity(claims.sessionId) === null) {
          recordActivity(claims.sessionId, Date.now());
        }
      }
      checkActivity();
    });

    for (const event of activityEvents) window.addEventListener(event, handleActivity, { passive: true, capture: true });
    window.addEventListener(SESSION_VERIFIED, checkActivity);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("pageshow", checkActivity);
    document.addEventListener("visibilitychange", checkActivity);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timer);
      window.clearTimeout(signOutTimer);
      for (const event of activityEvents) window.removeEventListener(event, handleActivity, true);
      window.removeEventListener(SESSION_VERIFIED, checkActivity);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("pageshow", checkActivity);
      document.removeEventListener("visibilitychange", checkActivity);
    };
  }, []);

  useEffect(() => {
    if (status === "signedOut" && pathname !== "/admin") router.replace("/admin");
  }, [pathname, router, status]);

  if (status === "loading" || (status === "signedOut" && pathname !== "/admin")) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef1ea]">
        <div className="rounded-3xl bg-white px-6 py-5 text-sm font-black text-slate-700 shadow-xl">
          Yükleniyor...
        </div>
      </main>
    );
  }

  return <AdminSessionContext.Provider value={status}>{children}</AdminSessionContext.Provider>;
}
