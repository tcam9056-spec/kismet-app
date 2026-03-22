import { useState, useEffect } from "react";
import { useKeys } from "@/hooks/useKeys";
import { GEMINI_MODELS } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Plus, Trash2, ArrowLeft, Key, Bot, Zap } from "lucide-react";

interface Props {
  onBack: () => void;
}

export default function SettingsPage({ onBack }: Props) {
  const { user } = useAuth();
  const { keys, selectedModel, loading, saveKeys } = useKeys();
  const [localKeys, setLocalKeys] = useState<string[]>([]);
  const [localModel, setLocalModel] = useState("gemini-2.5-flash");
  const [newKey, setNewKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverKeyAvailable, setServerKeyAvailable] = useState(false);
  const [loadingServerKey, setLoadingServerKey] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLocalKeys(keys);
      setLocalModel(selectedModel);
    }
  }, [loading, keys, selectedModel]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.hasDefaultKey) setServerKeyAvailable(true);
      })
      .catch(() => {});
  }, []);

  const useServerKey = async () => {
    setLoadingServerKey(true);
    try {
      const r = await fetch("/api/config");
      const data = await r.json();
      if (data.defaultGeminiKey && !localKeys.includes(data.defaultGeminiKey)) {
        setLocalKeys((prev) => [data.defaultGeminiKey, ...prev]);
      }
    } catch {}
    setLoadingServerKey(false);
  };

  const addKey = () => {
    const k = newKey.trim();
    if (!k || localKeys.includes(k)) return;
    setLocalKeys((prev) => [...prev, k]);
    setNewKey("");
  };

  const removeKey = (index: number) => {
    setLocalKeys((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveKeys(localKeys, localModel);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(108,92,231,0.2)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#0a0a0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Loader2 size={22} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0a0a0f",
        color: "#fff",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "20px 20px 16px",
            borderBottom: "1px solid rgba(108,92,231,0.15)",
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
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Cài đặt</h1>
            <p style={{ fontSize: 11, color: "rgba(167,139,250,0.45)", marginTop: 1 }}>
              {user?.email}
            </p>
          </div>
        </div>

        <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Model Selection */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Bot size={14} style={{ color: "#a78bfa" }} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(167,139,250,0.5)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Model AI
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {GEMINI_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setLocalModel(m.id)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: `1px solid ${localModel === m.id ? "rgba(108,92,231,0.5)" : "rgba(255,255,255,0.07)"}`,
                    background: localModel === m.id ? "rgba(108,92,231,0.15)" : "rgba(255,255,255,0.03)",
                    color: "#fff",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: localModel === m.id ? "#c4b5fd" : "rgba(255,255,255,0.8)" }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(167,139,250,0.35)", marginTop: 2, fontFamily: "monospace" }}>
                      models/{m.id}
                    </div>
                  </div>
                  {localModel === m.id && (
                    <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* API Keys */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Key size={14} style={{ color: "#a78bfa" }} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(167,139,250,0.5)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                API Keys (Pháp Khí)
              </span>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 14, lineHeight: 1.5 }}>
              Thêm nhiều key để tự động xoay vòng khi gặp lỗi 429/400. Lấy key tại{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#a78bfa", textDecoration: "underline" }}
              >
                aistudio.google.com/apikey
              </a>
            </p>

            {serverKeyAvailable && (
              <button
                onClick={useServerKey}
                disabled={loadingServerKey}
                style={{
                  width: "100%",
                  marginBottom: 12,
                  padding: "11px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(108,92,231,0.3)",
                  background: "rgba(108,92,231,0.1)",
                  color: "#c4b5fd",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.15s",
                }}
              >
                {loadingServerKey ? (
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <Zap size={14} />
                )}
                Dùng Google API Key từ hệ thống (tự động)
              </button>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              {localKeys.map((key, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <Key size={13} style={{ color: "rgba(167,139,250,0.3)", flexShrink: 0 }} />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: "rgba(255,255,255,0.5)",
                      fontFamily: "monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {key.slice(0, 8)}••••••••{key.slice(-4)}
                  </span>
                  <button
                    onClick={() => removeKey(i)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: "none",
                      background: "rgba(239,68,68,0.1)",
                      color: "rgba(239,68,68,0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {localKeys.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 0",
                    border: "1px dashed rgba(108,92,231,0.2)",
                    borderRadius: 12,
                    color: "rgba(255,255,255,0.2)",
                    fontSize: 13,
                  }}
                >
                  Chưa có API Key nào
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="password"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKey()}
                placeholder="AIza... (Dán API Key vào đây)"
                autoComplete="off"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={addKey}
                disabled={!newKey.trim()}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  border: "none",
                  background: newKey.trim() ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.05)",
                  color: newKey.trim() ? "#a78bfa" : "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: newKey.trim() ? "pointer" : "not-allowed",
                  flexShrink: 0,
                }}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Firestore rules hint */}
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              background: "rgba(59,130,246,0.07)",
              border: "1px solid rgba(59,130,246,0.15)",
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd", marginBottom: 8 }}>
              📋 Firestore Security Rules
            </p>
            <p style={{ fontSize: 12, color: "rgba(147,197,253,0.6)", marginBottom: 8, lineHeight: 1.5 }}>
              Nếu không tải được chat, vào Firestore Console → Rules → dán:
            </p>
            <pre
              style={{
                background: "rgba(0,0,0,0.4)",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 11,
                color: "rgba(255,255,255,0.5)",
                overflowX: "auto",
                fontFamily: "monospace",
                lineHeight: 1.5,
                margin: 0,
              }}
            >{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`}</pre>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "14px 0",
              borderRadius: 14,
              border: "none",
              background: saved
                ? "linear-gradient(135deg, #16a34a, #15803d)"
                : "linear-gradient(135deg, #7c3aed, #6c5ce7)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              boxShadow: "0 6px 20px rgba(108,92,231,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background 0.3s",
              marginBottom: 32,
            }}
          >
            {saving ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                Đang lưu...
              </>
            ) : saved ? (
              "✓ Đã lưu thành công!"
            ) : (
              "Lưu cài đặt"
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
