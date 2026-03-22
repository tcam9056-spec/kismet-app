import type { GeminiModel, Message } from "./types";

export interface GeminiError { code: number; message: string; }

export async function sendMessage(
  apiKey: string,
  model: GeminiModel,
  systemPrompt: string,
  history: Message[],
  userMessage: string
): Promise<string> {
  // Tui gom gọn tên model để điện thoại không bẻ dòng được
  let mId = model?.id || "models/gemini-2.5-flash";
  if (!mId.startsWith('models/')) mId = `models/${mId}`;

  // Cái link này dù có bị xuống hàng vẫn chạy tốt bà nhé
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
      generationConfig: { temperature: 0.9, maxOutputTokens: 4096 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Lỗi ${response.status}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// 1. Hàm lưu tin nhắn (Bắt buộc để xây dựng cộng đồng sau này)
export async function saveMessageToDb(characterId: number, role: string, content: string) {
  try {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId, role, content })
    });
  } catch (e) {
    console.error("Lỗi lưu tin:", e);
  }
}

// 2. Hàm lấy Profile User (Để AI biết ngoại hình bà)
export function getUserContext(): string {
  try {
    const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    return `[Ngoại hình User]: ${profile.appearance || 'Tự do'}. [Tính cách]: ${profile.personality || 'Bình thường'}.`;
  } catch {
    return "";
  }
}

// 3. Hàm lấy Tokens từ thanh trượt (Để AI viết dài 12k)
export function getMaxTokens(): number {
  const saved = localStorage.getItem('kismet_maxTokens');
  return saved ? parseInt(saved) : 4096;
}
