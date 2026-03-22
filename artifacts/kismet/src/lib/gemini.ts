import type { GeminiModel, Message } from "./types";

export interface GeminiError { code: number; message: string; }

/* ── Cấu hình cứng: tên hiển thị → { ID thực, API version } ── */
const MODEL_CONFIG: Record<string, { apiId: string; version: "v1" | "v1beta" }> = {
  "gemini-2.5-flash": { apiId: "gemini-1.5-flash",              version: "v1beta" },
  "gemini-2.5-pro":   { apiId: "gemini-1.5-pro",                version: "v1beta" },
  "gemini-3.1-flash": { apiId: "gemini-3.1-flash-lite-preview", version: "v1beta" },
  "gemini-3.1-pro":   { apiId: "gemini-3.1-pro-preview",        version: "v1beta" },
};

function resolveModel(model: string): { mId: string; version: string } {
  const base = model.replace(/^models\//, "").trim();
  const cfg = MODEL_CONFIG[base] ?? { apiId: base, version: "v1" };
  return { mId: `models/${cfg.apiId}`, version: cfg.version };
}

function buildUrl(mId: string, version: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/${version}/${mId}:generateContent?key=${apiKey}`;
}

export async function sendMessage(
  apiKey: string,
  model: GeminiModel,
  systemPrompt: string,
  history: Message[],
  userMessage: string,
  maxOutputTokens: number = 4096
): Promise<string> {
  const { mId, version } = resolveModel(typeof model === "string" ? model : "gemini-2.5-flash");
  const url = buildUrl(mId, version, apiKey);

  const contents = history.map(msg => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: Math.min(Math.max(maxOutputTokens, 200), 12000),
      },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = (errData as { error?: { message?: string } }).error?.message || `Lỗi HTTP ${response.status}`;
    console.error(`[Gemini] FAIL ${model} → ${mId} (${version}) | ${response.status}: ${errMsg}`);
    const e = new Error(errMsg);
    (e as Error & { code: number }).code = response.status;
    throw e;
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Kiểm tra nhanh — ping đúng ID + version của từng model */
export async function testModel(apiKey: string, modelId: string): Promise<boolean> {
  try {
    const { mId, version } = resolveModel(modelId);
    const url = buildUrl(mId, version, apiKey);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error(`[testModel] ${modelId} → ${mId} (${version}) | ${res.status}:`, (body as { error?: { message?: string } }).error?.message);
    }
    return res.ok;
  } catch (e) {
    console.error(`[testModel] ${modelId} exception:`, e);
    return false;
  }
}

/** Raw call — dùng cho phone/gift generation */
export async function geminiRaw(apiKey: string, model: string, prompt: string, maxTokens = 2048): Promise<string> {
  const { mId, version } = resolveModel(typeof model === "string" ? model : "gemini-2.5-flash");
  const url = buildUrl(mId, version, apiKey);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: { message?: string } }).error?.message || `HTTP ${res.status}`;
    console.error(`[geminiRaw] ${model} → ${mId} | ${res.status}: ${msg}`);
    throw new Error(msg);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
