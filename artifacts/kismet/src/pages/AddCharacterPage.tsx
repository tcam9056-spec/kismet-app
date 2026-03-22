import { useState } from "react";
import { useCharacters } from "@/hooks/useCharacters";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Props {
  onBack: () => void;
}

const AVATAR_OPTIONS = ["🔮", "🌙", "⚡", "✨", "🌸", "🦋", "🐉", "👁️", "🌊", "🔥", "🧿", "💫", "🌌", "🗡️", "🌿"];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 12,
  border: "1px solid rgba(108,92,231,0.2)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 0.2s",
};

export default function AddCharacterPage({ onBack }: Props) {
  const { addCharacter } = useCharacters();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🔮");
  const [slogan, setSlogan] = useState("");
  const [curse, setCurse] = useState("");
  const [personality, setPersonality] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slogan || !curse || !personality) {
      setError("Vui lòng điền đầy đủ thông tin.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addCharacter({ name, avatar, slogan, curse, personality, isPublic: false });
      onBack();
    } catch {
      setError("Không thể tạo nhân vật. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

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
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Tạo Nhân Vật Mới</h1>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Avatar picker */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 700,
                color: "rgba(196,181,253,0.7)",
                letterSpacing: "0.05em",
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              Chọn Avatar
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 8,
              }}
            >
              {AVATAR_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  style={{
                    height: 48,
                    borderRadius: 12,
                    fontSize: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: avatar === a
                      ? "2px solid rgba(108,92,231,0.7)"
                      : "1px solid rgba(255,255,255,0.07)",
                    background: avatar === a
                      ? "rgba(108,92,231,0.2)"
                      : "rgba(255,255,255,0.03)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    boxShadow: avatar === a ? "0 0 12px rgba(108,92,231,0.3)" : "none",
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.7)", letterSpacing: "0.05em", marginBottom: 8, textTransform: "uppercase" }}>
              Tên Nhân Vật
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Elara - Phù Thủy Thời Gian"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "rgba(108,92,231,0.6)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(108,92,231,0.2)")}
            />
          </div>

          {/* Slogan */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.7)", letterSpacing: "0.05em", marginBottom: 8, textTransform: "uppercase" }}>
              Slogan
            </label>
            <input
              type="text"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              placeholder="Câu nói đặc trưng của nhân vật..."
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "rgba(108,92,231,0.6)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(108,92,231,0.2)")}
            />
          </div>

          {/* Curse */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.7)", letterSpacing: "0.05em", marginBottom: 8, textTransform: "uppercase" }}>
              Lời Nguyền
            </label>
            <input
              type="text"
              value={curse}
              onChange={(e) => setCurse(e.target.value)}
              placeholder="Lời nguyền bí ẩn của nhân vật..."
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "rgba(108,92,231,0.6)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(108,92,231,0.2)")}
            />
          </div>

          {/* Personality */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.7)", letterSpacing: "0.05em", marginBottom: 8, textTransform: "uppercase" }}>
              Tính Cách & System Prompt
            </label>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginBottom: 8, lineHeight: 1.5 }}>
              Đây là system prompt gửi đến AI — mô tả chi tiết nhân vật, cách nói chuyện, thế giới quan...
            </p>
            <textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Bạn là Elara, một phù thủy thời gian bí ẩn... Hãy phản hồi bằng tiếng Việt."
              rows={6}
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: 120,
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(108,92,231,0.6)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(108,92,231,0.2)")}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#fca5a5",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "14px 0",
              borderRadius: 14,
              border: "none",
              background: saving ? "rgba(108,92,231,0.4)" : "linear-gradient(135deg, #7c3aed, #6c5ce7)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              boxShadow: saving ? "none" : "0 6px 20px rgba(108,92,231,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 32,
              transition: "all 0.2s",
            }}
          >
            {saving ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                Đang triệu hồi...
              </>
            ) : (
              "✦ Triệu hồi Nhân Vật"
            )}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        textarea::placeholder, input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
