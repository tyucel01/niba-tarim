import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const OLLAMA_URL =
  process.env.OLLAMA_URL || "http://127.0.0.1:11434";

const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL || "deepseek-r1:14b";

type Siparis = {
  id: string;
  satisId?: string | null;
  satisTarihi?: string | null;
  bayi?: string | null;
  urun?: string | null;
  marka?: string | null;
  tonaj?: number | string | null;
  tutar?: number | string | null;
  vadeliTutar?: number | string | null;
  vadeTarihi?: string | null;
};

function toNumber(value: any) {
  if (value === null || value === undefined) return 0;

  if (typeof value === "number") {
    return value;
  }

  const normalized = String(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function daysBetween(dateStr?: string | null) {
  if (!dateStr) return null;

  const d = new Date(dateStr);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  const now = new Date();

  return Math.floor(
    (now.getTime() - d.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function avg(numbers: number[]) {
  if (!numbers.length) return 0;

  return (
    numbers.reduce((a, b) => a + b, 0) /
    numbers.length
  );
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("siparisler")
      .select("*")
      .order("satisTarihi", {
        ascending: false,
      })
      .limit(5000);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    const rows = (data || []) as Siparis[];

    const grouped = new Map<string, Siparis[]>();

    for (const row of rows) {
      const bayi = row.bayi?.trim();

      if (!bayi) continue;

      if (!grouped.has(bayi)) {
        grouped.set(bayi, []);
      }

      grouped.get(bayi)!.push(row);
    }

    const results = Array.from(grouped.entries()).map(
      ([bayi, siparisler]) => {
        const sorted = siparisler
          .filter((x) => x.satisTarihi)
          .sort(
            (a, b) =>
              new Date(
                b.satisTarihi || ""
              ).getTime() -
              new Date(
                a.satisTarihi || ""
              ).getTime()
          );

        const last = sorted[0];

        const lastOrderDaysAgo =
          daysBetween(last?.satisTarihi);

        const dates = sorted
          .map((x) =>
            new Date(
              x.satisTarihi || ""
            ).getTime()
          )
          .filter((x) => Number.isFinite(x))
          .sort((a, b) => b - a);

        const gaps: number[] = [];

        for (let i = 0; i < dates.length - 1; i++) {
          const diff = Math.floor(
            (dates[i] - dates[i + 1]) /
              (1000 * 60 * 60 * 24)
          );

          if (diff > 0 && diff < 365) {
            gaps.push(diff);
          }
        }

        const averageCycle = Math.round(avg(gaps));

        const totalTonaj = siparisler.reduce(
          (sum, x) =>
            sum + toNumber(x.tonaj),
          0
        );

        const totalAmount =
          siparisler.reduce((sum, x) => {
            return (
              sum +
              Math.max(
                toNumber(x.tutar),
                toNumber(x.vadeliTutar)
              )
            );
          }, 0);

        const productCounts = new Map<
          string,
          number
        >();

        for (const s of siparisler) {
          const key = [s.urun, s.marka]
            .filter(Boolean)
            .join(" / ");

          if (!key) continue;

          productCounts.set(
            key,
            (productCounts.get(key) || 0) + 1
          );
        }

        const favoriteProduct =
          Array.from(
            productCounts.entries()
          ).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          "Belirsiz";

        let score = 0;

        const reasons: string[] = [];

        if (lastOrderDaysAgo !== null) {
          if (lastOrderDaysAgo >= 45) {
            score += 30;

            reasons.push(
              `Son siparişin üzerinden ${lastOrderDaysAgo} gün geçmiş.`
            );
          } else if (
            lastOrderDaysAgo >= 25
          ) {
            score += 18;

            reasons.push(
              "Son sipariş tarihi yeniden temas için uygun görünüyor."
            );
          }
        }

        if (
          averageCycle > 0 &&
          lastOrderDaysAgo !== null
        ) {
          if (
            lastOrderDaysAgo >= averageCycle
          ) {
            score += 30;

            reasons.push(
              `Geçmiş alış döngüsüne göre yeniden sipariş zamanı gelmiş olabilir. Ortalama döngü: ${averageCycle} gün.`
            );
          } else if (
            lastOrderDaysAgo >=
            averageCycle * 0.75
          ) {
            score += 15;

            reasons.push(
              `Ortalama alış döngüsüne yaklaşıyor. Ortalama döngü: ${averageCycle} gün.`
            );
          }
        }

        if (siparisler.length >= 3) {
          score += 15;

          reasons.push(
            "Geçmişte tekrar eden sipariş davranışı var."
          );
        }

        if (totalTonaj >= 100) {
          score += 15;

          reasons.push(
            "Toplam tonaj hacmi yüksek."
          );
        } else if (totalTonaj >= 30) {
          score += 8;

          reasons.push(
            "Orta ölçekli düzenli alım potansiyeli var."
          );
        }

        if (totalAmount >= 1_000_000) {
          score += 10;

          reasons.push(
            "Ciro katkısı yüksek bayi grubunda."
          );
        }

        score = Math.min(
          100,
          Math.round(score)
        );

        let priority = "Düşük";

        if (score >= 70) {
          priority = "Yüksek";
        } else if (score >= 45) {
          priority = "Orta";
        }

        return {
          bayi,
          score,
          priority,
          lastOrderDate:
            last?.satisTarihi || null,
          lastOrderDaysAgo,
          averageCycle,
          totalOrders:
            siparisler.length,
          totalTonaj,
          totalAmount,
          favoriteProduct,
          reasons,
        };
      }
    );

    const topResults = results
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    let aiComment = "";

    try {
      const ollamaResponse = await fetch(
        `${OLLAMA_URL}/api/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            model: OLLAMA_MODEL,
            stream: false,
            prompt: `
Sen Niba Tarım için çalışan ileri seviye ticari analiz asistansın.

Aşağıda sipariş verme ihtimali yüksek bayiler bulunmaktadır.

Her bayi için:
- skor
- sipariş döngüsü
- son sipariş tarihi
- tonaj
- ciro
- favori ürün

bilgileri verilmiştir.

Görevin:
- En sıcak bayileri yorumla
- Kısa satış aksiyonları öner
- Riskli veya kaçırılabilecek bayileri belirt
- Muhtemel ürünleri tahmin et
- Gereksiz uzun cevap verme
- Türkçe cevap ver
- Ticari düşün

Veri:

${JSON.stringify(
  topResults,
  null,
  2
)}
`,
          }),
          cache: "no-store",
        }
      );

      const ollamaData =
        await ollamaResponse.json();

      aiComment =
        ollamaData?.response || "";
    } catch (err) {
      aiComment =
        "AI yorumu alınamadı.";
    }

    return NextResponse.json({
      ok: true,
      generatedAt:
        new Date().toISOString(),
      model: OLLAMA_MODEL,
      aiComment,
      count: topResults.length,
      data: topResults,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err?.message ||
          "Bilinmeyen hata",
      },
      {
        status: 500,
      }
    );
  }
}