import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PYTHON_AI_URL =
  process.env.PYTHON_AI_URL || "http://127.0.0.1:8002";

export async function POST() {
  try {
    const { data, error } = await supabase
      .from("siparisler")
      .select("*")
      .order("satisTarihi", { ascending: false })
      .limit(10000);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const res = await fetch(`${PYTHON_AI_URL}/train-model`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rows: data || [],
        question: "Model eğitimi",
      }),
      cache: "no-store",
    });

    const text = await res.text();

    let json: any;

    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: `Python AI JSON dönmedi: ${text}`,
        },
        { status: 500 }
      );
    }

    if (!res.ok || !json.success) {
      return NextResponse.json(
        {
          ok: false,
          error: json.error || "Model eğitilemedi.",
          detail: json,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Model başarıyla eğitildi.",
      data: json,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Model eğitimi hatası.",
      },
      { status: 500 }
    );
  }
}