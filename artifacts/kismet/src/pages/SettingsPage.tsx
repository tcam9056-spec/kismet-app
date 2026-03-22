import { useState, useEffect, useRef } from "react";
import { useKeys } from "@/hooks/useKeys";
import { GEMINI_MODELS } from "@/lib/types";
import { testModel } from "@/lib/gemini";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Plus, Trash2, ArrowLeft, Key, Bot, Zap, Image, Sliders, FlaskConical, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";

type ModelStatus = "ok" | "error" | "checking" | "pending";

/* Models không test — hiện trạng "Chờ nâng cấp" */
const PENDING_MODELS = new Set(["gemini-3.1-pro"]);


const MAX_TOKENS_KEY = "kismet_maxTokens";
const LOGO_KEY = "kismet_logo";

function loadMaxTokens(): number {
  try {
    const v = parseInt(localStorage.getItem(MAX_TOKENS_KEY) || "2048", 10);
    return isNaN(v) ? 2048 : Math.min(Math.max(v, 200), 12000);
  } catch { return 2048; }
}

function saveMaxTokens(v: number) {
  localStorage.setItem(MAX_TOKENS_KEY, String(v));
}

function loadLogo(): string | null {
  return localStorage.getItem(LOGO_KEY);
}

function saveLogo(b64: string) {
  localStorage.setItem(LOGO_KEY, b64);
}

function removeLogo() {
  localStorage.removeItem(LOGO_KEY);
}

function tokenLabel(v: number): string {
  if (v <= 300) return "Rất ngắn";
  if (v <= 800) return "Ngắn";
  if (v <= 1500) return "Trung bình";
  if (v <= 3000) return "Dài";
  if (v <= 6000) return "Rất dài";
  if (v <= 9000) return "Tiểu thuyết";
  return "Sử thi";
}

interface Props { onBack: () => void; }

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

  /* Token slider */
  const [maxTokens, setMaxTokens] = useState(2048);

  /* Logo */
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  /* API Key input visibility */
  const [showNewKey, setShowNewKey] = useState(false);

  /* Model availability check */
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});
  const [checkingModels, setCheckingModels] = useState(false);

  const checkModels = async () => {
    if (localKeys.length === 0) return;
    setCheckingModels(true);
    const apiKey = localKeys[0];
    /* Mark testable as "checking", pending models as "pending" ngay */
    const init: Record<string, ModelStatus> = {};
    for (const m of GEMINI_MODELS) init[m.id] = PENDING_MODELS.has(m.id) ? "pending" : "checking";
    setModelStatuses({ ...init });
    /* Test chỉ các model không phải pending — song song */
    const toTest = GEMINI_MODELS.filter(m => !PENDING_MODELS.has(m.id));
    const results = await Promise.all(
      toTest.map(async (m) => {
        const ok = await testModel(apiKey, m.id);
        return { id: m.id, status: ok ? "ok" : "error" } as { id: string; status: ModelStatus };
      })
    );
    const statuses: Record<string, ModelStatus> = { ...init };
    for (const r of results) statuses[r.id] = r.status;
    setModelStatuses(statuses);
    setCheckingModels(false);
  };

  useEffect(() => {
    if (!loading) {
      setLocalKeys(keys);
      setLocalModel(selectedModel);
    }
  }, [loading, keys, selectedModel]);

  useEffect(() => {
    setMaxTokens(loadMaxTokens());
    setLogoUrl(loadLogo());
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => { if (data.hasDefaultKey) setServerKeyAvailable(true); })
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

  const removeKey = (i: number) => setLocalKeys((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    await saveKeys(localKeys, localModel);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTokenChange = (v: number) => {
    setMaxTokens(v);
    saveMaxTokens(v);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      saveLogo(b64);
      setLogoUrl(b64);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveLogo = () => {
    removeLogo();
    setLogoUrl(null);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 12,
    border: "1px solid rgba(108,92,231,0.2)", background: "rgba(255,255,255,0.05)",
    color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };

  const sectionLabel = (icon: React.ReactNode, text: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      {icon}
      <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(167,139,250,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {text}
      </span>
    </div>
  );

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={22} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0f", color: "#fff", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 20px 16px", borderBottom: "1px solid rgba(108,92,231,0.15)" }}>
          <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Cài đặt</h1>
            <p style={{ fontSize: 11, color: "rgba(167,139,250,0.45)", marginTop: 1 }}>{user?.email}</p>
          </div>
        </div>

        <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 32 }}>

          {/* ── LOGO / BRANDING ── */}
          <div>
            {sectionLabel(<Image size={14} style={{ color: "#a78bfa" }} />, "Logo ứng dụng")}
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px", borderRadius: 14, border: "1px solid rgba(108,92,231,0.15)", background: "rgba(255,255,255,0.02)" }}>
              <div
                onClick={() => logoFileRef.current?.click()}
                style={{
                  width: 64, height: 64, borderRadius: 18,
                  background: logoUrl ? "transparent" : "rgba(108,92,231,0.12)",
                  border: "2px solid rgba(108,92,231,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", overflow: "hidden", flexShrink: 0,
                  boxShadow: logoUrl ? "0 0 16px rgba(108,92,231,0.25)" : "none",
                }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 30 }}>🔮</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>KISMET</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 10, lineHeight: 1.4 }}>
                  {logoUrl ? "Logo tuỳ chỉnh đang được dùng" : "Đang dùng logo mặc định 🔮"}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => logoFileRef.current?.click()}
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(108,92,231,0.4)",
                      background: "rgba(108,92,231,0.15)", color: "#c4b5fd", fontSize: 12,
                      fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {logoUrl ? "Thay logo" : "Tải logo lên"}
                  </button>
                  {logoUrl && (
                    <button
                      onClick={handleRemoveLogo}
                      style={{
                        padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)",
                        background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.7)", fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Xoá
                    </button>
                  )}
                </div>
              </div>
            </div>
            <input ref={logoFileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} />
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 8, paddingLeft: 4 }}>
              Logo lưu dưới dạng Base64 · Khóa: <span style={{ fontFamily: "monospace" }}>kismet_logo</span>
            </p>
          </div>

          {/* ── TOKEN SLIDER ── */}
          <div>
            {sectionLabel(<Sliders size={14} style={{ color: "#a78bfa" }} />, "Độ dài phản hồi AI")}
            <div style={{ padding: "18px 16px", borderRadius: 14, border: "1px solid rgba(108,92,231,0.15)", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
                  {maxTokens.toLocaleString()} tokens
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: "#a78bfa",
                  background: "rgba(108,92,231,0.15)", border: "1px solid rgba(108,92,231,0.3)",
                  borderRadius: 20, padding: "2px 10px",
                }}>
                  {tokenLabel(maxTokens)}
                </span>
              </div>
              <input
                type="range"
                min={200}
                max={12000}
                step={100}
                value={maxTokens}
                onChange={(e) => handleTokenChange(parseInt(e.target.value, 10))}
                style={{ width: "100%", accentColor: "#6c5ce7", cursor: "pointer", margin: "4px 0" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                {[
                  { v: 200, label: "200\nNgắn" },
                  { v: 2048, label: "2K\nThường" },
                  { v: 4096, label: "4K\nDài" },
                  { v: 8000, label: "8K\nNovella" },
                  { v: 12000, label: "12K\nSử thi" },
                ].map(({ v, label }) => (
                  <button
                    key={v}
                    onClick={() => handleTokenChange(v)}
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                      textAlign: "center",
                    }}
                  >
                    {label.split("\n").map((line, i) => (
                      <div key={i} style={{
                        fontSize: i === 0 ? 11 : 9,
                        color: maxTokens === v ? "#a78bfa" : "rgba(255,255,255,0.25)",
                        fontWeight: maxTokens === v ? 700 : 400,
                        lineHeight: 1.3,
                      }}>
                        {line}
                      </div>
                    ))}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 12, lineHeight: 1.5 }}>
                Lưu tự động vào <span style={{ fontFamily: "monospace", color: "rgba(167,139,250,0.4)" }}>kismet_maxTokens</span> · Giới hạn: 200 – 12.000
              </p>
            </div>
          </div>

          {/* ── MODEL SELECTION ── */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Bot size={14} style={{ color: "#a78bfa" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(167,139,250,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Model AI
                </span>
              </div>
              <button
                onClick={checkModels}
                disabled={checkingModels || localKeys.length === 0}
                title={localKeys.length === 0 ? "Cần có API Key để kiểm tra" : "Kiểm tra model nào đang hoạt động"}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
                  borderRadius: 8, border: "1px solid rgba(108,92,231,0.3)",
                  background: "rgba(108,92,231,0.1)", color: localKeys.length === 0 ? "rgba(167,139,250,0.25)" : "#c4b5fd",
                  fontSize: 11, fontWeight: 600, cursor: localKeys.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                {checkingModels
                  ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />Đang kiểm tra...</>
                  : <><FlaskConical size={11} />Kiểm tra</>
                }
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {GEMINI_MODELS.map((m) => {
                const st = modelStatuses[m.id];
                const isSelected = localModel === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setLocalModel(m.id)}
                    style={{
                      padding: "12px 16px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                      border: `1px solid ${isSelected ? "rgba(108,92,231,0.5)" : "rgba(255,255,255,0.07)"}`,
                      background: isSelected ? "rgba(108,92,231,0.15)" : "rgba(255,255,255,0.03)",
                      color: "#fff", transition: "all 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? "#c4b5fd" : "rgba(255,255,255,0.8)" }}>
                        {m.label}
                        {m.badge && (
                          <span style={{
                            marginLeft: 8, fontSize: 9, padding: "2px 7px", borderRadius: 20,
                            background: isSelected ? "rgba(108,92,231,0.35)" : "rgba(255,255,255,0.07)",
                            color: isSelected ? "#c4b5fd" : "rgba(255,255,255,0.35)",
                            fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                          }}>
                            {m.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(167,139,250,0.35)", marginTop: 2, fontFamily: "monospace" }}>
                        models/{m.id}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {st === "checking" && (
                        <Loader2 size={14} style={{ color: "rgba(167,139,250,0.5)", animation: "spin 1s linear infinite" }} />
                      )}
                      {st === "ok" && (
                        <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
                      )}
                      {st === "error" && (
                        <XCircle size={14} style={{ color: "#ef4444" }} />
                      )}
                      {st === "pending" && (
                        <span style={{
                          fontSize: 9, padding: "2px 8px", borderRadius: 20, fontWeight: 700,
                          background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
                          color: "#f59e0b", whiteSpace: "nowrap",
                        }}>
                          Chờ nâng cấp
                        </span>
                      )}
                      {!st && isSelected && (
                        <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>✓</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {Object.keys(modelStatuses).length > 0 && !checkingModels && (
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 10, lineHeight: 1.5, paddingLeft: 4 }}>
                Kết quả test trực tiếp với API Key của bạn
              </p>
            )}
          </div>

          {/* ── API KEYS ── */}
          <div>
            {sectionLabel(<Key size={14} style={{ color: "#a78bfa" }} />, "API Keys (Pháp Khí)")}
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 14, lineHeight: 1.5 }}>
              Thêm nhiều key để tự động xoay vòng khi gặp lỗi 429/400. Lấy key tại{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: "#a78bfa", textDecoration: "underline" }}>
                aistudio.google.com/apikey
              </a>
            </p>

            {serverKeyAvailable && (
              <button
                onClick={useServerKey}
                disabled={loadingServerKey}
                style={{
                  width: "100%", marginBottom: 12, padding: "11px 16px", borderRadius: 12,
                  border: "1px solid rgba(108,92,231,0.3)", background: "rgba(108,92,231,0.1)",
                  color: "#c4b5fd", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                }}
              >
                {loadingServerKey ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={14} />}
                Dùng Google API Key từ hệ thống (tự động)
              </button>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              {localKeys.map((key, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
                  <Key size={13} style={{ color: "rgba(167,139,250,0.3)", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {key.slice(0, 8)}••••••••{key.slice(-4)}
                  </span>
                  <button onClick={() => removeKey(i)} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {localKeys.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px 0", border: "1px dashed rgba(108,92,231,0.2)", borderRadius: 12, color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                  Chưa có API Key nào
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {/* Input với eye toggle + glow + auto-trim paste */}
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type={showNewKey ? "text" : "password"}
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData("text").trim();
                    setNewKey(pasted);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && addKey()}
                  placeholder="AIza... (Dán API Key vào đây)"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="text"
                  style={{
                    ...inputStyle,
                    width: "100%",
                    paddingRight: 44,
                    border: newKey.trim()
                      ? "1px solid rgba(108,92,231,0.6)"
                      : "1px solid rgba(108,92,231,0.2)",
                    boxShadow: newKey.trim()
                      ? "0 0 0 3px rgba(108,92,231,0.15)"
                      : "none",
                    transition: "border 0.2s, box-shadow 0.2s",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewKey(v => !v)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "rgba(167,139,250,0.5)",
                    cursor: "pointer", padding: 4, display: "flex", alignItems: "center",
                  }}
                >
                  {showNewKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                onClick={addKey} disabled={!newKey.trim()}
                style={{
                  width: 44, height: 44, borderRadius: 12, border: "none",
                  background: newKey.trim() ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.05)",
                  color: newKey.trim() ? "#a78bfa" : "rgba(255,255,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: newKey.trim() ? "pointer" : "not-allowed", flexShrink: 0,
                  transition: "background 0.2s",
                }}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* ── SAVE BUTTON ── */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "14px 0", borderRadius: 14, border: "none",
              background: saved ? "linear-gradient(135deg, #16a34a, #15803d)" : "linear-gradient(135deg, #7c3aed, #6c5ce7)",
              color: "#fff", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
              boxShadow: "0 6px 20px rgba(108,92,231,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 0.3s", marginBottom: 32,
            }}
          >
            {saving ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />Đang lưu...</> : saved ? "✓ Đã lưu thành công!" : "Lưu cài đặt (Model & API Keys)"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input[type="range"] { height: 6px; }
        input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
