import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispatchPatch } from "@/lib/orders/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return NextResponse.json({ success: false, error: "Oturum açmanız gerekiyor." }, { status: 401 });
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user || auth.user.is_anonymous) return NextResponse.json({ success: false, error: "Oturumunuz geçersiz." }, { status: 401 });
    const emails = (process.env.ADMIN_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
    const phones = (process.env.ADMIN_PHONES || "").split(",").map(value => value.replace(/\s/g, "")).filter(Boolean);
    if ((emails.length || phones.length) && !emails.includes((auth.user.email || "").toLowerCase()) && !phones.includes(auth.user.phone || "")) return NextResponse.json({ success: false, error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    const body = await req.json();

    const id = String(body?.id || "").trim();
    const field = String(body?.field || "").trim();
    const value = body?.value ?? "";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id zorunlu." },
        { status: 400 }
      );
    }

    let patch;
    try { patch = dispatchPatch(body.fields ?? { [field]: value }); }
    catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Geçersiz alan." }, { status: 400 }); }

    const { data, error } = await supabase
      .from("siparisler")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      row: data,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Bilinmeyen hata",
      },
      { status: 500 }
    );
  }
}