import { useState, useEffect, useRef } from "react";
import {
  Settings, Plus, LogOut, Loader2, Globe, MessageCircle, User,
  Camera, Search
} from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useCharacters } from "@/hooks/useCharacters";
import type { Character } from "@/lib/types";
import CharacterProfile from "./CharacterProfile";

type Tab = "all" | "messages" | "profile";

interface Props {
  onChat: (character: Character) => void;
  onSettings: () => void;
  onAddCharacter: () => void;
}

/* ── helpers ── */
function loadCharAvatar(id: string) { return localStorage.getItem(`kismet_char_avatar_${id}`); }
function loadUserAvatar(email: string) { return localStorage.getItem(`avatar_${email}`); }
function saveUserAvatar(email: string, b64: string) { localStorage.setItem(`avatar_${email}`, b64); }
function readFileAsBase64(file: File): Promise<string> {
  return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(file); });
}

/* ── CharAvatar component ── */
function CharAvatar({ id, emoji, size }: { id: string; emoji: string; size: number }) {
  const src = loadCharAvatar(id);
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: src ? "transparent" : "linear-gradient(135deg,#1a0a3e,#6c5ce7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.48, flexShrink: 0, border: "1.5px solid rgba(108,92,231,0.4)", boxShadow: "0 0 16px rgba(108,92,231,0.25)", overflow: "hidden" }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : emoji}
    </div>
  );
}

/* ── UserAvatar component ── */
function UserAvatar({ src, size }: { src: string | null; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: src ? "transparent" : "rgba(108,92,231,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.45, border: "2px solid rgba(108,92,231,0.4)", overflow: "hidden" }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
    </div>
  );
}

/* ══════════════════════════════════════════════
   TAB: ALL (character cards)
══════════════════════════════════════════════ */
function AllTab({ onChat, onAddCharacter }: { onChat: (c: Character) => void; onAddCharacter: () => void }) {
  const { characters, loading } = useCharacters();
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? characters.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.slogan.toLowerCase().includes(query.toLowerCase()))
    : characters;

  return (
    <div style={{ padding: "16px 16px 0" }}>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(167,139,250,0.4)" }} />
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm nhân vật..."
          style={{ width: "100%", padding: "10px 14px 10px 34px", borderRadius: 12, border: "1px solid rgba(108,92,231,0.18)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          onFocus={e => (e.target.style.borderColor = "rgba(108,92,231,0.5)")} onBlur={e => (e.target.style.borderColor = "rgba(108,92,231,0.18)")} />
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "50px 0", gap: 10 }}>
          <Loader2 size={22} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: 13, color: "rgba(167,139,250,0.4)", fontStyle: "italic" }}>Đang triệu hồi nhân vật...</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(char => (
            <div key={char.id} onClick={() => onChat(char)}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, border: "1px solid rgba(108,92,231,0.15)", background: "rgba(255,255,255,0.03)", cursor: "pointer", transition: "all 0.15s", position: "relative", overflow: "hidden" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(108,92,231,0.4)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(108,92,231,0.07)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(108,92,231,0.15)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }}>
              <button style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}
                onClick={e => { e.stopPropagation(); setSelectedChar(char); }}>
                <CharAvatar id={char.id} emoji={char.avatar} size={52} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{char.name}</p>
                <p style={{ fontSize: 12, color: "rgba(167,139,250,0.55)", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>"{char.slogan}"</p>
                {char.isPublic && (
                  <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, color: "#34d399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 20, padding: "1px 8px" }}>✦ Công khai</span>
                )}
              </div>
              <span style={{ fontSize: 18, color: "rgba(108,92,231,0.4)", flexShrink: 0 }}>›</span>
            </div>
          ))}

          <button onClick={onAddCharacter}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, border: "1px dashed rgba(108,92,231,0.25)", background: "transparent", cursor: "pointer", width: "100%", transition: "all 0.15s", color: "#fff", marginBottom: 16 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(108,92,231,0.5)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(108,92,231,0.07)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(108,92,231,0.25)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", border: "1.5px dashed rgba(108,92,231,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Plus size={20} style={{ color: "rgba(108,92,231,0.5)" }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(167,139,250,0.6)", marginBottom: 2 }}>Tạo nhân vật mới</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Triệu hồi linh hồn của riêng bạn</p>
            </div>
          </button>
        </div>
      )}

      {selectedChar && (
        <CharacterProfile character={selectedChar} onClose={() => setSelectedChar(null)} onChat={() => { onChat(selectedChar); setSelectedChar(null); }} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   TAB: MESSAGES (recent chats)
══════════════════════════════════════════════ */
function MessagesTab({ onChat }: { onChat: (c: Character) => void }) {
  const { user } = useAuth();
  const { characters, loading } = useCharacters();

  interface RecentChat { char: Character; lastMsg: string; lastTime: number; }
  const recentChats: RecentChat[] = [];

  if (!loading && user) {
    const email = user.email || user.uid;
    for (const char of characters) {
      try {
        const raw = localStorage.getItem(`kismet_chat_${email}_${char.id}`);
        if (!raw) continue;
        const msgs = JSON.parse(raw);
        if (!Array.isArray(msgs) || msgs.length === 0) continue;
        const last = msgs[msgs.length - 1];
        recentChats.push({ char, lastMsg: last.content, lastTime: last.timestamp });
      } catch {}
    }
    recentChats.sort((a, b) => b.lastTime - a.lastTime);
  }

  const fmt = (ts: number) => {
    const d = new Date(ts); const now = new Date();
    if (d.toDateString() === now.toDateString()) return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", gap: 10 }}>
      <Loader2 size={22} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (recentChats.length === 0) return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <p style={{ fontSize: 32, marginBottom: 12 }}>💬</p>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Chưa có cuộc trò chuyện nào</p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>Vào tab "Tất cả" để bắt đầu chat</p>
    </div>
  );

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(167,139,250,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, paddingLeft: 4 }}>
        Đang chat · {recentChats.length} nhân vật
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {recentChats.map(({ char, lastMsg, lastTime }) => (
          <div key={char.id} onClick={() => onChat(char)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, border: "1px solid rgba(108,92,231,0.12)", background: "rgba(255,255,255,0.03)", cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(108,92,231,0.07)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }}>
            <CharAvatar id={char.id} emoji={char.avatar} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{char.name}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", flexShrink: 0, marginLeft: 8 }}>{fmt(lastTime)}</p>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {lastMsg.length > 60 ? lastMsg.slice(0, 60) + "…" : lastMsg}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   TAB: PROFILE (saved to Firestore + localStorage)
══════════════════════════════════════════════ */
interface ProfileData { gender: string; personality: string; bio: string; appearance: string; displayName: string; }

function ProfileTab() {
  const { user, logout } = useAuth();
  const email = user?.email || user?.uid || "";
  const fileRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData>({ gender: "", personality: "", bio: "", appearance: "", displayName: "" });
  const [draft, setDraft] = useState<ProfileData>({ gender: "", personality: "", bio: "", appearance: "", displayName: "" });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /* Load from Firestore → fallback localStorage */
  useEffect(() => {
    if (!user) return;
    const ua = loadUserAvatar(email);
    setAvatarUrl(ua); setAvatarDraft(ua);

    (async () => {
      try {
        const ref = doc(db, "users", user.uid, "profile", "data");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data() as ProfileData;
          setProfile(d); setDraft(d);
          /* Sync to localStorage */
          localStorage.setItem(`kismet_profile_${user.uid}`, JSON.stringify(d));
        } else {
          /* Fallback to localStorage */
          const raw = localStorage.getItem(`kismet_profile_${user.uid}`);
          if (raw) { const d = JSON.parse(raw); setProfile(d); setDraft(d); }
        }
      } catch {
        const raw = localStorage.getItem(`kismet_profile_${user.uid}`);
        if (raw) { const d = JSON.parse(raw); setProfile(d); setDraft(d); }
      }
      setLoadingProfile(false);
    })();
  }, [user?.uid, email]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const b64 = await readFileAsBase64(file);
    setAvatarDraft(b64); e.target.value = "";
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      /* Save avatar to localStorage */
      if (avatarDraft !== avatarUrl) {
        if (avatarDraft) { saveUserAvatar(email, avatarDraft); setAvatarUrl(avatarDraft); }
        else { localStorage.removeItem(`avatar_${email}`); setAvatarUrl(null); }
      }
      /* Save profile to Firestore (persistent across devices) */
      const ref = doc(db, "users", user.uid, "profile", "data");
      await setDoc(ref, { ...draft, updatedAt: serverTimestamp() }, { merge: true });
      /* Also cache to localStorage */
      localStorage.setItem(`kismet_profile_${user.uid}`, JSON.stringify(draft));
      setProfile(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* If Firestore fails, still save locally */
      localStorage.setItem(`kismet_profile_${user.uid}`, JSON.stringify(draft));
      setProfile(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (loadingProfile) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
      <Loader2 size={20} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ padding: "20px 16px 32px" }}>
      {/* Avatar */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <UserAvatar src={avatarDraft} size={92} />
          <button onClick={() => fileRef.current?.click()}
            style={{ position: "absolute", bottom: 4, right: 4, width: 30, height: 30, borderRadius: "50%", border: "2px solid #0a0a0f", background: "#6c5ce7", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
            <Camera size={14} />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
        <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginTop: 12, marginBottom: 2 }}>
          {draft.displayName || email.split("@")[0]}
        </p>
        <p style={{ fontSize: 11, color: "rgba(167,139,250,0.45)" }}>{email}</p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, padding: "3px 12px", borderRadius: 20, background: "rgba(108,92,231,0.1)", border: "1px solid rgba(108,92,231,0.2)" }}>
          <span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 600 }}>✦ Lưu trên Firestore · Không mất khi tải lại</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Display name */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.7)", display: "block", marginBottom: 8 }}>Tên hiển thị</label>
          <input type="text" value={draft.displayName} onChange={e => setDraft(p => ({ ...p, displayName: e.target.value }))} placeholder="Tên bạn muốn dùng trong roleplay..."
            style={{ width: "100%", padding: "10px 14px", borderRadius: 12, outline: "none", border: "1px solid rgba(108,92,231,0.2)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" }}
            onFocus={e => (e.target.style.borderColor = "rgba(108,92,231,0.6)")} onBlur={e => (e.target.style.borderColor = "rgba(108,92,231,0.2)")} />
        </div>

        {/* Giới tính */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.7)", display: "block", marginBottom: 8 }}>Giới tính</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["Nữ", "Nam", "Khác"].map(g => (
              <button key={g} onClick={() => setDraft(p => ({ ...p, gender: g }))}
                style={{ flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer", border: `1px solid ${draft.gender === g ? "rgba(108,92,231,0.7)" : "rgba(255,255,255,0.08)"}`, background: draft.gender === g ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.04)", color: draft.gender === g ? "#c4b5fd" : "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: draft.gender === g ? 700 : 400 }}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {[
          { key: "personality" as const, label: "Tính cách", placeholder: "Ví dụ: U ám, tinh nghịch, hay suy nghĩ..." },
          { key: "appearance" as const, label: "Ngoại hình", placeholder: "Màu tóc, chiều cao, phong cách..." },
          { key: "bio" as const, label: "Thông tin bản thân", placeholder: "Bạn là ai? Nghề nghiệp, sở thích..." },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.7)", display: "block", marginBottom: 8 }}>{label}</label>
            <textarea value={draft[key]} onChange={e => setDraft(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} rows={2}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, outline: "none", border: "1px solid rgba(108,92,231,0.2)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 13, resize: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              onFocus={e => (e.target.style.borderColor = "rgba(108,92,231,0.6)")} onBlur={e => (e.target.style.borderColor = "rgba(108,92,231,0.2)")} />
          </div>
        ))}
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{ marginTop: 20, width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: saved ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", boxShadow: "0 6px 20px rgba(108,92,231,0.3)", transition: "background 0.3s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {saving ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />Đang lưu...</> : saved ? "✓ Đã lưu lên cloud!" : "Lưu hồ sơ"}
      </button>

      {/* Logout */}
      <button onClick={() => logout()}
        style={{ marginTop: 12, width: "100%", padding: "12px 0", borderRadius: 14, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", color: "rgba(239,68,68,0.6)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <LogOut size={14} /> Đăng xuất
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN HOME PAGE
══════════════════════════════════════════════ */
export default function HomePage({ onChat, onSettings, onAddCharacter }: Props) {
  const { user } = useAuth();
  const email = user?.email || user?.uid || "";
  const [tab, setTab] = useState<Tab>("all");
  const appLogo = localStorage.getItem("kismet_logo");

  const navTab = (t: Tab, icon: React.ReactNode, label: string) => {
    const active = tab === t;
    return (
      <button onClick={() => setTab(t)}
        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "10px 0 6px", position: "relative" }}>
        {/* Active indicator */}
        {active && <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 32, height: 2, borderRadius: 2, background: "#6c5ce7" }} />}
        <div style={{ color: active ? "#a78bfa" : "rgba(255,255,255,0.25)", transition: "color 0.2s" }}>{icon}</div>
        <span style={{ fontSize: 10, fontWeight: 700, color: active ? "#a78bfa" : "rgba(255,255,255,0.25)", transition: "color 0.2s", letterSpacing: "0.04em" }}>{label}</span>
      </button>
    );
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#0a0a0f", color: "#fff", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── TOP HEADER ── */}
      <div style={{ background: "linear-gradient(180deg,#13101f,#0f0d1a)", borderBottom: "1px solid rgba(108,92,231,0.15)", padding: "14px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        {/* Logo + Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {appLogo ? (
            <img src={appLogo} alt="logo" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(212,175,55,0.3)" }} />
          ) : (
            <span style={{ fontSize: 24, filter: "drop-shadow(0 0 10px rgba(212,175,55,0.4))" }}>🌌</span>
          )}
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.1em", background: "linear-gradient(135deg,#f5e6a3,#d4af37)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>KISMET</h1>
            <p style={{ fontSize: 10, color: "rgba(167,139,250,0.4)", letterSpacing: "0.05em" }}>{email}</p>
          </div>
        </div>

        <button onClick={onSettings} title="Cài đặt"
          style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "rgba(167,139,250,0.7)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Settings size={15} />
        </button>
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          {tab === "all" && <AllTab onChat={onChat} onAddCharacter={onAddCharacter} />}
          {tab === "messages" && <MessagesTab onChat={onChat} />}
          {tab === "profile" && <ProfileTab />}
        </div>
      </div>

      {/* ── BOTTOM NAVIGATION ── */}
      <div style={{ flexShrink: 0, background: "rgba(12,10,22,0.98)", borderTop: "1px solid rgba(108,92,231,0.15)", display: "flex", maxWidth: "100%", backdropFilter: "blur(20px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div style={{ display: "flex", width: "100%", maxWidth: 480, margin: "0 auto" }}>
          {navTab("all", <Globe size={20} />, "Tất cả")}
          {navTab("messages", <MessageCircle size={20} />, "Tin nhắn")}
          {navTab("profile", <User size={20} />, "Hồ sơ")}
        </div>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        textarea::placeholder, input::placeholder { color: rgba(255,255,255,0.2); }
        *::-webkit-scrollbar{width:4px}*::-webkit-scrollbar-track{background:transparent}*::-webkit-scrollbar-thumb{background:rgba(108,92,231,0.3);border-radius:4px}
      `}</style>
    </div>
  );
}
