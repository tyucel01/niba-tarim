"use client";

import { useEffect, useState } from "react";

type Recommendation = {
  bayi: string;
  score: number;
  priority: string;
  lastOrderDate: string | null;
  lastOrderDaysAgo: number | null;
  averageCycle: number;
  totalOrders: number;
  totalTonaj: number;
  totalAmount: number;
  favoriteProduct: string;
  reasons: string[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("tr-TR");
}

export default function AiSatisAsistaniPage() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [question, setQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [askingAI, setAskingAI] = useState(false);

  const [training, setTraining] = useState(false);
  const [trainMessage, setTrainMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        "/api/admin/ai/satis-oneri",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!json.ok) {
        throw new Error(
          json.error || "Veri alınamadı"
        );
      }

      setItems(json.data || []);

      if (json.aiComment) {
        setAiAnswer(json.aiComment);
      }
    } catch (err: any) {
      setError(
        err?.message || "Bilinmeyen hata"
      );
    } finally {
      setLoading(false);
    }
  }

  async function askAI() {
    if (!question.trim()) return;

    setAskingAI(true);

    try {
      const context = items
        .slice(0, 15)
        .map((x) => ({
          bayi: x.bayi,
          score: x.score,
          priority: x.priority,
          averageCycle: x.averageCycle,
          lastOrderDaysAgo:
            x.lastOrderDaysAgo,
          totalTonaj: x.totalTonaj,
          totalAmount: x.totalAmount,
          favoriteProduct:
            x.favoriteProduct,
        }));

      const res = await fetch(
        "/api/admin/ai/chat",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            question: `
Kullanıcı sorusu:
${question}

Mevcut bayi analiz verileri:
${JSON.stringify(context, null, 2)}
`,
          }),
        }
      );

      const json = await res.json();

      if (!json.ok) {
        throw new Error(
          json.error ||
            "AI cevabı alınamadı"
        );
      }

      setAiAnswer(json.answer || "");
    } catch (err: any) {
      setAiAnswer(
        err?.message ||
          "AI cevabı alınamadı."
      );
    } finally {
      setAskingAI(false);
    }
  }

  async function trainModel() {
    setTraining(true);
    setTrainMessage("");

    try {
      const res = await fetch(
        "/api/admin/ai/train",
        {
          method: "POST",
        }
      );

      const json = await res.json();

      if (!json.ok) {
        throw new Error(
          json.error ||
            "Model eğitilemedi."
        );
      }

      setTrainMessage(
        `Model başarıyla eğitildi. Training rows: ${
          json?.data?.trainingRows || "-"
        }`
      );
    } catch (err: any) {
      setTrainMessage(
        err?.message ||
          "Model eğitimi hatası."
      );
    } finally {
      setTraining(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const highPriority = items.filter(
    (x) => x.priority === "Yüksek"
  ).length;

  const mediumPriority = items.filter(
    (x) => x.priority === "Orta"
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm font-medium text-emerald-300">
                Niba Tarım AI Copilot
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Ticari Analiz Asistanı
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                DeepSeek destekli lokal
                AI sistemi bayi davranışlarını,
                sipariş ritmini, tonajı ve
                ticari sinyalleri analiz eder.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <p className="mb-3 text-sm font-semibold text-slate-300">
                Niba AI’ya Sor
              </p>

              <div className="flex flex-col gap-3 lg:flex-row">
                <input
                  value={question}
                  onChange={(e) =>
                    setQuestion(e.target.value)
                  }
                  placeholder="Örn: Bu hafta hangi bayiler aranmalı?"
                  className="h-14 flex-1 rounded-2xl border border-white/10 bg-slate-900 px-5 text-white outline-none focus:border-emerald-500"
                />

                <button
                  onClick={askAI}
                  disabled={
                    askingAI ||
                    !question.trim()
                  }
                  className="h-14 rounded-2xl bg-emerald-500 px-6 font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {askingAI
                    ? "AI düşünüyor..."
                    : "AI Analiz Et"}
                </button>

                <button
                  onClick={trainModel}
                  disabled={training}
                  className="h-14 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-6 font-semibold text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-50"
                >
                  {training
                    ? "Model eğitiliyor..."
                    : "Modeli Eğit"}
                </button>

                <button
                  onClick={loadData}
                  className="h-14 rounded-2xl border border-white/10 px-6 font-semibold text-slate-300"
                >
                  Yenile
                </button>
              </div>

              {trainMessage && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-300">
                  {trainMessage}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  "Bu hafta en sıcak bayiler kim?",
                  "DAP alımı düşen bayileri bul",
                  "Uzun süredir sessiz kalan müşteriler",
                  "En yüksek potansiyelli bayiler",
                ].map((sample) => (
                  <button
                    key={sample}
                    onClick={() =>
                      setQuestion(sample)
                    }
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 transition hover:bg-white/10"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">
                  Toplam öneri
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {items.length}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">
                  Yüksek öncelik
                </p>

                <p className="mt-2 text-2xl font-bold text-emerald-300">
                  {highPriority}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">
                  Orta öncelik
                </p>

                <p className="mt-2 text-2xl font-bold text-amber-300">
                  {mediumPriority}
                </p>
              </div>
            </div>
          </div>
        </div>

        {aiAnswer && (
          <div className="mb-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-lg font-black text-slate-950">
                AI
              </div>

              <div>
                <p className="text-sm font-semibold text-emerald-300">
                  Niba AI Engine
                </p>

                <p className="text-xs text-emerald-100/70">
                  Lokal Ticari Copilot
                </p>
              </div>
            </div>

            <div className="whitespace-pre-wrap text-sm leading-7 text-slate-100">
              {aiAnswer}
            </div>
          </div>
        )}

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center text-slate-300">
            Sipariş geçmişi analiz ediliyor...
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid gap-5">
            {items.map((item, index) => (
              <div
                key={item.bayi}
                className="rounded-3xl border border-white/10 bg-white/[0.08] p-5 shadow-xl"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold">
                        {index + 1}
                      </span>

                      <h2 className="text-xl font-bold">
                        {item.bayi}
                      </h2>

                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-bold",
                          item.priority ===
                          "Yüksek"
                            ? "bg-emerald-400/15 text-emerald-300"
                            : item.priority ===
                                "Orta"
                              ? "bg-amber-400/15 text-amber-300"
                              : "bg-slate-400/15 text-slate-300",
                        ].join(" ")}
                      >
                        {item.priority} Öncelik
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-300">
                      En çok aldığı ürün:{" "}
                      <span className="font-semibold text-white">
                        {item.favoriteProduct}
                      </span>
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/60 px-5 py-4 text-center">
                    <p className="text-xs text-slate-400">
                      Satın alma ihtimali
                    </p>

                    <p className="mt-1 text-3xl font-black text-emerald-300">
                      %{item.score}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-5">
                  <div className="rounded-2xl bg-slate-950/50 p-4">
                    <p className="text-xs text-slate-400">
                      Son sipariş
                    </p>

                    <p className="mt-1 font-semibold">
                      {formatDate(
                        item.lastOrderDate
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/50 p-4">
                    <p className="text-xs text-slate-400">
                      Geçen gün
                    </p>

                    <p className="mt-1 font-semibold">
                      {item.lastOrderDaysAgo ??
                        "-"}{" "}
                      gün
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/50 p-4">
                    <p className="text-xs text-slate-400">
                      Ortalama döngü
                    </p>

                    <p className="mt-1 font-semibold">
                      {item.averageCycle ||
                        "-"}{" "}
                      gün
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/50 p-4">
                    <p className="text-xs text-slate-400">
                      Toplam tonaj
                    </p>

                    <p className="mt-1 font-semibold">
                      {formatNumber(
                        item.totalTonaj
                      )}{" "}
                      ton
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/50 p-4">
                    <p className="text-xs text-slate-400">
                      Toplam ciro
                    </p>

                    <p className="mt-1 font-semibold">
                      {formatMoney(
                        item.totalAmount
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="mb-2 text-sm font-bold text-slate-200">
                    Neden aranmalı?
                  </p>

                  <ul className="space-y-2 text-sm text-slate-300">
                    {item.reasons.map(
                      (reason) => (
                        <li key={reason}>
                          • {reason}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}