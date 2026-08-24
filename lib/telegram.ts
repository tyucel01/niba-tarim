const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

type SendTelegramMessageParams = {
  text: string;
  chatId?: string;
};

export async function sendTelegramMessage({
  text,
  chatId,
}: SendTelegramMessageParams) {
  const targetChatId = chatId || TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN tanımlı değil");
  }

  if (!targetChatId) {
    throw new Error("TELEGRAM_CHAT_ID tanımlı değil");
  }

  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: targetChatId,
      text,
      parse_mode: "HTML",
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    console.error("Telegram sendMessage error:", data);
    throw new Error(
      data?.description || "Telegram mesajı gönderilemedi"
    );
  }

  return data.result;
}