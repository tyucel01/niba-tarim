"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AiAsistanPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Merhaba, ben Niba Tarım satış asistanın. Bana örneğin “Bugün hangi bayiyi arasam mal alır?” diye sorabilirsin.",
    },
  ]);

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendQuestion() {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || loading) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: cleanQuestion },
    ]);

    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: cleanQuestion,
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.error || "Cevap alınamadı.");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: json.answer,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Bir hata oluştu: " + (err?.message || "Bilinmeyen hata"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  }

  const examples = [
    "Bugün hangi bayileri aramalıyım?",
    "CAN 26 için kimleri arayayım?",
    "Son 60 gündür alım yapmayan ama geçmişte düzenli alan bayiler kim?",
    "Hangi bayi tekrar sipariş verebilir?",
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
        <div className="mb-5 rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl">
          <p className="text-sm font-semibold text-emerald-300">
            Niba Tarım AI Asistan
          </p>
          <h1 className="mt-2 text-2xl font-bold">
            Sipariş geçmişine göre soru sor, cevap al
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Sistem sipariş geçmişini analiz eder, bayi bazlı alım ihtimalini
            yorumlar ve sana aksiyon önerisi verir.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {examples.map((item) => (
            <button
              key={item}
              onClick={() => setQuestion(item)}
              className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs text-slate-200 transition hover:bg-white/[0.12]"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl">
          <div className="h-[calc(100vh-310px)] min-h-[420px] overflow-y-auto p-5">
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={[
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "max-w-[85%] whitespace-pre-wrap rounded-3xl px-5 py-4 text-sm leading-6 shadow-lg",
                      msg.role === "user"
                        ? "bg-emerald-500 text-slate-950"
                        : "border border-white/10 bg-slate-900 text-slate-100",
                    ].join(" ")}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-3xl border border-white/10 bg-slate-900 px-5 py-4 text-sm text-slate-300">
                    Siparişler analiz ediliyor...
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 bg-slate-950/80 p-4">
            <div className="flex gap-3">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Örn: Şu an hangi bayiyi arasam mal alır?"
                className="min-h-[54px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />

              <button
                onClick={sendQuestion}
                disabled={loading || !question.trim()}
                className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Gönder
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Enter ile gönder, Shift + Enter ile alt satıra geç.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}