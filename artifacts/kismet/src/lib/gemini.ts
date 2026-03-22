import type { GeminiModel, Message } from "./types";

export interface GeminiError { code: number; message: string; }

export async function sendMessage(
  apiKey: string,
  model: GeminiModel,
  systemPrompt: string,
  history: Message[],
  userMessage: string,
  maxOutputTokens: number = 2048
): Promise<string> {
  /* model is a plain string like "gemini-2.5-flash" */
  let mId = (typeof model === "string" && model.trim()) ? model.trim() : "gemini-2.5-flash";
  if (!mId.startsWith("models/")) mId = `models/${mId}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/${mId}:generateContent?key=${apiKey}`;

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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const code = response.status;
    const msg = err?.error?.message || `Lỗi HTTP ${code}`;
    const e = new Error(msg) as Error & { code: number };
    e.code = code;
    throw e;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("AI không trả về nội dung. Vui lòng thử lại.");
  return text;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

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
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
