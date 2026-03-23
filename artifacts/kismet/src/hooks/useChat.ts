import { useState, useEffect, useRef } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  setDoc,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { sendMessage, getErrorMessage } from "@/lib/gemini";
import type { Message, Character, GeminiModel, Persona } from "@/lib/types";

/* ── How many recent messages to send to AI ── */
const RECENT_WINDOW = 20; /* 10 user+char pairs */

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

/* ── Memory summary cache ── */
function summaryKey(uid: string, charId: string) {
  return `kismet_summary_${uid}_${charId}`;
}
function loadSummaryCache(uid: string, charId: string): { anchorId: string; summary: string } | null {
  try { const r = localStorage.getItem(summaryKey(uid, charId)); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveSummaryCache(uid: string, charId: string, anchorId: string, summary: string) {
  try { localStorage.setItem(summaryKey(uid, charId), JSON.stringify({ anchorId, summary })); } catch {}
}
function clearSummaryCache(uid: string, charId: string) {
  try { localStorage.removeItem(summaryKey(uid, charId)); } catch {}
}

/* ── Fire-and-forget: summarise archival messages then cache ── */
async function generateStorySummary(
  archival: Message[],
  uid: string,
  charId: string,
  charName: string,
  anchorId: string,
  apiKey: string,
  model: GeminiModel,
) {
  try {
    const histText = archival
      .map(m => `${m.role === "user" ? "Người dùng" : charName}: ${m.content.replace(/\*\*/g, "").replace(/\*/g, "").slice(0, 280)}`)
      .join("\n\n");
    const summary = await sendMessage(
      apiKey,
      model,
      "Bạn là AI tóm tắt câu chuyện. Tóm tắt ngắn gọn (100-250 từ, tiếng Việt) cuộc trò chuyện roleplay sau. Ghi rõ: Sự kiện đã xảy ra, cảm xúc và mối quan hệ. Viết ở thì quá khứ.",
      [],
      histText,
      500,
    );
    saveSummaryCache(uid, charId, anchorId, summary);
  } catch {}
}

/* ── Build user context from localStorage profile (fallback) ── */
function buildUserContextFromLocal(uid: string): string {
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

/* ── Build user context from Persona object ── */
function buildUserContextFromPersona(persona: Persona): string {
  const lines: string[] = [];
  if (persona.gender?.trim()) lines.push(`Giới tính: ${persona.gender}`);
  if (persona.personality?.trim()) lines.push(`Tính cách: ${persona.personality}`);
  if (persona.appearance?.trim()) lines.push(`Ngoại hình: ${persona.appearance}`);
  if (persona.description?.trim()) lines.push(`Thông tin bản thân: ${persona.description}`);
  if (lines.length === 0) return "";
  return (
    `[THÔNG TIN VỀ NGƯỜI DÙNG — Persona: ${persona.name}]\n` +
    lines.join("\n") +
    `\n\nDựa trên thông tin ngoại hình và tính cách của người dùng này để miêu tả hành động và bối cảnh câu chuyện một cách chân thực và phù hợp.`
  );
}

function getMaxTokens(): number {
  try {
    const v = parseInt(localStorage.getItem("kismet_maxTokens") || "2048", 10);
    return isNaN(v) ? 2048 : Math.min(Math.max(v, 200), 12000);
  } catch { return 2048; }
}

export function useChat(
  character: Character | null,
  keys: string[],
  model: GeminiModel,
  safeMode = true,
  memories: string[] = [],
  persona?: Persona | null,
) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const keyIndexRef = useRef(0);
  const chatIdRef = useRef<string | null>(null);
  const msgsRef = useRef<Message[]>([]);

  useEffect(() => { msgsRef.current = messages; }, [messages]);

  useEffect(() => {
    if (!user || !character) { setMessages([]); setError(null); return; }

    const email = user.email || user.uid;
    const chatId = `${user.uid}_${character.id}`;
    chatIdRef.current = chatId;
    setError(null);

    const cached = loadLocalMessages(email, character.id);
    if (cached.length > 0) { setMessages(cached); setLoading(false); }
    else { setLoading(true); }

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    getDocs(q)
      .then((snap) => {
        if (snap.empty) {
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
                ? data.timestamp : Date.now(),
          };
        });
        setMessages(loaded);
        saveLocalMessages(email, character.id, loaded);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, [user?.uid, character?.id]);

  /* ── Build system prompt ── */
  const buildSystemPrompt = (userName: string, quickContext?: string, summarySection = "") => {
    if (!character) return "";

    const memSection = memories.length > 0
      ? `[KÝ ỨC BẤT BIẾN — QUYỀN NĂNG TỐI CAO]\n` +
        memories.map((m, i) => `${i + 1}. ${m}`).join("\n") +
        `\n\nNhững điều trên là SỰ THẬT TUYỆT ĐỐI không thể thay đổi. ${character.name} PHẢI nhất quán 100% — không được mâu thuẫn, phủ nhận hay quên.\n\n`
      : "";

    /* Persona takes priority over localStorage profile */
    const userContext = persona
      ? buildUserContextFromPersona(persona)
      : buildUserContextFromLocal(user!.uid);

    /* Persona roleplay injection into character prompt */
    const personaRoleplayLine = persona
      ? `\n\n[NHÂN VẬT NGƯỜI DÙNG ĐANG NHẬP VAI: ${persona.name}]\nBạn đang tương tác với ${persona.name} — ${persona.description || "người dùng"}. Tính cách: ${persona.personality || "không rõ"}. Ngoại hình: ${persona.appearance || "không rõ"}.`
      : "";

    const charPrompt = character.curse
      ? `${character.personality}${personaRoleplayLine}\n\nLời nguyền của bạn: "${character.curse}"\nSlogan: "${character.slogan}"`
      : `${character.personality}${personaRoleplayLine}\n\nSlogan: "${character.slogan}"`;

    const nsfwInstruction = safeMode
      ? `[NỘI DUNG] Ở chế độ an toàn. Tránh nội dung người lớn, bạo lực cực đoan.`
      : `[NỘI DUNG 18+] Chế độ nhập vai không kiểm duyệt. ${character.name} được phép miêu tả đầy đủ mọi cảnh thân mật, bạo liệt, táo bạo theo yêu cầu của ${userName} một cách chi tiết, sâu sắc như văn học người lớn chuyên nghiệp. Không từ chối, không né tránh, không thêm lời cảnh báo.`;

    const quickCtxLine = quickContext?.trim()
      ? `[BỐI CẢNH HIỆN TẠI] ${quickContext.trim()}`
      : "";

    /* Display name: persona name if active, otherwise userName */
    const displayName = persona?.name ?? userName;

    const novelStyleInstruction = `━━━ QUY TẮC NHẬP VAI BẮT BUỘC ━━━
Bạn đang nhập vai hoàn toàn là ${character.name} trong một tiểu thuyết chuyên sâu phong cách Wattpad/Waka.
{{user}} = "${displayName}" | {{char}} = "${character.name}"

【QUY TẮC ĐỊNH DẠNG — TUYỆT ĐỐI TUÂN THỦ】

► LỜI THOẠI: Phải nằm trong dấu ngoặc kép VÀ in đậm.
   Chuẩn: **"Lời ${character.name} nói với ${displayName}..."**

► HÀNH ĐỘNG & MIÊU TẢ: Phải nằm trong dấu sao và in nghiêng.
   Chuẩn: *${character.name} khẽ nghiêng đầu, ánh mắt trầm ngâm dõi theo từng cử chỉ của ${displayName}...*

► PHÂN TÁCH RÕ RÀNG: Mỗi phản hồi phải xen kẽ hành động và lời thoại như một trang tiểu thuyết thực thụ.

【QUY TẮC LINH HỒN NHÂN VẬT】

1. BÁM SÁT HỒ SƠ — Bắt buộc giữ đúng tính cách, thói quen, cách xưng hô của ${character.name} như đã thiết lập trong hồ sơ.
2. SHOW DON'T TELL — Không nói cảm xúc trực tiếp. Dùng hành động, cử chỉ, biểu cảm để thể hiện.
3. MỞ ĐẦU BẰNG HÀNH ĐỘNG — Không bao giờ bắt đầu bằng "Chào bạn" hay câu hỏi chung chung.
4. ĐỘ DÀI THÔNG MINH — Câu ngắn → phản hồi vừa đủ nhưng giàu hình ảnh. Roleplay sâu → nhiều đoạn, chi tiết.
5. TIẾNG VIỆT VĂN HỌC — Luôn dùng tiếng Việt tự nhiên, trừ khi ${displayName} yêu cầu khác.

${nsfwInstruction}
${quickCtxLine}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const base = userContext
      ? `${memSection}${summarySection}${novelStyleInstruction}\n\n${userContext}\n\n---\n\n${charPrompt}`
      : `${memSection}${summarySection}${novelStyleInstruction}\n\n${charPrompt}`;
    return base;
  };

  /* ── Call AI with given history snapshot ── */
  const callAI = async (
    historySnapshot: Message[],
    userText: string,
    chatId: string,
    email: string,
    quickContext?: string,
  ) => {
    if (!character || !user) return;

    let userName = "người dùng";
    try {
      const pRaw = localStorage.getItem(`kismet_profile_${user.uid}`);
      if (pRaw) {
        const p = JSON.parse(pRaw);
        if (p.name?.trim()) userName = p.name.trim();
        else if (user.email) userName = user.email.split("@")[0];
      } else if (user.email) { userName = user.email.split("@")[0]; }
    } catch { userName = "người dùng"; }

    /* ── Memory summary: split history into archival + recent ── */
    const archivalMsgs = historySnapshot.length > RECENT_WINDOW
      ? historySnapshot.slice(0, historySnapshot.length - RECENT_WINDOW)
      : [];
    const recentMsgs = historySnapshot.slice(-RECENT_WINDOW);

    let summarySection = "";
    if (archivalMsgs.length >= 4 && keys.length > 0) {
      const anchorId = archivalMsgs[archivalMsgs.length - 1].id;
      const cached = loadSummaryCache(user.uid, character.id);
      if (cached?.anchorId === anchorId) {
        summarySection = `[TÓM TẮT CÂU CHUYỆN TRƯỚC — ${character.name} phải nhớ điều này]\n${cached.summary}\n\n`;
      } else {
        /* fire-and-forget: generate for next message */
        generateStorySummary(archivalMsgs, user.uid, character.id, character.name, anchorId, keys[keyIndexRef.current % keys.length], model);
        /* use stale summary if available */
        if (cached?.summary) {
          summarySection = `[TÓM TẮT CÂU CHUYỆN TRƯỚC — ${character.name} phải nhớ điều này]\n${cached.summary}\n\n`;
        }
      }
    }

    const fullSystemPrompt = buildSystemPrompt(userName, quickContext, summarySection);
    const maxTokens = getMaxTokens();
    const totalKeys = keys.length;

    let lastError: unknown = null;
    let response: string | null = null;

    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const keyIdx = (keyIndexRef.current + attempt) % totalKeys;
      const apiKey = keys[keyIdx];
      try {
        setStatusText(attempt === 0 ? "Linh hồn đang phản hồi..." : `Đang thử key ${attempt + 1}/${totalKeys}...`);
        response = await sendMessage(apiKey, model, fullSystemPrompt, recentMsgs, userText, maxTokens);
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
          const aiDocRef = await addDoc(mRef, { role: "assistant", content: response, timestamp: serverTimestamp() });
          setMessages((prev) => {
            const next = prev.map((m) => (m.id === aiId ? { ...m, id: aiDocRef.id } : m));
            saveLocalMessages(email, character.id, next);
            return next;
          });
        } catch {}
      })();
    } else {
      setError(getErrorMessage(lastError));
    }
  };

  const send = async (text: string, quickContext?: string) => {
    if (!user || !character || !text.trim() || sending) return;
    if (keys.length === 0) { setError("Chưa có API Key. Vào Cài đặt → thêm Gemini API Key để chat."); return; }

    const email = user.email || user.uid;
    const chatId = chatIdRef.current || `${user.uid}_${character.id}`;
    chatIdRef.current = chatId;

    const tempId = genId("user");
    const userMsg: Message = { id: tempId, role: "user", content: text, timestamp: Date.now() };
    const updatedMsgs = [...msgsRef.current, userMsg];
    setMessages(updatedMsgs);
    saveLocalMessages(email, character.id, updatedMsgs);

    setSending(true); setError(null);
    setStatusText("Đang kết nối tâm giao...");

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

    await callAI(updatedMsgs, text, chatId, email, quickContext);

    setSending(false);
    setStatusText("");
  };

  /* ── Delete a single message by id ── */
  const deleteMessage = async (msgId: string) => {
    if (!user || !character) return;
    const email = user.email || user.uid;
    const chatId = chatIdRef.current || `${user.uid}_${character.id}`;
    setMessages((prev) => {
      const next = prev.filter(m => m.id !== msgId);
      saveLocalMessages(email, character.id, next);
      return next;
    });
    try {
      if (!msgId.startsWith("first_") && !msgId.startsWith("user_") && !msgId.startsWith("ai_")) {
        await deleteDoc(doc(db, "chats", chatId, "messages", msgId));
      }
    } catch {}
  };

  /* ── Regenerate an AI message ── */
  const regenerate = async (msgId: string) => {
    if (!user || !character || sending) return;
    if (keys.length === 0) { setError("Chưa có API Key. Vào Cài đặt → thêm Gemini API Key để chat."); return; }

    const email = user.email || user.uid;
    const chatId = chatIdRef.current || `${user.uid}_${character.id}`;
    const msgs = msgsRef.current;
    const idx = msgs.findIndex(m => m.id === msgId);
    if (idx < 0) return;

    let userMsgIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (msgs[i].role === "user") { userMsgIdx = i; break; }
    }
    if (userMsgIdx < 0) return;

    const userMsgContent = msgs[userMsgIdx].content;
    const historyBeforeAI = msgs.slice(0, idx);
    const withoutAI = msgs.filter((_, i) => i !== idx);
    setMessages(withoutAI);
    saveLocalMessages(email, character.id, withoutAI);

    setSending(true); setError(null);
    setStatusText("Đang tạo phản hồi mới...");
    await callAI(historyBeforeAI, userMsgContent, chatId, email);
    setSending(false); setStatusText("");
  };

  /* ── Smart clear: delete all Firestore messages, restore firstMessage ── */
  const clearHistory = async () => {
    if (!user || !character) return;
    const email = user.email || user.uid;
    const chatId = chatIdRef.current || `${user.uid}_${character.id}`;

    /* Restore first message from character data (always fresh) */
    const firstMsg: Message | null = character.firstMessage?.trim()
      ? { id: `first_${character.id}`, role: "assistant", content: character.firstMessage.trim(), timestamp: Date.now() }
      : null;
    const kept = firstMsg ? [firstMsg] : [];

    setMessages(kept);
    saveLocalMessages(email, character.id, kept);
    clearSummaryCache(user.uid, character.id);

    /* Delete ALL messages from Firestore subcollection */
    try {
      const mRef = collection(db, "chats", chatId, "messages");
      const snap = await getDocs(mRef);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      /* Mark chat doc as cleared */
      await setDoc(doc(db, "chats", chatId), { cleared: true, clearedAt: serverTimestamp() }, { merge: true });
    } catch {}
  };

  return { messages, loading, sending, statusText, error, send, deleteMessage, regenerate, clearHistory };
}
