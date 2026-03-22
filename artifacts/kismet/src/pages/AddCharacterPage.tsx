import { useState, useRef } from "react";
import { useCharacters } from "@/hooks/useCharacters";
import { ArrowLeft, Loader2, Upload, Globe, Lock } from "lucide-react";

interface Props { onBack: () => void; }

const AVATAR_OPTIONS = ["🔮", "🌙", "⚡", "✨", "🌸", "🦋", "🐉", "👁️", "🌊", "🔥", "🧿", "💫", "🌌", "🗡️", "🌿"];

const iStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 12,
  border: "1px solid rgba(108,92,231,0.2)", background: "rgba(255,255,255,0.05)",
  color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box",
  fontFamily: "inherit", transition: "border-color 0.2s",
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(file); });
}

export default function AddCharacterPage({ onBack }: Props) {
  const { addCharacter } = useCharacters();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🔮");
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);
  const [slogan, setSlogan] = useState("");
  const [curse, setCurse] = useState("");
  const [personality, setPersonality] = useState("");
  const [gender, setGender] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const b64 = await readFileAsBase64(file);
    setCustomAvatarUrl(b64);
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slogan || !curse || !personality) { setError("Vui lòng điền đầy đủ thông tin."); return; }
    setSaving(true); setError(null);
    try {
      const genderNote = gender ? `\nGiới tính nhân vật: ${gender}.` : "";
      const fullPersonality = `${personality}${genderNote}`;
      const newId = await addCharacter({ name, avatar, slogan, curse, personality: fullPersonality, isPublic });
      /* Save custom avatar if uploaded */
      if (customAvatarUrl && newId) {
        localStorage.setItem(`kismet_char_avatar_${newId}`, customAvatarUrl);
      }
      onBack();
    } catch {
      setError("Không thể tạo nhân vật. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const label = (text: string) => (
    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.7)", letterSpacing: "0.05em", marginBottom: 10, textTransform: "uppercase" }}>{text}</label>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0f", color: "#fff", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 20px 16px", borderBottom: "1px solid rgba(108,92,231,0.15)" }}>
          <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Tạo Nhân Vật Mới</h1>
            <p style={{ fontSize: 11, color: "rgba(167,139,250,0.4)", marginTop: 2 }}>Triệu hồi linh hồn của riêng bạn</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 22 }}>

          {/* ── Avatar upload + emoji picker ── */}
          <div>
            {label("Avatar nhân vật")}

            {/* Upload photo */}
            <div style={{ marginBottom: 12 }}>
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 16px", borderRadius: 14, border: "1px dashed rgba(108,92,231,0.35)", background: customAvatarUrl ? "rgba(108,92,231,0.1)" : "rgba(255,255,255,0.03)", cursor: "pointer", transition: "all 0.2s" }}>
                {customAvatarUrl ? (
                  <>
                    <img src={customAvatarUrl} alt="avatar" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(108,92,231,0.5)" }} />
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <p style={{ fontSize: 13, color: "#c4b5fd", fontWeight: 600 }}>Ảnh đã tải lên ✓</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Nhấn để thay ảnh khác</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(108,92,231,0.1)", border: "1px solid rgba(108,92,231,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Upload size={18} style={{ color: "#a78bfa" }} />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Tải ảnh từ máy</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>JPG, PNG, WEBP · Sẽ dùng thay emoji</p>
                    </div>
                  </>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
            </div>

            {/* Emoji grid (used if no photo uploaded) */}
            {!customAvatarUrl && (
              <>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>Hoặc chọn emoji mặc định:</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                  {AVATAR_OPTIONS.map(a => (
                    <button key={a} type="button" onClick={() => setAvatar(a)}
                      style={{ height: 48, borderRadius: 12, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", border: avatar === a ? "2px solid rgba(108,92,231,0.7)" : "1px solid rgba(255,255,255,0.07)", background: avatar === a ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.03)", cursor: "pointer", transition: "all 0.15s", boxShadow: avatar === a ? "0 0 12px rgba(108,92,231,0.3)" : "none" }}>
                      {a}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Giới tính ── */}
          <div>
            {label("Giới tính nhân vật")}
            <div style={{ display: "flex", gap: 8 }}>
              {["Nam", "Nữ", "Khác", "Không xác định"].map(g => (
                <button key={g} type="button" onClick={() => setGender(gender === g ? "" : g)}
                  style={{ flex: 1, padding: "9px 4px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: gender === g ? 700 : 400, border: `1px solid ${gender === g ? "rgba(108,92,231,0.7)" : "rgba(255,255,255,0.08)"}`, background: gender === g ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.04)", color: gender === g ? "#c4b5fd" : "rgba(255,255,255,0.4)", transition: "all 0.15s" }}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* ── Name ── */}
          <div>
            {label("Tên nhân vật")}
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ví dụ: Elara - Phù Thủy Thời Gian" style={iStyle}
              onFocus={e => (e.target.style.borderColor = "rgba(108,92,231,0.6)")} onBlur={e => (e.target.style.borderColor = "rgba(108,92,231,0.2)")} />
          </div>

          {/* ── Slogan ── */}
          <div>
            {label("Slogan")}
            <input type="text" value={slogan} onChange={e => setSlogan(e.target.value)} placeholder="Câu nói đặc trưng của nhân vật..." style={iStyle}
              onFocus={e => (e.target.style.borderColor = "rgba(108,92,231,0.6)")} onBlur={e => (e.target.style.borderColor = "rgba(108,92,231,0.2)")} />
          </div>

          {/* ── Curse ── */}
          <div>
            {label("Lời nguyền")}
            <input type="text" value={curse} onChange={e => setCurse(e.target.value)} placeholder="Lời nguyền bí ẩn của nhân vật..." style={iStyle}
              onFocus={e => (e.target.style.borderColor = "rgba(108,92,231,0.6)")} onBlur={e => (e.target.style.borderColor = "rgba(108,92,231,0.2)")} />
          </div>

          {/* ── System Prompt ── */}
          <div>
            {label("Tính cách & System Prompt")}
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginBottom: 8, lineHeight: 1.5 }}>
              Mô tả chi tiết nhân vật cho AI — tính cách, cách nói, thế giới quan, bối cảnh...
            </p>
            <textarea value={personality} onChange={e => setPersonality(e.target.value)}
              placeholder="Bạn là Elara, một phù thủy thời gian bí ẩn... Hãy phản hồi bằng tiếng Việt."
              rows={5} style={{ ...iStyle, resize: "vertical", minHeight: 110 }}
              onFocus={e => (e.target.style.borderColor = "rgba(108,92,231,0.6)")} onBlur={e => (e.target.style.borderColor = "rgba(108,92,231,0.2)")} />
          </div>

          {/* ── Public / Private toggle ── */}
          <div style={{ borderRadius: 14, border: `1px solid ${isPublic ? "rgba(245,158,11,0.25)" : "rgba(108,92,231,0.15)"}`, background: isPublic ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.02)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {isPublic ? <Globe size={16} style={{ color: "#34d399" }} /> : <Lock size={16} style={{ color: "rgba(167,139,250,0.5)" }} />}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: isPublic ? "#34d399" : "rgba(255,255,255,0.7)" }}>
                    {isPublic ? "Công khai" : "Riêng tư"}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                    {isPublic ? "Gửi lên cộng đồng để Admin duyệt" : "Chỉ mình bạn thấy và sử dụng"}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setIsPublic(v => !v)}
                style={{ width: 48, height: 26, borderRadius: 13, border: "none", background: isPublic ? "#22c55e" : "rgba(255,255,255,0.12)", cursor: "pointer", position: "relative", transition: "background 0.3s", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 3, left: isPublic ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.3s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
              </button>
            </div>
            {isPublic && (
              <div style={{ padding: "10px 16px 12px", borderTop: "1px solid rgba(245,158,11,0.15)", background: "rgba(245,158,11,0.06)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>⏳</span>
                <p style={{ fontSize: 11, color: "rgba(245,158,11,0.8)", lineHeight: 1.5 }}>
                  Nhân vật công khai sẽ ở trạng thái <strong>chờ duyệt</strong> cho đến khi Admin phê duyệt. Chỉ sau đó mới hiển thị với cộng đồng.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13, textAlign: "center" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={saving}
            style={{ padding: "14px 0", borderRadius: 14, border: "none", background: saving ? "rgba(108,92,231,0.4)" : "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 6px 20px rgba(108,92,231,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32, transition: "all 0.2s" }}>
            {saving ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Đang triệu hồi...</> : "✦ Triệu hồi Nhân Vật"}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        textarea::placeholder, input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
