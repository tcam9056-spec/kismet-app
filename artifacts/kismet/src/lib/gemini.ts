import type { GeminiModel, Message } from "./types";

export interface GeminiError { code: number; message: string; }

export async function sendMessage(
  apiKey: string,
  model: GeminiModel,
  systemPrompt: string,
  history: Message[],
  userMessage: string,
  maxOutputTokens = 2048
): Promise<string> {
  let mId = (model as string) || "gemini-2.5-flash";
  if (!mId.startsWith("models/")) mId = `models/${mId}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/${mId}:generateContent?key=${apiKey}`;

  const contents = history.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: Math.min(Math.max(maxOutputTokens, 200), 12000),
    },
  };

  if (systemPrompt?.trim()) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const code = err.error?.code ?? response.status;
    const msg = err.error?.message ?? `HTTP ${response.status}`;
    const e = new Error(msg) as Error & { code: number };
    e.code = code;
    throw e;
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Không nhận được phản hồi từ AI.");
  return text;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
