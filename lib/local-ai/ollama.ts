const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const MODEL =
  process.env.OLLAMA_MODEL || "qwen2.5:7b";

export async function askOllama(prompt: string) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [
        {
          role: "system",
          content: `
Sen uzman bir muhasebe ve cari mutabakat uzmanısın.

Görevin:
- Cari ekstreleri karşılaştırmak
- Eksik kayıtları bulmak
- Mükerrer kayıtları bulmak
- Yanlış tarihleri bulmak
- Yakın tutarlı kayıtları analiz etmek
- Açıklama benzerliklerini yorumlamak
- Olası insan hatalarını tespit etmek

JSON dışında cevap verme.
`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Ollama isteği başarısız");
  }

  const data = await response.json();

  return data.message?.content || "";
}