import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Settings2, Send, Trash2, X, Upload, Loader2, ChevronDown } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useKeys } from "@/hooks/useKeys";
import { useAuth } from "@/contexts/AuthContext";
import type { Character, GeminiModel } from "@/lib/types";

interface Props {
  character: Character;
  onBack: () => void;
}

interface UserProfile {
  avatarUrl: string | null;
  gender: string;
  personality: string;
  bio: string;
  appearance: string;
}

function getProfileKey(uid: string) {
  return `kismet_profile_${uid}`;
}
function loadProfile(uid: string): UserProfile {
  try {
    const raw = localStorage.getItem(getProfileKey(uid));
    if (raw) return JSON.parse(raw) as UserProfile;
  } catch {}
  return { avatarUrl: null, gender: "", personality: "", bio: "", appearance: "" };
}
function saveProfile(uid: string, profile: UserProfile) {
  localStorage.setItem(getProfileKey(uid), JSON.stringify(profile));
}

export default function ChatPage({ character, onBack }: Props) {
  const { user } = useAuth();
  const { keys, selectedModel, loading: keysLoading } = useKeys();
  const { messages, loading, sending, statusText, error, send, clearHistory } =
    useChat(character, keys, selectedModel as GeminiModel);

  const [input, setInput] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ avatarUrl: null, gender: "", personality: "", bio: "", appearance: "" });
  const [profileDraft, setProfileDraft] = useState<UserProfile>({ avatarUrl: null, gender: "", personality: "", bio: "", appearance: "" });
  const [profileSaved, setProfileSaved] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      const p = loadProfile(user.uid);
      setProfile(p);
      setProfileDraft(p);
    }
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

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

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfileDraft((prev) => ({ ...prev, avatarUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = () => {
    if (!user) return;
    saveProfile(user.uid, profileDraft);
    setProfile(profileDraft);
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
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  };

  return (
    <div
      className="flex flex-col"
      style={{
        height: "100dvh",
        background: "#0a0a0f",
        color: "#fff",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* ─── HEADER ─── */}
      <div
        style={{
          background: "linear-gradient(180deg, #13101f 0%, #0f0d1a 100%)",
          borderBottom: "1px solid rgba(108,92,231,0.2)",
          flexShrink: 0,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "relative",
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.05)",
            color: "#a78bfa",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #2d1b69 0%, #6c5ce7 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              flexShrink: 0,
              boxShadow: "0 0 16px rgba(108,92,231,0.4)",
              border: "2px solid rgba(108,92,231,0.4)",
            }}
          >
            {character.avatar}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {character.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(167,139,250,0.65)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginTop: 1,
                fontStyle: "italic",
              }}
            >
              "{character.slogan}"
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => {
              setProfileDraft(profile);
              setShowProfile(true);
            }}
            title="Hồ sơ của bạn"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(167,139,250,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Settings2 size={15} />
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            title="Xoá lịch sử"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(167,139,250,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* ─── CHARACTER INFO BANNER ─── */}
      <div
        style={{
          background: "linear-gradient(180deg, rgba(108,92,231,0.08) 0%, transparent 100%)",
          borderBottom: "1px solid rgba(108,92,231,0.08)",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #1a0a3e 0%, #6c5ce7 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            border: "2px solid rgba(108,92,231,0.5)",
            boxShadow: "0 0 24px rgba(108,92,231,0.3)",
            flexShrink: 0,
          }}
        >
          {character.avatar}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 3 }}>
            {character.name}
          </div>
          <div style={{ fontSize: 12, color: "rgba(196,181,253,0.7)", fontStyle: "italic", marginBottom: 5 }}>
            "{character.slogan}"
          </div>
          <div
            style={{
              display: "inline-block",
              fontSize: 10,
              color: "#a78bfa",
              background: "rgba(108,92,231,0.15)",
              border: "1px solid rgba(108,92,231,0.3)",
              borderRadius: 20,
              padding: "2px 10px",
              letterSpacing: "0.05em",
            }}
          >
            ✦ AI Character
          </div>
        </div>
      </div>

      {/* ─── MESSAGES AREA ─── */}
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
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16, filter: "drop-shadow(0 0 20px rgba(108,92,231,0.5))" }}>
              {character.avatar}
            </div>
            <p style={{ fontSize: 15, color: "#a78bfa", fontWeight: 600, marginBottom: 6 }}>
              {character.name}
            </p>
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
              {!isUser && (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #1a0a3e 0%, #6c5ce7 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    flexShrink: 0,
                    border: "1.5px solid rgba(108,92,231,0.4)",
                  }}
                >
                  {character.avatar}
                </div>
              )}

              {isUser && profile.avatarUrl ? (
                <div style={{ flexShrink: 0 }}>
                  <img
                    src={profile.avatarUrl}
                    alt="you"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "1.5px solid rgba(108,92,231,0.5)",
                    }}
                  />
                </div>
              ) : isUser ? (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "rgba(108,92,231,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 14,
                    color: "#a78bfa",
                    border: "1.5px solid rgba(108,92,231,0.3)",
                  }}
                >
                  👤
                </div>
              ) : null}

              <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isUser
                      ? "linear-gradient(135deg, #7c3aed, #6c5ce7)"
                      : "rgba(30,28,46,0.95)",
                    color: "#fff",
                    fontSize: 14,
                    lineHeight: 1.55,
                    boxShadow: isUser
                      ? "0 4px 12px rgba(108,92,231,0.35)"
                      : "0 2px 8px rgba(0,0,0,0.4)",
                    border: isUser
                      ? "1px solid rgba(124,58,237,0.4)"
                      : "1px solid rgba(255,255,255,0.06)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.2)",
                    marginTop: 4,
                    paddingInline: 4,
                  }}
                >
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          );
        })}

        {sending && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1a0a3e 0%, #6c5ce7 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                flexShrink: 0,
                border: "1.5px solid rgba(108,92,231,0.4)",
              }}
            >
              {character.avatar}
            </div>
            <div
              style={{
                padding: "10px 16px",
                borderRadius: "18px 18px 18px 4px",
                background: "rgba(30,28,46,0.95)",
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

      {/* ─── INPUT BAR ─── */}
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
            flex: 1,
            resize: "none",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(108,92,231,0.25)",
            borderRadius: 14,
            padding: "10px 14px",
            color: "#fff",
            fontSize: 14,
            outline: "none",
            lineHeight: 1.5,
            maxHeight: 120,
            overflow: "auto",
            fontFamily: "inherit",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "rgba(108,92,231,0.6)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "rgba(108,92,231,0.25)";
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            border: "none",
            background:
              sending || !input.trim()
                ? "rgba(108,92,231,0.25)"
                : "linear-gradient(135deg, #7c3aed, #6c5ce7)",
            color: sending || !input.trim() ? "rgba(255,255,255,0.3)" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: sending || !input.trim() ? "not-allowed" : "pointer",
            flexShrink: 0,
            boxShadow: sending || !input.trim() ? "none" : "0 4px 12px rgba(108,92,231,0.4)",
            transition: "all 0.2s",
          }}
        >
          <Send size={17} />
        </button>
      </div>

      {/* ─── CLEAR HISTORY CONFIRM ─── */}
      {showClearConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 24,
            backdropFilter: "blur(6px)",
          }}
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            style={{
              background: "#1a1825",
              border: "1px solid rgba(108,92,231,0.3)",
              borderRadius: 20,
              padding: 28,
              width: "100%",
              maxWidth: 320,
              textAlign: "center",
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
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#fff",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Huỷ
              </button>
              <button
                onClick={handleClearHistory}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Xoá tất cả
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── USER PROFILE MODAL ─── */}
      {showProfile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 100,
            backdropFilter: "blur(8px)",
          }}
          onClick={() => setShowProfile(false)}
        >
          <div
            style={{
              background: "linear-gradient(180deg, #1a1825 0%, #13101f 100%)",
              border: "1px solid rgba(108,92,231,0.25)",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              width: "100%",
              maxWidth: 480,
              maxHeight: "90dvh",
              overflowY: "auto",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Hồ sơ của bạn</h2>
                <p style={{ fontSize: 11, color: "rgba(167,139,250,0.5)", marginTop: 2 }}>
                  AI sẽ dùng thông tin này để phản hồi phù hợp hơn
                </p>
              </div>
              <button
                onClick={() => setShowProfile(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Avatar Upload */}
            <div style={{ marginBottom: 20, textAlign: "center" }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: "50%",
                  margin: "0 auto 10px",
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  border: "2px solid rgba(108,92,231,0.5)",
                  background: "rgba(108,92,231,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {profileDraft.avatarUrl ? (
                  <>
                    <img
                      src={profileDraft.avatarUrl}
                      alt="avatar"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(0,0,0,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0,
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                    >
                      <Upload size={20} style={{ color: "#fff" }} />
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <Upload size={20} style={{ color: "rgba(167,139,250,0.5)", margin: "0 auto 4px" }} />
                    <span style={{ fontSize: 10, color: "rgba(167,139,250,0.5)" }}>Tải ảnh</span>
                  </div>
                )}
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                Nhấn để chọn ảnh từ thiết bị
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: "none" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Giới tính */}
              <div>
                <label style={{ fontSize: 12, color: "rgba(196,181,253,0.8)", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Giới tính
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["Nữ", "Nam", "Khác"].map((g) => (
                    <button
                      key={g}
                      onClick={() => setProfileDraft((p) => ({ ...p, gender: g }))}
                      style={{
                        flex: 1,
                        padding: "9px 0",
                        borderRadius: 10,
                        border: `1px solid ${profileDraft.gender === g ? "rgba(108,92,231,0.7)" : "rgba(255,255,255,0.08)"}`,
                        background: profileDraft.gender === g ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.04)",
                        color: profileDraft.gender === g ? "#c4b5fd" : "rgba(255,255,255,0.4)",
                        fontSize: 13,
                        fontWeight: profileDraft.gender === g ? 600 : 400,
                        cursor: "pointer",
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
                <label style={{ fontSize: 12, color: "rgba(196,181,253,0.8)", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Tính cách
                </label>
                <input
                  type="text"
                  value={profileDraft.personality}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, personality: e.target.value }))}
                  placeholder="Ví dụ: U ám, tinh nghịch, hay suy nghĩ..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(108,92,231,0.2)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Thông tin bản thân */}
              <div>
                <label style={{ fontSize: 12, color: "rgba(196,181,253,0.8)", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Thông tin bản thân
                </label>
                <textarea
                  value={profileDraft.bio}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, bio: e.target.value }))}
                  placeholder="Bạn là ai? Nghề nghiệp, sở thích, câu chuyện..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(108,92,231,0.2)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    fontSize: 13,
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    minHeight: 72,
                  }}
                />
              </div>

              {/* Ngoại hình */}
              <div>
                <label style={{ fontSize: 12, color: "rgba(196,181,253,0.8)", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Ngoại hình
                </label>
                <textarea
                  value={profileDraft.appearance}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, appearance: e.target.value }))}
                  placeholder="Mô tả vẻ ngoài, phong cách, màu tóc, chiều cao..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(108,92,231,0.2)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    fontSize: 13,
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    minHeight: 72,
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                onClick={handleProfileSave}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 14,
                  border: "none",
                  background: profileSaved
                    ? "linear-gradient(135deg, #16a34a, #15803d)"
                    : "linear-gradient(135deg, #7c3aed, #6c5ce7)",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(108,92,231,0.35)",
                  transition: "background 0.3s",
                }}
              >
                {profileSaved ? "✓ Đã lưu hồ sơ!" : "Lưu hồ sơ"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        textarea::placeholder { color: rgba(255,255,255,0.2); }
        input::placeholder { color: rgba(255,255,255,0.2); }
        *::-webkit-scrollbar { width: 4px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: rgba(108,92,231,0.3); border-radius: 4px; }
      `}</style>
    </div>
  );
}
