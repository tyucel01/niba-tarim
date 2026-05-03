import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Upload API çalışıyor",
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        error: "Supabase env eksik.",
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: "Dosya yok.",
      });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `whatsapp/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error } = await supabase.storage
      .from("whatsapp-media")
      .upload(fileName, arrayBuffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
      });
    }

    const { data } = supabase.storage
      .from("whatsapp-media")
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: data.publicUrl,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}