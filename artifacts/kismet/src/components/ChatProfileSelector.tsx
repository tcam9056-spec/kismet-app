import { useState } from "react";
import { X, Plus, Trash2, Check, User } from "lucide-react";
import type { ChatProfile } from "@/hooks/useChatProfiles";

interface Props {
  userId: string;
  profiles: ChatProfile[];
  activeId: string | null;
  loading: boolean;
  onSelect: (profile: ChatProfile | null) => void;
  onCreate: (payload: Omit<ChatProfile, "_id" | "createdAt">) => Promise<ChatProfile | null>;
  onDelete: (id: string) => Promise<boolean>;
  onClose: () => void;
}

const EMPTY_FORM = { name: "", gender: "", personality: "", bio: "", appearance: "", avatar: "" };

export default function ChatProfileSelector({
  userId, profiles, activeId, loading, onSelect, onCreate, onDelete, onClose,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const field = (label: string, key: keyof typeof form, placeholder: string, rows?: number) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "rgba(167,139,250,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>{label}</label>
      {rows ? (
        <textarea
          value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          placeholder={placeholder} rows={rows}
          style={{ width: "100%", padding: "9px 12px", borderRadius: 11, border: "1px solid rgba(108,92,231,0.25)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }}
        />
      ) : (
        <input
          value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          placeholder={placeholder}
          style={{ width: "100%", padding: "9px 12px", borderRadius: 11, border: "1px solid rgba(108,92,231,0.25)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
        />
      )}
    </div>
  );

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onCreate({ ...form, userId, isDefault: false });
    setForm(EMPTY_FORM);
    setShowCreate(false);
    setSaving(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 350, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, background: "linear-gradient(180deg,#1a1530,#0f0c1e)", border: "1px solid rgba(108,92,231,0.2)", borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: "86dvh", display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "18px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(108,92,231,0.1)", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 2 }}>Hồ sơ nhập vai</h2>
            <p style={{ fontSize: 11, color: "rgba(167,139,250,0.45)" }}>Chọn nhân vật bạn muốn trở thành khi chat</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>

          {/* "Không dùng" option */}
          <button
            onClick={() => { onSelect(null); onClose(); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: `1px solid ${!activeId ? "rgba(108,92,231,0.5)" : "rgba(255,255,255,0.06)"}`, background: !activeId ? "rgba(108,92,231,0.1)" : "rgba(255,255,255,0.02)", cursor: "pointer", marginBottom: 10, textAlign: "left" }}
          >
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <User size={17} style={{ color: "rgba(167,139,250,0.5)" }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Không dùng hồ sơ</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Dùng thông tin hồ sơ chính của bạn</p>
            </div>
            {!activeId && <Check size={15} style={{ color: "#a78bfa", flexShrink: 0 }} />}
          </button>

          {/* Profile list */}
          {loading && (
            <p style={{ textAlign: "center", color: "rgba(167,139,250,0.4)", fontSize: 13, padding: "20px 0" }}>Đang tải...</p>
          )}

          {!loading && profiles.map(p => {
            const isActive = activeId === p._id;
            return (
              <button
                key={p._id}
                onClick={() => { onSelect(p); onClose(); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: `1px solid ${isActive ? "rgba(108,92,231,0.5)" : "rgba(255,255,255,0.06)"}`, background: isActive ? "rgba(108,92,231,0.1)" : "rgba(255,255,255,0.02)", cursor: "pointer", marginBottom: 8, textAlign: "left", position: "relative" }}
              >
                {/* Avatar circle */}
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#3d1e7a,#6c5ce7)", border: "1px solid rgba(108,92,231,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>
                  {p.avatar || "👤"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</p>
                    {p.isDefault && <span style={{ fontSize: 9, fontWeight: 700, color: "#a78bfa", background: "rgba(108,92,231,0.15)", border: "1px solid rgba(108,92,231,0.3)", borderRadius: 20, padding: "1px 6px", flexShrink: 0 }}>Mặc định</span>}
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {[p.gender, p.personality].filter(Boolean).join(" · ") || "Chưa có mô tả"}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {isActive && <Check size={15} style={{ color: "#a78bfa" }} />}
                  <button
                    onClick={e => handleDelete(p._id, e)}
                    disabled={deletingId === p._id}
                    style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", color: deletingId === p._id ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </button>
            );
          })}

          {!loading && profiles.length === 0 && !showCreate && (
            <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>🎭</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Chưa có hồ sơ nhập vai nào</p>
              <p style={{ fontSize: 11, color: "rgba(167,139,250,0.3)", marginTop: 4 }}>Tạo hồ sơ để AI biết bạn đang đóng vai ai</p>
            </div>
          )}

          {/* Create form */}
          {showCreate && (
            <div style={{ marginTop: 12, padding: "16px 14px", borderRadius: 16, border: "1px solid rgba(108,92,231,0.2)", background: "rgba(108,92,231,0.04)" }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#c4b5fd", marginBottom: 14 }}>✦ Tạo hồ sơ mới</p>
              {field("Tên nhân vật *", "name", "Ví dụ: Minh, Lily, Ryu...")}
              {field("Emoji đại diện", "avatar", "👤 hoặc 🦊 hoặc để trống")}
              {field("Giới tính", "gender", "Nam / Nữ / Khác...")}
              {field("Tính cách", "personality", "Ví dụ: Dịu dàng, thông minh, hơi tsundere...", 2)}
              {field("Ngoại hình", "appearance", "Mô tả ngắn về ngoại hình...", 2)}
              {field("Thông tin bản thân", "bio", "Nghề nghiệp, hoàn cảnh, câu chuyện...", 2)}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }} style={{ flex: 1, padding: "10px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Huỷ
                </button>
                <button onClick={handleCreate} disabled={saving || !form.name.trim()} style={{ flex: 2, padding: "10px", borderRadius: 11, border: "none", background: saving || !form.name.trim() ? "rgba(108,92,231,0.3)" : "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: saving || !form.name.trim() ? "rgba(255,255,255,0.4)" : "#fff", fontSize: 13, fontWeight: 700, cursor: saving || !form.name.trim() ? "not-allowed" : "pointer" }}>
                  {saving ? "Đang lưu..." : "Lưu hồ sơ"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer — create button */}
        {!showCreate && (
          <div style={{ padding: "12px 16px 24px", borderTop: "1px solid rgba(108,92,231,0.1)", flexShrink: 0 }}>
            <button onClick={() => setShowCreate(true)} style={{ width: "100%", padding: "12px", borderRadius: 14, border: "1px dashed rgba(108,92,231,0.35)", background: "rgba(108,92,231,0.06)", color: "#a78bfa", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Plus size={15} />
              Tạo hồ sơ mới
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
