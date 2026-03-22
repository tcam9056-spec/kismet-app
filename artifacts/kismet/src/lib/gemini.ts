import type { GeminiModel, Message } from "./types";

/* ── Model fallback chains (if preferred model not found, try next) ── */
export const MODEL_FALLBACKS: Record<string, string[]> = {
  "gemini-3.1-pro":   ["gemini-2.5-pro", "gemini-2.0-pro-exp-03-25", "gemini-2.0-pro-exp", "gemini-1.5-pro-002", "gemini-1.5-pro"],
  "gemini-3.1-flash": ["gemini-2.5-flash", "gemini-2.0-flash-exp", "gemini-2.0-flash", "gemini-1.5-flash-002", "gemini-1.5-flash"],
  "gemini-2.5-pro":   ["gemini-2.0-pro-exp-03-25", "gemini-2.0-pro-exp", "gemini-1.5-pro-002", "gemini-1.5-pro"],
  "gemini-2.5-flash": ["gemini-2.0-flash-exp", "gemini-2.0-flash", "gemini-1.5-flash-002", "gemini-1.5-flash"],
};

/* ── Track which model actually worked (per API key session) ── */
const resolvedModels: Map<string, string> = new Map();

/** Discover models available for a given API key */
export async function listModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.models as Array<{ name: string; supportedGenerationMethods?: string[] }>) || [])
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => m.name.replace("models/", ""));
  } catch {
    return [];
  }
}

/** Find the first available model from preferred + fallbacks */
export async function resolveModel(apiKey: string, preferred: string): Promise<string> {
  const cacheKey = `${apiKey.slice(-8)}_${preferred}`;
  if (resolvedModels.has(cacheKey)) return resolvedModels.get(cacheKey)!;

  const chain = [preferred, ...(MODEL_FALLBACKS[preferred] || [])];
  const available = await listModels(apiKey);

  if (available.length > 0) {
    for (const m of chain) {
      if (available.includes(m)) {
        resolvedModels.set(cacheKey, m);
        return m;
      }
    }
    /* None of the chain found — use first available generateContent model */
    const best = available.find(m => m.includes("flash")) || available[0];
    resolvedModels.set(cacheKey, best);
    return best;
  }

  /* listModels failed (network issue?) — return preferred and let API decide */
  return preferred;
}

export interface GeminiError { code: number; message: string; }

/** Send a chat message with automatic model fallback on 404 */
export async function sendMessage(
  apiKey: string,
  model: GeminiModel,
  systemPrompt: string,
  history: Message[],
  userMessage: string,
  maxOutputTokens: number = 2048
): Promise<string> {
  const preferred = (typeof model === "string" && model.trim()) ? model.trim() : "gemini-2.5-flash";
  const chain = [preferred, ...(MODEL_FALLBACKS[preferred] || [])];

  const contents = history.map(msg => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const body = {
    systemInstruction: {
      parts: [{
        text: `${systemPrompt}\n\nQuy tắc bắt buộc: Luôn phản hồi 100% bằng tiếng Việt tự nhiên, trừ khi người dùng yêu cầu ngôn ngữ khác.`
      }]
    },
    contents,
    generationConfig: {
      temperature: 0.92,
      maxOutputTokens: Math.min(Math.max(maxOutputTokens, 200), 12000),
      topP: 0.95,
    },
  };

  let lastError: string = "";

  /* Try primary model then each fallback */
  for (const modelId of chain) {
    const mId = modelId.startsWith("models/") ? modelId : `models/${modelId}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${mId}:generateContent?key=${apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      lastError = "Lỗi kết nối mạng";
      continue;
    }

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("AI không trả về nội dung. Vui lòng thử lại.");
      /* Cache which model worked */
      const cacheKey = `${apiKey.slice(-8)}_${preferred}`;
      resolvedModels.set(cacheKey, modelId);
      return text;
    }

    const errData = await response.json().catch(() => ({}));
    const errMsg = (errData as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`;
    const code = response.status;

    if (code === 404) {
      /* Model not found — try next in chain */
      lastError = `${modelId}: không tìm thấy`;
      continue;
    }

    /* Non-404 errors: throw immediately with proper code */
    const e = new Error(errMsg) as Error & { code: number };
    e.code = code;
    throw e;
  }

  /* All fallbacks exhausted */
  const e = new Error(`Không thể gọi AI. Đã thử ${chain.length} model: ${lastError}`) as Error & { code: number };
  e.code = 404;
  throw e;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Raw Gemini call (for JSON generation — phone/gift) with fallback */
export async function geminiRaw(apiKey: string, model: string, prompt: string, maxTokens = 2048): Promise<string> {
  const preferred = (typeof model === "string" && model.trim()) ? model.trim() : "gemini-2.5-flash";
  const chain = [preferred, ...(MODEL_FALLBACKS[preferred] || [])];

  for (const modelId of chain) {
    const mId = modelId.startsWith("models/") ? modelId : `models/${modelId}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${mId}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: maxTokens },
        }),
      });
      if (!res.ok) {
        if (res.status === 404) continue;
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
      if ((e as Error).message?.includes("404")) continue;
      throw e;
    }
  }
  return "";
}
