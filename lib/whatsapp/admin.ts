import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export function whatsappAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authorizeWhatsApp(req: Request, admin: ReturnType<typeof whatsappAdmin>) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return NextResponse.json({ success: false, error: "Oturum açmanız gerekiyor." }, { status: 401 });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) {
    return NextResponse.json({ success: false, error: "Oturumunuz geçersiz. Tekrar giriş yapın." }, { status: 401 });
  }
  // Match the existing admin allowlists; when absent, this application uses
  // its explicitly provisioned, signed-in users for admin access.
  const emails = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const phones = (process.env.ADMIN_PHONES || "").split(",").map((s) => s.replace(/\s/g, "")).filter(Boolean);
  if ((emails.length || phones.length) && !emails.includes((data.user.email || "").toLowerCase()) && !phones.includes(data.user.phone || "")) {
    return NextResponse.json({ success: false, error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }
  return null;
}

export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
