import type { GeminiModel, Message } from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function modelUrl(modelId: string, apiKey: string): string {
  const id = modelId.startsWith("models/") ? modelId : `models/${modelId}`;
  return `${API_BASE}/${id}:generateContent?key=${apiKey}`;
}

export interface GeminiError { code: number; message: string; }

/** Send a chat message — gọi thẳng model được chọn, không fallback */
export async function sendMessage(
  apiKey: string,
  model: GeminiModel,
  systemPrompt: string,
  history: Message[],
  userMessage: string,
  maxOutputTokens: number = 2048
): Promise<string> {
  const modelId = (typeof model === "string" && model.trim()) ? model.trim() : "gemini-2.5-flash";

  const contents = history.map(msg => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const body = {
    systemInstruction: {
      parts: [{
        text: `${systemPrompt}\n\nQuy tắc bắt buộc: Luôn phản hồi 100% bằng tiếng Việt tự nhiên, trừ khi người dùng yêu cầu ngôn ngữ khác.`,
      }],
    },
    contents,
    generationConfig: {
      temperature: 0.92,
      maxOutputTokens: Math.min(Math.max(maxOutputTokens, 200), 12000),
      topP: 0.95,
    },
  };

  const response = await fetch(modelUrl(modelId, apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.ok) {
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw Object.assign(new Error("AI không trả về nội dung. Vui lòng thử lại."), { code: 0 });
    return text;
  }

  const errData = await response.json().catch(() => ({}));
  const errMsg = (errData as { error?: { message?: string } })?.error?.message || `Lỗi kết nối AI (HTTP ${response.status})`;
  throw Object.assign(new Error(errMsg), { code: response.status });
}

/** Kiểm tra nhanh xem một model có hoạt động với API key không */
export async function testModel(apiKey: string, modelId: string): Promise<boolean> {
  try {
    const body = {
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
      generationConfig: { maxOutputTokens: 5 },
    };
    const res = await fetch(modelUrl(modelId, apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Raw Gemini call — cho phone/gift generation */
export async function geminiRaw(apiKey: string, model: string, prompt: string, maxTokens = 2048): Promise<string> {
  const modelId = (typeof model === "string" && model.trim()) ? model.trim() : "gemini-2.5-flash";
  const res = await fetch(modelUrl(modelId, apiKey), {
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
