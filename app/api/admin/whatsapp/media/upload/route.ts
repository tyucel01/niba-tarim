import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "Dosya yok." });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `whatsapp/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from("whatsapp-media")
      .upload(fileName, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    const { data } = supabase.storage
      .from("whatsapp-media")
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: data.publicUrl,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}