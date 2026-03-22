import type { GeminiModel, Message } from "./types";

export interface GeminiError { code: number; message: string; }

export async function sendMessage(
  apiKey: string,
  model: GeminiModel,
  systemPrompt: string,
  history: Message[],
  userMessage: string,
  maxOutputTokens: number = 4096
): Promise<string> {
  // GeminiModel là string — dùng thẳng, không dùng .id
  let mId: string = (typeof model === "string" && model.trim()) ? model.trim() : "gemini-2.5-flash";
  if (!mId.startsWith("models/")) mId = `models/${mId}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/${mId}:generateContent?key=${apiKey}`;

  const contents = history.map(msg => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: contents,
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: Math.min(Math.max(maxOutputTokens, 200), 12000),
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const e = new Error((err as { error?: { message?: string } }).error?.message || `Lỗi ${response.status}`);
    (e as Error & { code: number }).code = response.status;
    throw e;
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Kiểm tra nhanh xem model có hoạt động với API key không */
export async function testModel(apiKey: string, modelId: string): Promise<boolean> {
  try {
    let mId = modelId.trim();
    if (!mId.startsWith("models/")) mId = `models/${mId}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${mId}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Raw call — dùng cho phone/gift generation */
export async function geminiRaw(apiKey: string, model: string, prompt: string, maxTokens = 2048): Promise<string> {
  let mId = (typeof model === "string" && model.trim()) ? model.trim() : "gemini-2.5-flash";
  if (!mId.startsWith("models/")) mId = `models/${mId}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/${mId}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Lỗi AI (HTTP ${res.status})`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
