import { NextResponse } from "next/server";

export async function GET() {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const wabaId = process.env.WHATSAPP_WABA_ID;
    const version = process.env.WHATSAPP_API_VERSION || "v23.0";

    if (!token || !wabaId) {
      return NextResponse.json({
        success: false,
        error: "WHATSAPP_TOKEN veya WHATSAPP_WABA_ID eksik.",
      });
    }

    const res = await fetch(
      `https://graph.facebook.com/${version}/${wabaId}/message_templates?fields=name,language,status,category,components&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: data,
      });
    }

    const approved = (data.data || []).filter(
      (t: any) => t.status === "APPROVED"
    );

    return NextResponse.json({
      success: true,
      templates: approved,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}