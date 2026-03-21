import { useState, useEffect, useRef } from "react";
import {
  collection,
  doc,
  getDoc,
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
      return;
    }
    setLoading(true);
    setError(null);

    const chatId = `${user.uid}_${character.id}`;
    chatIdRef.current = chatId;

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    getDocs(q).then((snap) => {
      const loaded: Message[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          role: data.role,
          content: data.content,
          timestamp: data.timestamp instanceof Timestamp
            ? data.timestamp.toMillis()
            : data.timestamp || Date.now(),
        };
      });
      setMessages(loaded);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [user, character]);

  const send = async (text: string) => {
    if (!user || !character || !text.trim() || sending) return;
    if (keys.length === 0) {
      setError("Vui lòng thêm API Key trong Cài đặt trước khi chat.");
      return;
    }

    const chatId = chatIdRef.current || `${user.uid}_${character.id}`;
    chatIdRef.current = chatId;

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setError(null);
    setStatusText("Đang kết nối tâm giao...");

    const messagesRef = collection(db, "chats", chatId, "messages");
    await addDoc(messagesRef, {
      role: "user",
      content: text,
      timestamp: serverTimestamp(),
    });

    const systemPrompt = `${character.personality}\n\nLời nguyền của bạn: "${character.curse}"\nSlogan: "${character.slogan}"`;
    const historyForAI = messages.slice(-20);

    let lastError: unknown = null;
    let response: string | null = null;
    const totalKeys = keys.length;

    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const keyIdx = (keyIndexRef.current + attempt) % totalKeys;
      const apiKey = keys[keyIdx];

      try {
        setStatusText("Linh hồn đang phản hồi...");
        response = await sendMessage(apiKey, model, systemPrompt, historyForAI, text);
        keyIndexRef.current = keyIdx;
        break;
      } catch (err: unknown) {
        lastError = err;
        const errCode = (err as { code?: number })?.code;
        if (errCode === 429 || errCode === 400) {
          setStatusText(`Key ${attempt + 1} bị lỗi, đang thử key khác...`);
          continue;
        }
        break;
      }
    }

    if (response) {
      const aiMsg: Message = {
        id: `msg_ai_${Date.now()}`,
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      await addDoc(messagesRef, {
        role: "assistant",
        content: response,
        timestamp: serverTimestamp(),
      });
    } else {
      setError(getErrorMessage(lastError));
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    }

    setSending(false);
    setStatusText("");
  };

  const clearHistory = async () => {
    if (!user || !character) return;
    const chatId = chatIdRef.current || `${user.uid}_${character.id}`;
    setMessages([]);
    const chatDocRef = doc(db, "chats", chatId);
    await setDoc(chatDocRef, { cleared: true, clearedAt: serverTimestamp() }, { merge: true });
  };

  return { messages, loading, sending, statusText, error, send, clearHistory };
}
