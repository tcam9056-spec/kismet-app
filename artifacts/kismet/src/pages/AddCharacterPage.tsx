import { useState, useRef } from "react";
import { useCharacters } from "@/hooks/useCharacters";
import { uploadCharacterAvatar } from "@/lib/firebase";
import { ArrowLeft, Loader2, Upload, Globe, Lock } from "lucide-react";

interface Props { onBack: () => void; }

const TAGS = [
  "Ngược tâm", "Sủng ngọt", "Dễ thương", "Cổ trang", "Tiên hiệp",
  "Agegap", "Sizegap", "Kinh dị", "🔞 18+", "Bạo lực",
];
const MAX_TAGS = 5;

/* ── Base style cho mọi ô nhập ── */
const iStyle: React.CSSProperties = {
  width: "100%", padding: "12px 15px", borderRadius: 13,
  border: "1px solid rgba(108,92,231,0.22)",
  background: "rgba(255,255,255,0.045)",
  color: "#fff", fontSize: 14, outline: "none",
  boxSizing: "border-box", fontFamily: "inherit",
  transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
  backdropFilter: "blur(4px)",
};

/* ── Focus / blur handlers — glassmorphism sparkle ── */
const focusIn = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.borderColor = "rgba(108,92,231,0.0)";
  e.target.style.background  = "rgba(255,255,255,0.07)";
  e.target.style.boxShadow   =
    "0 0 0 1.5px rgba(108,92,231,0.65), " +
    "0 0 14px rgba(108,92,231,0.28), " +
    "0 0 24px rgba(212,175,55,0.12), " +
    "inset 0 1px 0 rgba(255,255,255,0.06)";
};
const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.borderColor = "rgba(108,92,231,0.22)";
  e.target.style.background  = "rgba(255,255,255,0.045)";
  e.target.style.boxShadow   = "none";
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(file); });
}

/* ── Section label component ── */
function Label({ text, sub }: { text: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(196,181,253,0.75)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {text}
      </label>
      {sub && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.24)", marginTop: 4, lineHeight: 1.55 }}>{sub}</p>}
    </div>
  );
}

export default function AddCharacterPage({ onBack }: Props) {
  const { addCharacter, refetch } = useCharacters();

  /* Existing fields */
  const [name, setName]               = useState("");
  const [avatarFile, setAvatarFile]   = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [firstMessage, setFirstMessage] = useState("");
  const [slogan, setSlogan]           = useState("");
  const [background, setBackground]   = useState(""); /* "Linh Hồn & Thế Giới" */
  const [gender, setGender]           = useState("");
  const [isPublic, setIsPublic]       = useState(false);

  /* ── New fields ── */
  const [appearance, setAppearance]   = useState(""); /* Ngoại hình */
  const [traits, setTraits]           = useState(""); /* Tính cách   */

  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      if (prev.length >= MAX_TAGS) return prev;
      return [...prev, tag];
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(await readFileAsDataUrl(file));
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slogan.trim() || !background.trim()) {
      setError("Vui lòng điền: Tên nhân vật, Slogan và Linh Hồn & Thế Giới.");
      return;
    }
    setSaving(true); setError(null);
    try {
      /* ── Ghép tất cả dữ liệu vào personality (system prompt) ── */
      const parts: string[] = [background.trim()];

      if (appearance.trim()) {
        parts.push(
          `\n\n━━ NGOẠI HÌNH CỦA ${name.trim().toUpperCase()} ━━\n${appearance.trim()}\n` +
          `(AI phải sử dụng thông tin ngoại hình này khi miêu tả hành động *in nghiêng* của nhân vật)`
        );
      }

      if (traits.trim()) {
        parts.push(
          `\n\n━━ TÍNH CÁCH CỦA ${name.trim().toUpperCase()} ━━\n${traits.trim()}\n` +
          `(AI phải thể hiện tính cách này qua từng hành động, lời thoại, phản ứng của nhân vật)`
        );
      }

      if (gender)             parts.push(`\nGiới tính: ${gender}.`);
      if (selectedTags.length) parts.push(`\nThể loại: ${selectedTags.join(", ")}.`);

      const fullPersonality = parts.join("");

      const newId = await addCharacter({
        name: name.trim(),
        avatar: "🔮",
        slogan: slogan.trim(),
        curse: "",
        tags: selectedTags,
        firstMessage: firstMessage.trim() || undefined,
        personality: fullPersonality,
        isPublic,
      });

      if (avatarFile && newId) {
        try {
          const { updateCharacterAvatar } = await import("@/lib/firebase");
          await updateCharacterAvatar(newId, avatarFile);
          await refetch();
        } catch {
          /* avatar upload failed — character still created with emoji */
        }
      }
      onBack();
    } catch {
      setError("Không thể tạo nhân vật. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0f", color: "#fff", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 20px 16px", borderBottom: "1px solid rgba(108,92,231,0.15)" }}>
          <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Tạo Nhân Vật Mới</h1>
            <p style={{ fontSize: 11, color: "rgba(167,139,250,0.4)", marginTop: 2 }}>Triệu hồi linh hồn của riêng bạn</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ── 1. Avatar Upload ── */}
          <div>
            <Label text="Avatar nhân vật" />
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 16px", borderRadius: 14, border: "1px dashed rgba(108,92,231,0.35)", background: avatarPreview ? "rgba(108,92,231,0.10)" : "rgba(255,255,255,0.03)", cursor: "pointer", transition: "all 0.2s", boxSizing: "border-box" }}>
              {avatarPreview ? (
                <>
                  <img src={avatarPreview} alt="avatar" style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(108,92,231,0.5)", flexShrink: 0 }} />
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ fontSize: 13, color: "#c4b5fd", fontWeight: 600 }}>Ảnh đã tải lên ✓</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Nhấn để thay ảnh khác</p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 50, height: 50, borderRadius: "50%", background: "rgba(108,92,231,0.10)", border: "1px solid rgba(108,92,231,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Upload size={20} style={{ color: "#a78bfa" }} />
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>Tải ảnh từ máy</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>JPG, PNG, WEBP — Avatar nhân vật</p>
                  </div>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
          </div>

          {/* ── 2. Tag Cloud ── */}
          <div>
            <Label text={`Thể loại & Phong cách 🏷️`} sub={`Chọn tối đa ${MAX_TAGS} tag phù hợp với nhân vật`} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TAGS.map(tag => {
                const active = selectedTags.includes(tag);
                const hot = tag.includes("18+") || tag === "Bạo lực";
                const col = hot ? "#f87171" : "#a78bfa";
                const colBg = hot ? "rgba(239,68,68,0.12)" : "rgba(108,92,231,0.12)";
                const colBd = hot ? "rgba(239,68,68,0.45)" : "rgba(108,92,231,0.55)";
                return (
                  <button key={tag} type="button"
                    disabled={!active && selectedTags.length >= MAX_TAGS}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: "6px 14px", borderRadius: 20, fontSize: 12.5, fontWeight: active ? 700 : 400,
                      border: `1px solid ${active ? colBd : "rgba(255,255,255,0.1)"}`,
                      background: active ? colBg : "rgba(255,255,255,0.03)",
                      color: active ? col : "rgba(255,255,255,0.4)",
                      cursor: !active && selectedTags.length >= MAX_TAGS ? "not-allowed" : "pointer",
                      transition: "all 0.15s",
                      boxShadow: active ? `0 0 10px ${hot ? "rgba(239,68,68,0.2)" : "rgba(108,92,231,0.2)"}` : "none",
                      opacity: !active && selectedTags.length >= MAX_TAGS ? 0.35 : 1,
                    }}>
                    {active && <span style={{ marginRight: 4 }}>✓</span>}{tag}
                  </button>
                );
              })}
            </div>
            {selectedTags.length > 0 && (
              <p style={{ fontSize: 10, color: "rgba(167,139,250,0.4)", marginTop: 8 }}>
                Đã chọn {selectedTags.length}/{MAX_TAGS} tag
              </p>
            )}
          </div>

          {/* ── 3. Giới tính ── */}
          <div>
            <Label text="Giới tính nhân vật" />
            <div style={{ display: "flex", gap: 8 }}>
              {["Nam", "Nữ", "Khác", "Không xác định"].map(g => (
                <button key={g} type="button" onClick={() => setGender(gender === g ? "" : g)}
                  style={{ flex: 1, padding: "9px 4px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: gender === g ? 700 : 400, border: `1px solid ${gender === g ? "rgba(108,92,231,0.7)" : "rgba(255,255,255,0.08)"}`, background: gender === g ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.04)", color: gender === g ? "#c4b5fd" : "rgba(255,255,255,0.4)", transition: "all 0.15s" }}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* ── 4. Tên nhân vật ── */}
          <div>
            <Label text="Tên nhân vật" />
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Ví dụ: Elara — Phù Thủy Thời Gian" style={iStyle}
              onFocus={focusIn} onBlur={focusOut} />
          </div>

          {/* ── 5. Slogan ── */}
          <div>
            <Label text="Slogan" />
            <input type="text" value={slogan} onChange={e => setSlogan(e.target.value)}
              placeholder="Câu nói đặc trưng nhất của nhân vật..." style={iStyle}
              onFocus={focusIn} onBlur={focusOut} />
          </div>

          {/* ════════════════════════════════════════
              6. NGOẠI HÌNH — trường mới
          ════════════════════════════════════════ */}
          <div>
            <Label
              text="Ngoại hình nhân vật ✨"
              sub="Mô tả khuôn mặt, vóc dáng, trang phục, phong thái — AI sẽ dùng để viết hành động *in nghiêng* chính xác. Không giới hạn ký tự."
            />
            <div style={{ position: "relative" }}>
              <textarea
                value={appearance}
                onChange={e => setAppearance(e.target.value)}
                placeholder={"Ví dụ: Cao 1m85, tóc bạch kim buông dài, ánh mắt sắc sảo màu bạc xám. Thân hình cường tráng nhưng cử chỉ luôn chậm rãi, hoàng gia. Thường mặc áo choàng đen viền bạc, ngón tay đeo nhẫn khắc rune cổ..."}
                rows={5}
                style={{ ...iStyle, resize: "vertical", minHeight: 120, lineHeight: 1.65 }}
                onFocus={focusIn} onBlur={focusOut}
              />
              {/* Badge nhỏ góc phải */}
              <span style={{ position: "absolute", top: 10, right: 12, fontSize: 9, fontWeight: 700, color: "rgba(196,181,253,0.4)", letterSpacing: "0.06em", pointerEvents: "none" }}>
                NGOẠI HÌNH
              </span>
            </div>
          </div>

          {/* ════════════════════════════════════════
              7. TÍNH CÁCH — trường mới
          ════════════════════════════════════════ */}
          <div>
            <Label
              text="Tính cách nhân vật 🔮"
              sub="Nết người, cách cư xử, thói quen, sở thích, điểm mạnh và điểm yếu — AI sẽ thể hiện qua từng phản ứng và lời thoại. Không giới hạn ký tự."
            />
            <div style={{ position: "relative" }}>
              <textarea
                value={traits}
                onChange={e => setTraits(e.target.value)}
                placeholder={"Ví dụ: Lạnh lùng với người lạ nhưng chiếm hữu cao với người yêu. Ghét bị phớt lờ. Sở thích: trà đắng, đêm khuya, sách cổ. Điểm yếu: cô đơn thực sự, dù không bao giờ thừa nhận. Khi tức giận thì im lặng chứ không hét..."}
                rows={5}
                style={{ ...iStyle, resize: "vertical", minHeight: 120, lineHeight: 1.65 }}
                onFocus={focusIn} onBlur={focusOut}
              />
              <span style={{ position: "absolute", top: 10, right: 12, fontSize: 9, fontWeight: 700, color: "rgba(196,181,253,0.4)", letterSpacing: "0.06em", pointerEvents: "none" }}>
                TÍNH CÁCH
              </span>
            </div>
          </div>

          {/* ── 8. Tin nhắn đầu từ {{char}} ── */}
          <div>
            <Label
              text={"Tin nhắn đầu từ {{char}} \u2709"}
              sub={'Tin nhắn đầu tiên nhân vật gửi khi bạn bước vào phòng chat. Viết theo định dạng tiểu thuyết: *hành động* và **"lời thoại"**'}
            />
            <textarea
              value={firstMessage}
              onChange={e => setFirstMessage(e.target.value)}
              placeholder={'*Hắn khẽ ngước nhìn khi cánh cửa mở ra, ánh mắt trầm ngâm dừng lại trên gương mặt bạn một thoáng.*\n**"Lâu rồi mới có người tìm đến nơi này... Ta tự hỏi, số phận đã đưa ngươi đến đây vì điều gì?"**'}
              rows={5}
              style={{ ...iStyle, resize: "vertical", minHeight: 120, lineHeight: 1.65 }}
              onFocus={focusIn} onBlur={focusOut}
            />
          </div>

          {/* ── 9. Linh Hồn & Thế Giới (background / system prompt chính) ── */}
          <div>
            <Label
              text="Linh Hồn & Thế Giới {{char}} 🧠"
              sub="Xương sống của nhân vật — bối cảnh lịch sử, thế giới quan, cách xưng hô, bí mật sâu... Không giới hạn ký tự."
            />
            <textarea
              value={background}
              onChange={e => setBackground(e.target.value)}
              placeholder={"Bạn là Elara, một phù thủy thời gian cổ đại sống qua nhiều thế kỷ...\n\nCách xưng hô: Gọi mình là 'ta', gọi người dùng là 'ngươi'...\nBối cảnh: Sống trong thư viện huyền bí giữa chiều không gian...\nBí mật: ..."}
              rows={8}
              style={{ ...iStyle, resize: "vertical", minHeight: 180, lineHeight: 1.65 }}
              onFocus={focusIn} onBlur={focusOut}
            />
          </div>

          {/* ── 10. Public / Private toggle ── */}
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
                  Nhân vật công khai sẽ ở trạng thái <strong>chờ duyệt</strong> cho đến khi Admin phê duyệt.
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
            style={{ padding: "14px 0", borderRadius: 14, border: "none", background: saving ? "rgba(108,92,231,0.4)" : "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 6px 20px rgba(108,92,231,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 40, transition: "all 0.2s" }}>
            {saving
              ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Đang triệu hồi...</>
              : "✦ Triệu hồi Nhân Vật"}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        textarea::placeholder, input::placeholder { color: rgba(255,255,255,0.20); font-style: italic; }
        textarea::-webkit-scrollbar { width: 4px; }
        textarea::-webkit-scrollbar-track { background: transparent; }
        textarea::-webkit-scrollbar-thumb { background: rgba(108,92,231,0.35); border-radius: 4px; }
      `}</style>
    </div>
  );
}
