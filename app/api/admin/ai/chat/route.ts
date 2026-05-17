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

const OLLAMA_URL =
  process.env.OLLAMA_URL || "http://127.0.0.1:11434";

const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL || "qwen2.5:7b";

async function askPythonAI(rows: any[], question: string) {
  const res = await fetch(`${PYTHON_AI_URL}/predict-next-buyers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rows,
      question,
    }),
    cache: "no-store",
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Python AI hata verdi: ${res.status} - ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Python AI JSON dönmedi: ${text}`);
  }
}

async function askOllama(prompt: string) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Ollama cevap vermedi.");
  }

  const json = await res.json();
  return json.response || "";
}

function buildFallback(results: any[]) {
  const top = results.slice(0, 7);

  return `Şu an modele göre en sıcak bayiler:

${top
  .map((x: any, i: number) => {
    return `${i + 1}. ${x.bayi}
- Satın alma olasılığı: %${x.score}
- Son sipariş: ${x.lastOrderDate || "-"}
- Son siparişten geçen gün: ${x.daysSinceLast ?? "-"}
- Ortalama döngü: ${x.avgCycle || "-"} gün
- En çok aldığı ürün: ${x.favoriteProduct || "Belirsiz"}
- Toplam tonaj: ${x.totalTonaj || 0} ton
- Toplam ciro: ${x.totalCiro || 0}`;
  })
  .join("\n\n")}

Kısa aksiyon:
İlk 3 bayiyi bugün ara. Ortalama döngüsü dolmuş ve skoru yüksek bayilere öncelik ver.`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = String(body?.question || "").trim();

    if (!question) {
      return NextResponse.json(
        { ok: false, error: "Soru boş olamaz." },
        { status: 400 }
      );
    }

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

    const pythonResult = await askPythonAI(data || [], question);

    if (!pythonResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            pythonResult.error ||
            "Python analiz motoru hata verdi.",
        },
        { status: 500 }
      );
    }

    const results = pythonResult.results || [];

    const compactData = results
      .slice(0, 12)
      .map((x: any, i: number) => {
        return `
${i + 1}) Bayi: ${x.bayi}
Satın Alma Olasılığı: %${x.score}
Son Sipariş Tarihi: ${x.lastOrderDate || "-"}
Son Siparişten Geçen Gün: ${x.daysSinceLast ?? "-"}
Ortalama Alış Döngüsü: ${x.avgCycle || "-"} gün
Tahmini Tekrar Alım Tarihi: ${x.expectedNextOrderDate || "-"}
Tahmini Gün Farkı: ${x.daysToExpected ?? "-"}
Toplam Sipariş: ${x.totalOrders || 0}
Toplam Tonaj: ${x.totalTonaj || 0}
Toplam Ciro: ${x.totalCiro || 0}
Favori Ürün: ${x.favoriteProduct || "Belirsiz"}
`;
      })
      .join("\n");

    const prompt = `
Sen Niba Tarım'ın satış analiz asistanısın.

Kullanıcının sorusuna aşağıdaki Python ML tahmin sonucuna göre cevap ver.

Kurallar:
- Türkçe cevap ver.
- Kısa, net ve ticari konuş.
- En sıcak bayileri sırala.
- Muhtemel ürünleri belirt.
- Bugün aranacak bayileri öner.
- Veride olmayan şeyi uydurma.

Kullanıcının sorusu:
${question}

Python ML tahmin özeti:
${compactData}

Cevap formatı:
1. En güçlü öneri
2. İlk aranacak bayiler
3. Nedenleri
4. Bugünkü aksiyon
`;

    let answer = "";

    try {
      answer = await askOllama(prompt);
    } catch {
      answer = buildFallback(results);
    }

    return NextResponse.json({
      ok: true,
      model: OLLAMA_MODEL,
      answer,
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Bilinmeyen hata oluştu.",
      },
      { status: 500 }
    );
  }
}