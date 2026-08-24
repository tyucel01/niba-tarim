import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export async function GET() {
  try {
    const result = await sendTelegramMessage({
      text: "✅ Niba Tarım Telegram bağlantısı çalışıyor.",
    });

    return NextResponse.json({
      ok: true,
      telegramMessageId: result.message_id,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      },
      { status: 500 }
    );
  }
}