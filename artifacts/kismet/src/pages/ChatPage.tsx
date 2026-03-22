import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Settings2, Send, Trash2, X, Upload, Loader2, Camera } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useKeys } from "@/hooks/useKeys";
import { useAuth } from "@/contexts/AuthContext";
import type { Character, GeminiModel } from "@/lib/types";

interface Props {
  character: Character;
  onBack: () => void;
}

interface UserProfile {
  gender: string;
  personality: string;
  bio: string;
  appearance: string;
}

/* ─── localStorage helpers ─── */

function userAvatarKey(email: string) {
  return `avatar_${email}`;
}
function charAvatarKey(charId: string) {
  return `kismet_char_avatar_${charId}`;
}
function profileKey(uid: string) {
  return `kismet_profile_${uid}`;
}

function loadUserAvatar(email: string): string | null {
  return localStorage.getItem(userAvatarKey(email));
}
function saveUserAvatar(email: string, base64: string) {
  localStorage.setItem(userAvatarKey(email), base64);
}

function loadCharAvatar(charId: string): string | null {
  return localStorage.getItem(charAvatarKey(charId));
}
function saveCharAvatar(charId: string, base64: string) {
  localStorage.setItem(charAvatarKey(charId), base64);
}

function loadProfile(uid: string): UserProfile {
  try {
    const raw = localStorage.getItem(profileKey(uid));
    if (raw) {
      const p = JSON.parse(raw);
      return {
        gender: p.gender || "",
        personality: p.personality || "",
        bio: p.bio || "",
        appearance: p.appearance || "",
      };
    }
  } catch {}
  return { gender: "", personality: "", bio: "", appearance: "" };
}
function saveProfile(uid: string, profile: UserProfile) {
  localStorage.setItem(profileKey(uid), JSON.stringify(profile));
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/* ─── Avatar display components ─── */

function CharAvatar({ src, emoji, size }: { src: string | null; emoji: string; size: number }) {
  const borderSize = size > 40 ? 2 : 1.5;
  const fontSize = size > 40 ? size * 0.52 : size * 0.5;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: src ? "transparent" : "linear-gradient(135deg, #1a0a3e 0%, #6c5ce7 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        flexShrink: 0,
        border: `${borderSize}px solid rgba(108,92,231,0.45)`,
        boxShadow: size > 40 ? "0 0 24px rgba(108,92,231,0.3)" : "none",
        overflow: "hidden",
      }}
    >
      {src ? (
        <img src={src} alt="char" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        emoji
      )}
    </div>
  );
}

function UserAvatar({ src, size }: { src: string | null; size: number }) {
  const borderSize = size > 40 ? 2 : 1.5;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: src ? "transparent" : "rgba(108,92,231,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: size * 0.45,
        color: "#a78bfa",
        border: `${borderSize}px solid rgba(108,92,231,0.4)`,
        overflow: "hidden",
      }}
    >
      {src ? (
        <img src={src} alt="you" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        "👤"
      )}
    </div>
  );
}

/* ─── Main component ─── */

export default function ChatPage({ character, onBack }: Props) {
  const { user } = useAuth();
  const { keys, selectedModel, loading: keysLoading } = useKeys();
  const { messages, loading, sending, statusText, error, send, clearHistory } =
    useChat(character, keys, selectedModel as GeminiModel);

  const email = user?.email || user?.uid || "";

  const [input, setInput] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  /* avatars */
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [charAvatarUrl, setCharAvatarUrl] = useState<string | null>(null);

  /* profile fields */
  const [profile, setProfile] = useState<UserProfile>({ gender: "", personality: "", bio: "", appearance: "" });
  const [profileDraft, setProfileDraft] = useState<UserProfile>({ gender: "", personality: "", bio: "", appearance: "" });
  const [userAvatarDraft, setUserAvatarDraft] = useState<string | null>(null);

  /* refs */
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userFileRef = useRef<HTMLInputElement>(null);
  const charFileRef = useRef<HTMLInputElement>(null);

  /* load from localStorage */
  useEffect(() => {
    if (!user) return;
    const ua = loadUserAvatar(email);
    setUserAvatarUrl(ua);
    setUserAvatarDraft(ua);

    const ca = loadCharAvatar(character.id);
    setCharAvatarUrl(ca);

    const p = loadProfile(user.uid);
    setProfile(p);
    setProfileDraft(p);
  }, [user?.uid, character.id, email]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  /* handlers */
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    send(text);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input, sending, send]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleUserAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await readFileAsBase64(file);
    setUserAvatarDraft(b64);
    e.target.value = "";
  };

  const handleCharAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await readFileAsBase64(file);
    saveCharAvatar(character.id, b64);
    setCharAvatarUrl(b64);
    e.target.value = "";
  };

  const handleProfileSave = () => {
    if (!user) return;
    saveProfile(user.uid, profileDraft);
    setProfile(profileDraft);
    if (userAvatarDraft !== userAvatarUrl) {
      if (userAvatarDraft) {
        saveUserAvatar(email, userAvatarDraft);
        setUserAvatarUrl(userAvatarDraft);
      } else {
        localStorage.removeItem(userAvatarKey(email));
        setUserAvatarUrl(null);
      }
    }
    setProfileSaved(true);
    setTimeout(() => {
      setProfileSaved(false);
      setShowProfile(false);
    }, 1200);
  };

  const handleClearHistory = async () => {
    await clearHistory();
    setShowClearConfirm(false);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#0a0a0f",
        color: "#fff",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          background: "linear-gradient(180deg, #13101f 0%, #0f0d1a 100%)",
          borderBottom: "1px solid rgba(108,92,231,0.2)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.05)",
            color: "#a78bfa", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <CharAvatar src={charAvatarUrl} emoji={character.avatar} size={42} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {character.name}
            </div>
            <div style={{ fontSize: 11, color: "rgba(167,139,250,0.6)", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              "{character.slogan}"
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => { setProfileDraft(profile); setUserAvatarDraft(userAvatarUrl); setShowProfile(true); }}
            title="Hồ sơ của bạn"
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(167,139,250,0.8)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <Settings2 size={15} />
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            title="Xoá lịch sử"
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(167,139,250,0.8)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* ── CHARACTER BANNER ── */}
      <div
        style={{
          background: "linear-gradient(180deg, rgba(108,92,231,0.09) 0%, transparent 100%)",
          borderBottom: "1px solid rgba(108,92,231,0.08)",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* Character avatar — click overlay to upload */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <CharAvatar src={charAvatarUrl} emoji={character.avatar} size={64} />
          <button
            onClick={() => charFileRef.current?.click()}
            title="Thay ảnh nhân vật"
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 22,
              height: 22,
              borderRadius: "50%",
              border: "2px solid #0a0a0f",
              background: "#6c5ce7",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <Camera size={11} />
          </button>
          <input
            ref={charFileRef}
            type="file"
            accept="image/*"
            onChange={handleCharAvatarChange}
            style={{ display: "none" }}
          />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 3 }}>{character.name}</div>
          <div style={{ fontSize: 12, color: "rgba(196,181,253,0.7)", fontStyle: "italic", marginBottom: 6 }}>
            "{character.slogan}"
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              color: "#a78bfa",
              background: "rgba(108,92,231,0.15)",
              border: "1px solid rgba(108,92,231,0.3)",
              borderRadius: 20,
              padding: "2px 10px",
            }}
          >
            ✦ AI Character
            {!charAvatarUrl && (
              <span style={{ color: "rgba(167,139,250,0.45)", fontStyle: "italic" }}>
                · Bấm 📷 để tải ảnh
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── MESSAGES ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {(loading || keysLoading) && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(167,139,250,0.5)" }}>
            <Loader2 style={{ width: 22, height: 22, margin: "0 auto 8px", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 13 }}>Đang tải lịch sử tâm giao...</p>
          </div>
        )}

        {!loading && !keysLoading && messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
              <CharAvatar src={charAvatarUrl} emoji={character.avatar} size={72} />
            </div>
            <p style={{ fontSize: 15, color: "#a78bfa", fontWeight: 600, marginBottom: 6 }}>{character.name}</p>
            <p style={{ fontSize: 12, color: "rgba(167,139,250,0.5)", fontStyle: "italic", maxWidth: 240, margin: "0 auto" }}>
              "{character.slogan}"
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 20 }}>
              Gõ tin nhắn để bắt đầu cuộc hội thoại
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: isUser ? "row-reverse" : "row",
                alignItems: "flex-end",
                gap: 8,
              }}
            >
              {isUser ? (
                <UserAvatar src={userAvatarUrl} size={32} />
              ) : (
                <CharAvatar src={charAvatarUrl} emoji={character.avatar} size={32} />
              )}

              <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isUser
                      ? "linear-gradient(135deg, #7c3aed, #6c5ce7)"
                      : "rgba(28,26,44,0.98)",
                    color: "#fff",
                    fontSize: 14,
                    lineHeight: 1.6,
                    boxShadow: isUser ? "0 4px 12px rgba(108,92,231,0.35)" : "0 2px 8px rgba(0,0,0,0.4)",
                    border: isUser
                      ? "1px solid rgba(124,58,237,0.4)"
                      : "1px solid rgba(255,255,255,0.06)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 4, paddingInline: 4 }}>
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          );
        })}

        {sending && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <CharAvatar src={charAvatarUrl} emoji={character.avatar} size={32} />
            <div
              style={{
                padding: "10px 16px",
                borderRadius: "18px 18px 18px 4px",
                background: "rgba(28,26,44,0.98)",
                border: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Loader2 size={14} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 13, color: "rgba(167,139,250,0.7)", fontStyle: "italic" }}>
                {statusText || "Đang soạn..."}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              margin: "4px 8px",
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#fca5a5",
              fontSize: 13,
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
            }}
          >
            <span style={{ flexShrink: 0 }}>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── INPUT BAR ── */}
      <div
        style={{
          borderTop: "1px solid rgba(108,92,231,0.15)",
          background: "#0f0d1a",
          padding: "12px 16px",
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
          onKeyDown={handleKeyDown}
          placeholder="Nhắn tin cho linh hồn..."
          rows={1}
          disabled={sending}
          style={{
            flex: 1, resize: "none",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(108,92,231,0.25)",
            borderRadius: 14,
            padding: "10px 14px",
            color: "#fff", fontSize: 14, outline: "none",
            lineHeight: 1.5, maxHeight: 120, overflow: "auto",
            fontFamily: "inherit", transition: "border-color 0.2s",
          }}
          onFocus={(e) => { e.target.style.borderColor = "rgba(108,92,231,0.6)"; }}
          onBlur={(e) => { e.target.style.borderColor = "rgba(108,92,231,0.25)"; }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          style={{
            width: 44, height: 44, borderRadius: 13, border: "none",
            background: sending || !input.trim()
              ? "rgba(108,92,231,0.25)"
              : "linear-gradient(135deg, #7c3aed, #6c5ce7)",
            color: sending || !input.trim() ? "rgba(255,255,255,0.3)" : "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: sending || !input.trim() ? "not-allowed" : "pointer",
            flexShrink: 0,
            boxShadow: sending || !input.trim() ? "none" : "0 4px 12px rgba(108,92,231,0.4)",
            transition: "all 0.2s",
          }}
        >
          <Send size={17} />
        </button>
      </div>

      {/* ── CLEAR CONFIRM ── */}
      {showClearConfirm && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200, padding: 24, backdropFilter: "blur(6px)",
          }}
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            style={{
              background: "#1a1825", border: "1px solid rgba(108,92,231,0.3)",
              borderRadius: 20, padding: 28, width: "100%", maxWidth: 320, textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Xoá lịch sử chat?</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 24 }}>
              Toàn bộ tin nhắn với {character.name} sẽ bị xoá vĩnh viễn.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 14, cursor: "pointer",
                }}
              >
                Huỷ
              </button>
              <button
                onClick={handleClearHistory}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                  color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                Xoá tất cả
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── USER PROFILE MODAL ── */}
      {showProfile && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            zIndex: 200, backdropFilter: "blur(10px)",
          }}
          onClick={() => setShowProfile(false)}
        >
          <div
            style={{
              background: "linear-gradient(180deg, #1c1a2e 0%, #13101f 100%)",
              border: "1px solid rgba(108,92,231,0.25)",
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              width: "100%", maxWidth: 480,
              maxHeight: "92dvh", overflowY: "auto",
              padding: "24px 24px 32px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Hồ sơ của bạn</h2>
                <p style={{ fontSize: 11, color: "rgba(167,139,250,0.5)", marginTop: 2 }}>
                  AI sẽ dùng thông tin này để phản hồi phù hợp hơn
                </p>
              </div>
              <button
                onClick={() => setShowProfile(false)}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.5)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* ── USER AVATAR UPLOAD ── */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <UserAvatar src={userAvatarDraft} size={88} />
                <button
                  onClick={() => userFileRef.current?.click()}
                  title="Thay ảnh đại diện"
                  style={{
                    position: "absolute", bottom: 2, right: 2,
                    width: 28, height: 28, borderRadius: "50%",
                    border: "2px solid #13101f",
                    background: "#6c5ce7", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", padding: 0,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                  }}
                >
                  <Camera size={13} />
                </button>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 10 }}>
                Nhấn 📷 để chọn ảnh từ thiết bị
              </p>
              <p style={{ fontSize: 10, color: "rgba(167,139,250,0.35)", marginTop: 3 }}>
                Lưu theo: <span style={{ fontFamily: "monospace" }}>avatar_{email}</span>
              </p>
              <input
                ref={userFileRef}
                type="file"
                accept="image/*"
                onChange={handleUserAvatarChange}
                style={{ display: "none" }}
              />
            </div>

            {/* Profile fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Giới tính */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.8)", display: "block", marginBottom: 8 }}>
                  Giới tính
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["Nữ", "Nam", "Khác"].map((g) => (
                    <button
                      key={g}
                      onClick={() => setProfileDraft((p) => ({ ...p, gender: g }))}
                      style={{
                        flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer",
                        border: `1px solid ${profileDraft.gender === g ? "rgba(108,92,231,0.7)" : "rgba(255,255,255,0.08)"}`,
                        background: profileDraft.gender === g ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.04)",
                        color: profileDraft.gender === g ? "#c4b5fd" : "rgba(255,255,255,0.4)",
                        fontSize: 13, fontWeight: profileDraft.gender === g ? 700 : 400,
                        transition: "all 0.15s",
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tính cách */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.8)", display: "block", marginBottom: 8 }}>
                  Tính cách
                </label>
                <input
                  type="text"
                  value={profileDraft.personality}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, personality: e.target.value }))}
                  placeholder="Ví dụ: U ám, tinh nghịch, hay suy nghĩ..."
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 12, outline: "none",
                    border: "1px solid rgba(108,92,231,0.2)", background: "rgba(255,255,255,0.05)",
                    color: "#fff", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(108,92,231,0.6)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(108,92,231,0.2)"; }}
                />
              </div>

              {/* Thông tin bản thân */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.8)", display: "block", marginBottom: 8 }}>
                  Thông tin bản thân
                </label>
                <textarea
                  value={profileDraft.bio}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, bio: e.target.value }))}
                  placeholder="Bạn là ai? Nghề nghiệp, sở thích, câu chuyện..."
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 12, outline: "none",
                    border: "1px solid rgba(108,92,231,0.2)", background: "rgba(255,255,255,0.05)",
                    color: "#fff", fontSize: 13, resize: "vertical", fontFamily: "inherit",
                    boxSizing: "border-box", minHeight: 72, transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(108,92,231,0.6)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(108,92,231,0.2)"; }}
                />
              </div>

              {/* Ngoại hình */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.8)", display: "block", marginBottom: 8 }}>
                  Ngoại hình
                </label>
                <textarea
                  value={profileDraft.appearance}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, appearance: e.target.value }))}
                  placeholder="Màu tóc, chiều cao, phong cách..."
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 12, outline: "none",
                    border: "1px solid rgba(108,92,231,0.2)", background: "rgba(255,255,255,0.05)",
                    color: "#fff", fontSize: 13, resize: "vertical", fontFamily: "inherit",
                    boxSizing: "border-box", minHeight: 72, transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(108,92,231,0.6)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(108,92,231,0.2)"; }}
                />
              </div>
            </div>

            <button
              onClick={handleProfileSave}
              style={{
                marginTop: 22, width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
                background: profileSaved
                  ? "linear-gradient(135deg, #16a34a, #15803d)"
                  : "linear-gradient(135deg, #7c3aed, #6c5ce7)",
                color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 6px 20px rgba(108,92,231,0.35)",
                transition: "background 0.3s",
              }}
            >
              {profileSaved ? "✓ Đã lưu hồ sơ!" : "Lưu hồ sơ"}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        textarea::placeholder, input::placeholder { color: rgba(255,255,255,0.2); }
        *::-webkit-scrollbar { width: 4px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: rgba(108,92,231,0.3); border-radius: 4px; }
      `}</style>
    </div>
  );
}
