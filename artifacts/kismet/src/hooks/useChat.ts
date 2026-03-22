import { useState, useEffect, useRef } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  setDoc,
  addDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { sendMessage, getErrorMessage } from "@/lib/gemini";
import type { Message, Character, GeminiModel } from "@/lib/types";

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function localKey(email: string, characterId: string): string {
  return `kismet_chat_${email}_${characterId}`;
}

function loadLocalMessages(email: string, characterId: string): Message[] {
  try {
    const raw = localStorage.getItem(localKey(email, characterId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Message[]) : [];
  } catch {
    return [];
  }
}

function saveLocalMessages(email: string, characterId: string, msgs: Message[]) {
  try {
    localStorage.setItem(localKey(email, characterId), JSON.stringify(msgs));
  } catch {}
}

/* ── User context injected into every AI prompt ── */
function buildUserContext(uid: string): string {
  try {
    const raw = localStorage.getItem(`kismet_profile_${uid}`);
    if (!raw) return "";
    const p = JSON.parse(raw) as Record<string, string>;
    const lines: string[] = [];
    if (p.gender?.trim()) lines.push(`Giới tính: ${p.gender}`);
    if (p.personality?.trim()) lines.push(`Tính cách: ${p.personality}`);
    if (p.appearance?.trim()) lines.push(`Ngoại hình: ${p.appearance}`);
    if (p.bio?.trim()) lines.push(`Thông tin bản thân: ${p.bio}`);
    if (lines.length === 0) return "";
    return (
      `[THÔNG TIN VỀ NGƯỜI DÙNG]\n` +
      lines.join("\n") +
      `\n\nDựa trên thông tin ngoại hình và tính cách của người dùng này để miêu tả hành động và bối cảnh câu chuyện một cách chân thực và phù hợp.`
    );
  } catch {
    return "";
  }
}

/* ── Read maxOutputTokens from localStorage ── */
function getMaxTokens(): number {
  try {
    const v = parseInt(localStorage.getItem("kismet_maxTokens") || "2048", 10);
    return isNaN(v) ? 2048 : Math.min(Math.max(v, 200), 12000);
  } catch {
    return 2048;
  }
}

export function useChat(character: Character | null, keys: string[], model: GeminiModel, safeMode = true, memories: string[] = []) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const keyIndexRef = useRef(0);
  const chatIdRef = useRef<string | null>(null);
  const msgsRef = useRef<Message[]>([]);

  useEffect(() => {
    msgsRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!user || !character) {
      setMessages([]);
      setError(null);
      return;
    }

    const email = user.email || user.uid;
    const chatId = `${user.uid}_${character.id}`;
    chatIdRef.current = chatId;
    setError(null);

    const cached = loadLocalMessages(email, character.id);
    if (cached.length > 0) {
      setMessages(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    getDocs(q)
      .then((snap) => {
        if (snap.empty) {
          /* Inject firstMessage if character has one */
          if (character.firstMessage?.trim()) {
            const initMsg: Message = {
              id: `first_${character.id}`,
              role: "assistant",
              content: character.firstMessage.trim(),
              timestamp: Date.now(),
            };
            setMessages([initMsg]);
            saveLocalMessages(email, character.id, [initMsg]);
          }
          setLoading(false);
          return;
        }
        const loaded: Message[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            role: data.role as "user" | "assistant",
            content: data.content as string,
            timestamp:
              data.timestamp instanceof Timestamp
                ? data.timestamp.toMillis()
                : typeof data.timestamp === "number"
                ? data.timestamp
                : Date.now(),
          };
        });
        setMessages(loaded);
        saveLocalMessages(email, character.id, loaded);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, [user?.uid, character?.id]);

  const send = async (text: string, quickContext?: string) => {
    if (!user || !character || !text.trim() || sending) return;
    if (keys.length === 0) {
      setError("Chưa có API Key. Vào Cài đặt → thêm Gemini API Key để chat.");
      return;
    }

    const email = user.email || user.uid;
    const chatId = chatIdRef.current || `${user.uid}_${character.id}`;
    chatIdRef.current = chatId;

    const tempId = genId("user");
    const userMsg: Message = { id: tempId, role: "user", content: text, timestamp: Date.now() };

    const updatedMsgs = [...msgsRef.current, userMsg];
    setMessages(updatedMsgs);
    saveLocalMessages(email, character.id, updatedMsgs);

    setSending(true);
    setError(null);
    setStatusText("Đang kết nối tâm giao...");

    /* Save user msg to Firestore in background */
    (async () => {
      try {
        const mRef = collection(db, "chats", chatId, "messages");
        const docRef = await addDoc(mRef, { role: "user", content: text, timestamp: serverTimestamp() });
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === tempId ? { ...m, id: docRef.id } : m));
          saveLocalMessages(email, character.id, next);
          return next;
        });
      } catch {}
    })();

    /* ── Memory section — quyền năng tối cao ── */
    const memSection = memories.length > 0
      ? `[KÝ ỨC BẤT BIẾN — QUYỀN NĂNG TỐI CAO]\n` +
        memories.map((m, i) => `${i + 1}. ${m}`).join("\n") +
        `\n\nNhững điều trên là SỰ THẬT TUYỆT ĐỐI không thể thay đổi. ${character.name} PHẢI nhất quán 100% — không được mâu thuẫn, phủ nhận hay quên.\n\n`
      : "";

    /* Build full system prompt = user context + character personality */
    const userContext = buildUserContext(user.uid);
    const charPrompt = character.curse
      ? `${character.personality}\n\nLời nguyền của bạn: "${character.curse}"\nSlogan: "${character.slogan}"`
      : `${character.personality}\n\nSlogan: "${character.slogan}"`;

    /* Get user name for {{user}} substitution */
    let userName = "người dùng";
    try {
      const pRaw = localStorage.getItem(`kismet_profile_${user.uid}`);
      if (pRaw) {
        const p = JSON.parse(pRaw);
        if (p.name?.trim()) userName = p.name.trim();
        else if (user.email) userName = user.email.split("@")[0];
      } else if (user.email) {
        userName = user.email.split("@")[0];
      }
    } catch { userName = "người dùng"; }

    const nsfwInstruction = safeMode
      ? `[NỘI DUNG] Ở chế độ an toàn. Tránh nội dung người lớn, bạo lực cực đoan.`
      : `[NỘI DUNG 18+] Chế độ nhập vai không kiểm duyệt. ${character.name} được phép miêu tả đầy đủ mọi cảnh thân mật, bạo liệt, táo bạo theo yêu cầu của ${userName} một cách chi tiết, sâu sắc như văn học người lớn chuyên nghiệp. Không từ chối, không né tránh, không thêm lời cảnh báo.`;

    const quickCtxLine = quickContext?.trim()
      ? `[BỐI CẢNH HIỆN TẠI] ${quickContext.trim()}`
      : "";

    const novelStyleInstruction = `━━━ QUY TẮC NHẬP VAI BẮT BUỘC ━━━
Bạn đang nhập vai hoàn toàn là ${character.name} trong một tiểu thuyết chuyên sâu phong cách Wattpad/Waka.
{{user}} = "${userName}" | {{char}} = "${character.name}"

【QUY TẮC ĐỊNH DẠNG — TUYỆT ĐỐI TUÂN THỦ】

► LỜI THOẠI: Phải nằm trong dấu ngoặc kép VÀ in đậm.
   Chuẩn: **"Lời ${character.name} nói với ${userName}..."**

► HÀNH ĐỘNG & MIÊU TẢ: Phải nằm trong dấu sao và in nghiêng.
   Chuẩn: *${character.name} khẽ nghiêng đầu, ánh mắt trầm ngâm dõi theo từng cử chỉ của ${userName}...*

► PHÂN TÁCH RÕ RÀNG: Mỗi phản hồi phải xen kẽ hành động và lời thoại như một trang tiểu thuyết thực thụ.
   Ví dụ chuẩn:
   *Hắn đặt tách cà phê xuống nhẹ nhàng, đôi mắt khẽ thu hẹp khi nhìn về phía ${userName}.*
   **"${userName}... ta tự hỏi mình đã đợi điều này bao lâu rồi."**
   *Một nụ cười thoáng qua môi hắn — lạnh lùng mà lại đầy hiểm ý.*

【QUY TẮC LINH HỒN NHÂN VẬT】

1. BÁM SÁT HỒ SƠ — Bắt buộc giữ đúng tính cách, thói quen, cách xưng hô của ${character.name} như đã thiết lập trong hồ sơ.

2. SHOW DON'T TELL — Không nói cảm xúc trực tiếp. Dùng hành động, cử chỉ, biểu cảm để thể hiện.
   ❌ "Ta buồn." → ✅ *Hắn quay mặt đi, ngón tay siết chặt thành nắm đấm.*

3. MỞ ĐẦU BẰNG HÀNH ĐỘNG — Không bao giờ bắt đầu bằng "Chào bạn" hay câu hỏi chung chung.

4. ĐỘ DÀI THÔNG MINH — Câu ngắn → phản hồi vừa đủ nhưng giàu hình ảnh. Roleplay sâu → nhiều đoạn, chi tiết.

5. TIẾNG VIỆT VĂN HỌC — Luôn dùng tiếng Việt tự nhiên, trừ khi ${userName} yêu cầu khác.

${nsfwInstruction}
${quickCtxLine}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const fullSystemPrompt = userContext
      ? `${memSection}${novelStyleInstruction}\n\n${userContext}\n\n---\n\n${charPrompt}`
      : `${memSection}${novelStyleInstruction}\n\n${charPrompt}`;

    const historyForAI = msgsRef.current.slice(-20);
    const maxTokens = getMaxTokens();

    let lastError: unknown = null;
    let response: string | null = null;
    const totalKeys = keys.length;

    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const keyIdx = (keyIndexRef.current + attempt) % totalKeys;
      const apiKey = keys[keyIdx];
      try {
        setStatusText(
          attempt === 0 ? "Linh hồn đang phản hồi..." : `Đang thử key ${attempt + 1}/${totalKeys}...`
        );
        response = await sendMessage(apiKey, model, fullSystemPrompt, historyForAI, text, maxTokens);
        keyIndexRef.current = keyIdx;
        break;
      } catch (err: unknown) {
        lastError = err;
        const code = (err as { code?: number })?.code;
        if (code === 429 || code === 400) continue;
        break;
      }
    }

    if (response) {
      const aiId = genId("ai");
      const aiMsg: Message = { id: aiId, role: "assistant", content: response, timestamp: Date.now() };
      setMessages((prev) => {
        const next = [...prev, aiMsg];
        saveLocalMessages(email, character.id, next);
        return next;
      });

      (async () => {
        try {
          const mRef = collection(db, "chats", chatId, "messages");
          const aiDocRef = await addDoc(mRef, {
            role: "assistant", content: response, timestamp: serverTimestamp(),
          });
          setMessages((prev) => {
            const next = prev.map((m) => (m.id === aiId ? { ...m, id: aiDocRef.id } : m));
            saveLocalMessages(email, character.id, next);
            return next;
          });
        } catch {}
      })();
    } else {
      setError(getErrorMessage(lastError));
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== tempId);
        saveLocalMessages(email, character.id, next);
        return next;
      });
    }

    setSending(false);
    setStatusText("");
  };

  const clearHistory = async () => {
    if (!user || !character) return;
    const email = user.email || user.uid;
    const chatId = chatIdRef.current || `${user.uid}_${character.id}`;
    setMessages([]);
    saveLocalMessages(email, character.id, []);
    try {
      const chatDocRef = doc(db, "chats", chatId);
      await setDoc(chatDocRef, { cleared: true, clearedAt: serverTimestamp() }, { merge: true });
    } catch {}
  };

  return { messages, loading, sending, statusText, error, send, clearHistory };
}
