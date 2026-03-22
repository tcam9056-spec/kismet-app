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
    if (!Array.isArray(parsed)) return [];
    return parsed as Message[];
  } catch {
    return [];
  }
}

function saveLocalMessages(email: string, characterId: string, msgs: Message[]) {
  try {
    localStorage.setItem(localKey(email, characterId), JSON.stringify(msgs));
  } catch {
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
        if (snap.empty) {
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
      .catch(() => {
        setLoading(false);
      });
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
    const userMsg: Message = {
      id: tempId,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const updatedMsgs = [...msgsRef.current, userMsg];
    setMessages(updatedMsgs);
    saveLocalMessages(email, character.id, updatedMsgs);

    setSending(true);
    setError(null);
    setStatusText("Đang kết nối tâm giao...");

    (async () => {
      try {
        const messagesRef = collection(db, "chats", chatId, "messages");
        const docRef = await addDoc(messagesRef, {
          role: "user",
          content: text,
          timestamp: serverTimestamp(),
        });
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === tempId ? { ...m, id: docRef.id } : m));
          saveLocalMessages(email, character.id, next);
          return next;
        });
      } catch {
      }
    })();

    const systemPrompt = `${character.personality}\n\nLời nguyền của bạn: "${character.curse}"\nSlogan: "${character.slogan}"`;
    const historyForAI = msgsRef.current.slice(-20);

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
        if (errCode === 429 || errCode === 400) continue;
        break;
      }
    }

    if (response) {
      const aiId = genId("ai");
      const aiMsg: Message = {
        id: aiId,
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      };
      setMessages((prev) => {
        const next = [...prev, aiMsg];
        saveLocalMessages(email, character.id, next);
        return next;
      });

      (async () => {
        try {
          const messagesRef = collection(db, "chats", chatId, "messages");
          const aiDocRef = await addDoc(messagesRef, {
            role: "assistant",
            content: response,
            timestamp: serverTimestamp(),
          });
          setMessages((prev) => {
            const next = prev.map((m) => (m.id === aiId ? { ...m, id: aiDocRef.id } : m));
            saveLocalMessages(email, character.id, next);
            return next;
          });
        } catch {
        }
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
    } catch {
    }
  };

  return { messages, loading, sending, statusText, error, send, clearHistory };
}
