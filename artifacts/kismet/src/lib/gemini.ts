import type { GeminiModel, Message } from "./types";

export interface GeminiError {
  code: number;
  message: string;
}

export async function sendMessage(
  apiKey: string,
  model: GeminiModel,
  systemPrompt: string,
  history: Message[],
  userMessage: string
): Promise<string> {
  const modelId = `models/${model}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${apiKey}`;

  const contents = [];

  for (const msg of history) {
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 2048,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg =
      errorData?.error?.message || `HTTP error ${response.status}`;
    throw { code: response.status, message: errorMsg } as GeminiError;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw { code: 500, message: "Không nhận được phản hồi từ AI" } as GeminiError;
  }

  return text;
}

export function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const err = error as GeminiError;
    switch (err.code) {
      case 400:
        return `Lỗi 400: Sai cú pháp yêu cầu — Kiểm tra lại API Key hoặc Model ID`;
      case 403:
        return `Lỗi 403: Không có quyền truy cập — API Key không đủ quyền với model này`;
      case 404:
        return `Lỗi 404: Model không tìm thấy — Model ${(error as { model?: string }).model || ""} chưa được hỗ trợ hoặc sai tên`;
      case 429:
        return `Lỗi 429: Đã vượt hạn mức — Hết quota, đang thử key khác...`;
      case 500:
        return `Lỗi 500: Lỗi máy chủ Gemini — Thử lại sau`;
      default:
        return `Lỗi ${err.code}: ${err.message}`;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Lỗi không xác định";
}
