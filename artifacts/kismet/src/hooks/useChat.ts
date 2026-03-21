import { useState, useEffect, useRef } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  setDoc,
  addDoc,
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

export function useChat(character: Character | null, keys: string[], model: GeminiModel) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const keyIndexRef = useRef(0);
  const chatIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !character) {
      setMessages([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);

    const chatId = `${user.uid}_${character.id}`;
    chatIdRef.current = chatId;

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    getDocs(q)
      .then((snap) => {
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
        setLoading(false);
      })
      .catch((err) => {
        console.error("Firestore load error:", err);
        setError(
          "Không thể tải lịch sử chat. Hãy kiểm tra cấu hình Firestore Security Rules (cho phép authenticated users đọc/ghi)."
        );
        setLoading(false);
      });
  }, [user, character?.id]);

  const send = async (text: string) => {
    if (!user || !character || !text.trim() || sending) return;
    if (keys.length === 0) {
      setError(
        "Chưa có API Key. Vào Cài đặt → thêm Gemini API Key để bắt đầu chat."
      );
      return;
    }

    const chatId = chatIdRef.current || `${user.uid}_${character.id}`;
    chatIdRef.current = chatId;

    const tempId = genId("user");
    const userMsg: Message = {
      id: tempId,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setError(null);
    setStatusText("Đang kết nối tâm giao...");

    let firestoreUserDocId: string | null = null;
    try {
      const messagesRef = collection(db, "chats", chatId, "messages");
      const docRef = await addDoc(messagesRef, {
        role: "user",
        content: text,
        timestamp: serverTimestamp(),
      });
      firestoreUserDocId = docRef.id;
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: docRef.id } : m))
      );
    } catch (fsErr) {
      console.error("Firestore write error:", fsErr);
    }

    const systemPrompt = `${character.personality}\n\nLời nguyền của bạn: "${character.curse}"\nSlogan: "${character.slogan}"`;
    const historyForAI = messages.slice(-20);

    let lastError: unknown = null;
    let response: string | null = null;
    const totalKeys = keys.length;

    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const keyIdx = (keyIndexRef.current + attempt) % totalKeys;
      const apiKey = keys[keyIdx];

      try {
        setStatusText(
          attempt === 0
            ? "Linh hồn đang phản hồi..."
            : `Đang thử key ${attempt + 1}/${totalKeys}...`
        );
        response = await sendMessage(apiKey, model, systemPrompt, historyForAI, text);
        keyIndexRef.current = keyIdx;
        break;
      } catch (err: unknown) {
        lastError = err;
        const errCode = (err as { code?: number })?.code;
        if (errCode === 429 || errCode === 400) {
          continue;
        }
        break;
      }
    }

    if (response) {
      const aiMsgId = genId("ai");
      const aiMsg: Message = {
        id: aiMsgId,
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      try {
        const messagesRef = collection(db, "chats", chatId, "messages");
        const aiDocRef = await addDoc(messagesRef, {
          role: "assistant",
          content: response,
          timestamp: serverTimestamp(),
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, id: aiDocRef.id } : m))
        );
      } catch (fsErr) {
        console.error("Firestore AI write error:", fsErr);
      }
    } else {
      setError(getErrorMessage(lastError));
      setMessages((prev) => prev.filter((m) => m.id !== tempId && m.id !== firestoreUserDocId));
    }

    setSending(false);
    setStatusText("");
  };

  const clearHistory = async () => {
    if (!user || !character) return;
    const chatId = chatIdRef.current || `${user.uid}_${character.id}`;
    setMessages([]);
    try {
      const chatDocRef = doc(db, "chats", chatId);
      await setDoc(
        chatDocRef,
        { cleared: true, clearedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("Clear history error:", err);
    }
  };

  return { messages, loading, sending, statusText, error, send, clearHistory };
}
