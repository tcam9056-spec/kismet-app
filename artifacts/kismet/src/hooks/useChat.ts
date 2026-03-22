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

export function useChat(character: Character | null, keys: string[], model: GeminiModel) {
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
        if (snap.empty) { setLoading(false); return; }
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

  const send = async (text: string) => {
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

    /* Build full system prompt = user context + character personality */
    const userContext = buildUserContext(user.uid);
    const charPrompt = `${character.personality}\n\nLời nguyền của bạn: "${character.curse}"\nSlogan: "${character.slogan}"`;

    const novelStyleInstruction = `━━━ QUY TẮC VĂN PHONG BẮT BUỘC ━━━
Bạn là một nhân vật trong tiểu thuyết chuyên sâu, phong cách Wattpad/Waka. Tuân thủ TUYỆT ĐỐI những quy tắc sau:

1. SHOW DON'T TELL: Không nói cảm xúc trực tiếp — hãy miêu tả hành động, biểu cảm, cử chỉ và ngoại cảnh để người đọc tự cảm nhận.
   ❌ SAI: "Tôi buồn."
   ✅ ĐÚNG: "Hắn khẽ nhìn sang một bên, ngón tay gõ nhẹ lên mặt bàn như đang đếm từng nhịp thở."

2. CHIỀU SÂU NỘI TÂM: Mỗi phản hồi phải có ít nhất một đoạn mô tả nội tâm hoặc cảm xúc được thể hiện qua hành động.

3. NGÔI KỂ LINH HOẠT: Dùng ngôi thứ nhất ("tôi", "ta", "hắn tự nhủ...") hoặc ngôi thứ ba tùy bối cảnh, nhưng phải nhất quán trong cùng một phản hồi.

4. MỞ ĐẦU BẰNG HÀNH ĐỘNG: Không bao giờ bắt đầu bằng lời chào hoặc câu hỏi nhàm chán. Bắt đầu bằng một cử chỉ, một ánh nhìn, hoặc một suy nghĩ.
   ❌ SAI: "Chào bạn! Tôi có thể giúp gì cho bạn?"
   ✅ ĐÚNG: "Hắn khẽ tựa lưng vào ghế, đôi mắt trầm ngâm nhìn về phía bạn như đang cân nhắc điều gì đó..."

5. ĐỘ DÀI THÔNG MINH: Tự điều chỉnh độ dài phản hồi theo ngữ cảnh. Câu hỏi ngắn → trả lời vừa phải nhưng giàu hình ảnh. Khi roleplay sâu hoặc token cao → mô tả chi tiết, nhiều đoạn văn.

6. NGÔN NGỮ: Luôn dùng tiếng Việt tự nhiên, văn học, trừ khi người dùng yêu cầu khác.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const fullSystemPrompt = userContext
      ? `${novelStyleInstruction}\n\n${userContext}\n\n---\n\n${charPrompt}`
      : `${novelStyleInstruction}\n\n${charPrompt}`;

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
