import { planFromAi } from "./ai-plan.mjs";
import { secret } from "./accounts";

const MODES = ["quick", "normal", "deep"] as const;
type Mode = (typeof MODES)[number];

export function isMode(value: unknown): value is Mode {
  return MODES.includes(value as Mode);
}

export async function analyzeWithAi(image: string, mode: Mode) {
  const key = secret("OPENAI_API_KEY");
  if (!key) throw new Error("missing_key");
  if (!image.startsWith("data:image/") || image.length > 6_000_000) throw new Error("image");
  const limit = mode === "quick" ? 3 : mode === "deep" ? 6 : 5;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: secret("OPENAI_MODEL") ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Você olha a foto de um cômodo e devolve só JSON para um plano curto de organização em português do Brasil. Seja específico sobre o que a foto mostra. Se estiver escura, o primeiro passo é abrir a luz. Não invente móveis que não aparecem. Formato: {\"insightTitle\",\"insightBody\",\"notes\":[string],\"beforeScore\":number,\"tasks\":[{\"title\",\"detail\",\"minutes\",\"icon\"}]}.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Modo ${mode}. Devolva exatamente ${limit} passos, do mais útil ao reset final.` },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) throw new Error("openai");
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("openai");
  return planFromAi(content, mode);
}
