import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft, Send, Trash2, X, Loader2, Camera, Plus,
  Phone, Gift, Heart, ChevronLeft, Shield, ShieldOff, CheckCircle2, MapPin, Lock
} from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useKeys } from "@/hooks/useKeys";
import { useAuth } from "@/contexts/AuthContext";
import { geminiRaw } from "@/lib/gemini";
import type { Character, GeminiModel } from "@/lib/types";
import { ADMIN_EMAIL } from "@/lib/types";

/* ═══════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════ */
interface UserProfile {
  gender: string; personality: string; bio: string; appearance: string;
}
interface GiftItem {
  id: string; name: string; emoji: string; description: string; howSent: string; timestamp: number;
}
interface NPC {
  name: string; emoji: string; role: string; relation: string;
}
interface FakeMessage {
  from: string; emoji: string; content: string; time: string;
}
interface PhoneData {
  npcs: NPC[];
  messages: { between: string; chat: FakeMessage[] }[];
  assets: { cash: string; properties: string[] };
}

/* ═══════════════════════════════════════════════════
   LOCALSTORAGE HELPERS
═══════════════════════════════════════════════════ */
const getCharAvatarUrl = (character: { id: string; avatar: string }) => {
  /* base64 or http URL = real image */
  if (character.avatar.startsWith("data:") || character.avatar.startsWith("http")) {
    return character.avatar;
  }
  /* fall back to localStorage cache (e.g. from a ChatPage upload) */
  return localStorage.getItem(`kismet_char_avatar_${character.id}`) || null;
};
const loadUserAvatar = (email: string) => localStorage.getItem(`avatar_${email}`);
const saveUserAvatar = (email: string, b64: string) => localStorage.setItem(`avatar_${email}`, b64);

function loadProfile(uid: string): UserProfile {
  try { const r = localStorage.getItem(`kismet_profile_${uid}`); return r ? JSON.parse(r) : { gender: "", personality: "", bio: "", appearance: "" }; }
  catch { return { gender: "", personality: "", bio: "", appearance: "" }; }
}
function saveProfile(uid: string, p: UserProfile) {
  localStorage.setItem(`kismet_profile_${uid}`, JSON.stringify(p));
}

function loadGifts(uid: string, charId: string): GiftItem[] {
  try { const r = localStorage.getItem(`kismet_gifts_${uid}_${charId}`); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function saveGifts(uid: string, charId: string, gifts: GiftItem[]) {
  localStorage.setItem(`kismet_gifts_${uid}_${charId}`, JSON.stringify(gifts));
}

function loadPhoneCache(charId: string): PhoneData | null {
  try { const r = localStorage.getItem(`kismet_phone_${charId}`); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function savePhoneCache(charId: string, data: PhoneData) {
  localStorage.setItem(`kismet_phone_${charId}`, JSON.stringify(data));
}

/* ── Memory helpers ── */
const MEMORY_MAX = 20;
function loadMemories(uid: string, charId: string): string[] {
  try { const r = localStorage.getItem(`kismet_mem_${uid}_${charId}`); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function saveMemories(uid: string, charId: string, mems: string[]) {
  localStorage.setItem(`kismet_mem_${uid}_${charId}`, JSON.stringify(mems));
}

/* ── NPC avatar helpers ── */
function npcAvatarKey(charId: string, npcName: string) {
  return `kismet_npc_${charId}_${encodeURIComponent(npcName)}`;
}
function loadNpcAvatar(charId: string, npcName: string): string | null {
  return localStorage.getItem(npcAvatarKey(charId, npcName));
}
function saveNpcAvatar(charId: string, npcName: string, b64: string) {
  localStorage.setItem(npcAvatarKey(charId, npcName), b64);
}

/* ── Parse personality for profile display ── */
function parsePersonalitySections(personality: string): { appearance?: string; traits?: string; background?: string } {
  const apM = personality.match(/━━\s*NGOẠI HÌNH[^━]*━━\n?([\s\S]*?)(?=━━|$)/i);
  const trM = personality.match(/━━\s*TÍNH CÁCH[^━]*━━\n?([\s\S]*?)(?=━━|$)/i);
  const firstSection = personality.search(/\n\n━━/);
  const bg = (firstSection > 0 ? personality.slice(0, firstSection) : "").trim();
  const clean = (s?: string) => s?.replace(/\(AI phải[^)]*\)/gi, "").trim();
  return {
    appearance: clean(apM?.[1]),
    traits: clean(trM?.[1]),
    background: bg || undefined,
  };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsDataURL(file); });
}


/* ═══════════════════════════════════════════════════
   GEMINI JSON HELPER (phone & gift generation)
═══════════════════════════════════════════════════ */
async function geminiJSON<T>(apiKey: string, model: string, prompt: string): Promise<T> {
  const text = await geminiRaw(apiKey, model, prompt, 2048);
  const match = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\})/);
  if (!match) throw new Error("Không parse được JSON từ AI");
  return JSON.parse(match[1]);
}

/* ═══════════════════════════════════════════════════
   MARKDOWN RENDERER (bold + italic only)
═══════════════════════════════════════════════════ */
function renderNovel(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Regex: **...**  (bold) | *...* (italic) | plain text
  const pattern = /\*\*("?[^*]+"?)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    }
    if (match[1] !== undefined) {
      // **bold** → dialogue
      nodes.push(<strong key={key++} style={{ fontWeight: 700, color: "#e9d5ff" }}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      // *italic* → action/description
      nodes.push(<em key={key++} style={{ fontStyle: "italic", color: "rgba(196,181,253,0.75)" }}>{match[2]}</em>);
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) {
    nodes.push(<span key={key++}>{text.slice(last)}</span>);
  }
  return nodes;
}

/* ═══════════════════════════════════════════════════
   AVATAR COMPONENTS
═══════════════════════════════════════════════════ */
function CharAvatarPlaceholder({ emoji, size }: { emoji: string; size: number }) {
  /* Beautiful gradient circle with the character's emoji */
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      border: `${size > 40 ? 2 : 1.5}px solid rgba(108,92,231,0.5)`,
      boxShadow: size > 40 ? "0 0 20px rgba(108,92,231,0.3),inset 0 0 12px rgba(108,92,231,0.15)" : "none",
      background: "linear-gradient(135deg,#1a0a3e 0%,#3d1e7a 45%,#6c5ce7 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.44, position: "relative",
    }}>
      <span style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))", lineHeight: 1 }}>{emoji}</span>
      {/* subtle shimmer ring */}
      <div style={{ position: "absolute", inset: -1, borderRadius: "50%", border: "1px solid rgba(196,181,253,0.2)", pointerEvents: "none" }} />
    </div>
  );
}

function CharAvatar({ src, emoji, size }: { src: string | null; emoji: string; size: number }) {
  if (src) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden", border: `${size > 40 ? 2 : 1.5}px solid rgba(108,92,231,0.45)`, boxShadow: size > 40 ? "0 0 20px rgba(108,92,231,0.3)" : "none" }}>
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; (e.currentTarget.parentElement?.nextSibling as HTMLElement | null)?.removeAttribute("style"); }}
        />
      </div>
    );
  }
  return <CharAvatarPlaceholder emoji={emoji} size={size} />;
}
function UserAvatar({ src, size }: { src: string | null; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: src ? "transparent" : "rgba(108,92,231,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.45, color: "#a78bfa", border: "1.5px solid rgba(108,92,231,0.35)", overflow: "hidden" }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   A. CHARACTER PROFILE MODAL
═══════════════════════════════════════════════════ */
function CharProfileModal({ character, charAvatarUrl, isOwner, onClose, onEdit }: {
  character: Character; charAvatarUrl: string | null; isOwner: boolean; onClose: () => void; onEdit?: () => void;
}) {
  const { appearance, traits, background } = parsePersonalitySections(character.personality);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, backdropFilter: "blur(12px)" }} onClick={onClose}>
      <div style={{ background: "linear-gradient(180deg,#1c1a2e,#0f0d1a)", border: "1px solid rgba(108,92,231,0.25)", borderTopLeftRadius: 28, borderTopRightRadius: 28, width: "100%", maxWidth: 480, maxHeight: "88dvh", overflowY: "auto", paddingBottom: 40 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "22px 20px 16px", display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid rgba(108,92,231,0.12)" }}>
          <CharAvatar src={charAvatarUrl} emoji={character.avatar} size={68} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 3, lineHeight: 1.2 }}>{character.name}</h2>
            <p style={{ fontSize: 12, color: "#a78bfa", fontStyle: "italic", lineHeight: 1.4 }}>"{character.slogan}"</p>
            {character.isPublic && (
              <span style={{ display: "inline-block", marginTop: 6, fontSize: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399", borderRadius: 20, padding: "1px 8px", fontWeight: 600 }}>✦ Công khai</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
            {isOwner && onEdit && (
              <button onClick={() => { onClose(); onEdit(); }}
                style={{ height: 28, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(108,92,231,0.5)", background: "rgba(108,92,231,0.15)", color: "#c4b5fd", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                ✏️ Chỉnh sửa
              </button>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ padding: "16px 18px 0" }}>

          {/* ── Chủ sở hữu: badge + background section ── */}
          {isOwner && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", marginBottom: 10 }}>
                <Lock size={9} style={{ color: "#34d399" }} />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: "#34d399", letterSpacing: "0.05em" }}>Chế độ Sáng tạo — Toàn quyền truy cập</span>
              </div>
              {(background?.length ?? 0) > 0 && (
                <div style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.13)", marginBottom: 10 }}>
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(52,211,153,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                    <Lock size={8} /> Linh Hồn &amp; Thế Giới — Riêng tư
                  </p>
                  <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.68, whiteSpace: "pre-line" }}>{background}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Ngoại hình — glassmorphism vàng ── */}
          {(appearance?.length ?? 0) > 0 && (
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{ position: "absolute", inset: -10, borderRadius: 22, background: "radial-gradient(ellipse at 50% 50%, rgba(212,175,55,0.2) 0%, transparent 72%)", pointerEvents: "none", zIndex: 0 }} />
              <div style={{ position: "absolute", inset: -1.5, borderRadius: 18, background: "linear-gradient(135deg, rgba(212,175,55,0.55) 0%, rgba(196,181,253,0.2) 50%, rgba(212,175,55,0.55) 100%)", zIndex: 0 }} />
              <div style={{ position: "relative", zIndex: 1, padding: "15px 16px", borderRadius: 17, background: "linear-gradient(155deg, rgba(28,20,54,0.96), rgba(14,9,28,0.98))", backdropFilter: "blur(14px)", overflow: "hidden" }}>
                {/* Sparkles */}
                <div style={{ position: "absolute", inset: 0, borderRadius: 17, pointerEvents: "none" }}>
                  {[{t:"10%",l:"7%",sz:2.5,d:"0s",c:"#f0d060"},{t:"80%",l:"13%",sz:2,d:"0.8s",c:"#d4af37"},{t:"18%",l:"90%",sz:2.5,d:"1.4s",c:"#fff8a0"},{t:"65%",l:"86%",sz:2,d:"0.5s",c:"#f0d060"},{t:"90%",l:"55%",sz:1.5,d:"2s",c:"#d4af37"}].map((s,i) => (
                    <div key={i} style={{ position:"absolute", top:s.t, left:s.l, width:s.sz, height:s.sz, borderRadius:"50%", background:s.c, boxShadow:`0 0 ${s.sz*4}px ${s.c}`, animation:`profileSparkle 2.5s ease-in-out ${s.d} infinite` }} />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 15 }}>✨</span>
                  <p style={{ fontSize: 10.5, fontWeight: 800, color: "#d4af37", textTransform: "uppercase", letterSpacing: "0.09em" }}>Ngoại Hình</p>
                  <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(212,175,55,0.35), transparent)" }} />
                </div>
                <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.86)", lineHeight: 1.82, whiteSpace: "pre-line", fontStyle: "italic" }}>{appearance}</p>
              </div>
            </div>
          )}

          {/* ── Tính cách — glassmorphism tím ── */}
          {(traits?.length ?? 0) > 0 && (
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{ position: "absolute", inset: -10, borderRadius: 22, background: "radial-gradient(ellipse at 50% 50%, rgba(147,51,234,0.22) 0%, transparent 72%)", pointerEvents: "none", zIndex: 0 }} />
              <div style={{ position: "absolute", inset: -1.5, borderRadius: 18, background: "linear-gradient(135deg, rgba(167,139,250,0.5) 0%, rgba(212,175,55,0.2) 50%, rgba(147,51,234,0.5) 100%)", zIndex: 0 }} />
              <div style={{ position: "relative", zIndex: 1, padding: "15px 16px", borderRadius: 17, background: "linear-gradient(155deg, rgba(22,12,50,0.97), rgba(10,6,26,0.99))", backdropFilter: "blur(14px)", overflow: "hidden" }}>
                {/* Sparkles */}
                <div style={{ position: "absolute", inset: 0, borderRadius: 17, pointerEvents: "none" }}>
                  {[{t:"12%",l:"90%",sz:2.5,d:"0.3s",c:"#c4b5fd"},{t:"75%",l:"5%",sz:2,d:"1.2s",c:"#a78bfa"},{t:"40%",l:"92%",sz:2,d:"2.1s",c:"#d4af37"},{t:"88%",l:"72%",sz:2,d:"0.7s",c:"#c4b5fd"},{t:"5%",l:"55%",sz:1.5,d:"1.7s",c:"#a78bfa"}].map((s,i) => (
                    <div key={i} style={{ position:"absolute", top:s.t, left:s.l, width:s.sz, height:s.sz, borderRadius:"50%", background:s.c, boxShadow:`0 0 ${s.sz*4}px ${s.c}`, animation:`profileSparkle 2.8s ease-in-out ${s.d} infinite` }} />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 15 }}>🔮</span>
                  <p style={{ fontSize: 10.5, fontWeight: 800, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.09em" }}>Tính Cách</p>
                  <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(167,139,250,0.35), transparent)" }} />
                </div>
                <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.86)", lineHeight: 1.82, whiteSpace: "pre-line", fontStyle: "italic" }}>{traits}</p>
              </div>
            </div>
          )}

          {/* ── Fallback nhân vật cũ ── */}
          {!appearance && !traits && !background && (() => {
            const bio = character.personality
              .replace(/\[[\w\s]+\]/g, "").replace(/━+[^━]*━+/g, "")
              .replace(/\(AI phải[^)]*\)/gi, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 400);
            return bio ? (
              <div style={{ marginBottom: 12, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(108,92,231,0.1)" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(167,139,250,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>✦ Hồ sơ nhân vật</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{bio}{character.personality.length > 400 ? "…" : ""}</p>
              </div>
            ) : null;
          })()}

          {/* ── Lời nguyền ── */}
          {character.curse && (
            <div style={{ marginBottom: 12, padding: "14px 16px", borderRadius: 14, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(239,68,68,0.55)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>⚡ Lời nguyền</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{character.curse}</p>
            </div>
          )}

          {/* ── Privacy notice cho viewer ── */}
          {!isOwner && character.isPublic && (appearance || traits) && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 10, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.04)", marginBottom: 4 }}>
              <Lock size={10} style={{ color: "rgba(167,139,250,0.3)", flexShrink: 0 }} />
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", lineHeight: 1.5 }}>Thông tin vận hành bị ẩn bởi người tạo</p>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes profileSparkle {
          0%,100% { opacity:0.12; transform:scale(0.6); }
          50%      { opacity:1;   transform:scale(1.7); }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   B. PHONE MODAL
═══════════════════════════════════════════════════ */
type PhoneTab = "npc" | "mess" | "assets";

function PhoneModal({ character, charAvatarUrl, keys, model, onClose }: {
  character: Character; charAvatarUrl: string | null; keys: string[]; model: string; onClose: () => void;
}) {
  const [tab, setTab] = useState<PhoneTab>("npc");
  const [data, setData] = useState<PhoneData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* NPC avatar state — track by name */
  const [npcAvatars, setNpcAvatars] = useState<Record<string, string>>({});
  const npcFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  /* Mess tab: open conversation index */
  const [openConvIdx, setOpenConvIdx] = useState<number | null>(null);

  const handleNpcAvatar = async (npcName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const b64 = await readFileAsBase64(file);
    saveNpcAvatar(character.id, npcName, b64);
    setNpcAvatars(prev => ({ ...prev, [npcName]: b64 }));
    e.target.value = "";
  };

  const generate = useCallback(async () => {
    const cached = loadPhoneCache(character.id);
    if (cached) { setData(cached); return; }
    if (!keys.length) { setError("Cần có API Key để tạo nội dung."); return; }
    setLoading(true); setError(null);
    try {
      const prompt = `Bạn là AI đang roleplay nhân vật: ${character.name}.
Mô tả nhân vật: ${character.personality}

Hãy tạo dữ liệu JSON cho "điện thoại" của nhân vật này. Trả lời bằng tiếng Việt.
Trả về JSON hợp lệ theo định dạng sau, KHÔNG thêm text ngoài JSON:
{
  "npcs": [
    {"name":"Tên NPC","emoji":"emoji","role":"Vai trò","relation":"Mối quan hệ với ${character.name}"},
    ... (4-5 NPC)
  ],
  "messages": [
    {
      "between": "Tên NPC 1",
      "chat": [
        {"from":"${character.name}","emoji":"${character.avatar}","content":"Nội dung tin nhắn","time":"HH:MM"},
        {"from":"Tên NPC 1","emoji":"emoji NPC","content":"Nội dung","time":"HH:MM"}
      ]
    },
    ... (2-3 cuộc hội thoại)
  ],
  "assets": {
    "cash": "Số tiền hiện có (ví dụ: 2.4 tỷ VNĐ)",
    "properties": ["Bất động sản 1 - mô tả","Bất động sản 2 - mô tả","..."]
  }
}`;
      const result = await geminiJSON<PhoneData>(keys[0], model, prompt);
      savePhoneCache(character.id, result);
      setData(result);
    } catch (e) {
      setError("Không thể tạo dữ liệu điện thoại. Thử lại sau.");
      console.error(e);
    }
    setLoading(false);
  }, [character, keys, model]);

  useEffect(() => { generate(); }, [generate]);

  /* Load saved NPC avatars once data arrives */
  useEffect(() => {
    if (!data) return;
    const avatars: Record<string, string> = {};
    data.npcs.forEach(npc => {
      const saved = loadNpcAvatar(character.id, npc.name);
      if (saved) avatars[npc.name] = saved;
    });
    setNpcAvatars(avatars);
  }, [data, character.id]);

  const tabStyle = (t: PhoneTab): React.CSSProperties => ({
    flex: 1, padding: "10px 0", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
    background: "none", color: tab === t ? "#a78bfa" : "rgba(255,255,255,0.3)",
    borderBottom: `2px solid ${tab === t ? "#6c5ce7" : "transparent"}`,
    transition: "all 0.2s",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0a0f", zIndex: 300, display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto" }}>
      {/* Phone Header */}
      <div style={{ background: "linear-gradient(180deg,#13101f,#0f0d1a)", borderBottom: "1px solid rgba(108,92,231,0.2)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronLeft size={16} />
        </button>
        <CharAvatar src={charAvatarUrl} emoji={character.avatar} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700 }}>{character.name}</p>
          <p style={{ fontSize: 10, color: "#a78bfa" }}>📱 Điện thoại AI</p>
        </div>
        {!loading && (
          <button onClick={() => { savePhoneCache(character.id, null as unknown as PhoneData); localStorage.removeItem(`kismet_phone_${character.id}`); setData(null); generate(); }}
            style={{ fontSize: 11, color: "rgba(167,139,250,0.5)", background: "none", border: "1px solid rgba(108,92,231,0.2)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
            Làm mới
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(108,92,231,0.1)", flexShrink: 0 }}>
        <button style={tabStyle("npc")} onClick={() => { setTab("npc"); setOpenConvIdx(null); }}>👥 NPC</button>
        <button style={tabStyle("mess")} onClick={() => { setTab("mess"); setOpenConvIdx(null); }}>💬 Mess</button>
        <button style={tabStyle("assets")} onClick={() => { setTab("assets"); setOpenConvIdx(null); }}>💎 Tài Sản</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: openConvIdx !== null ? "hidden" : "auto", padding: openConvIdx !== null ? "0" : "16px", position: "relative" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(167,139,250,0.5)" }}>
            <Loader2 size={24} style={{ margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 13, fontStyle: "italic" }}>AI đang tạo dữ liệu điện thoại...</p>
          </div>
        )}
        {error && <p style={{ color: "#fca5a5", textAlign: "center", padding: "40px 0", fontSize: 13 }}>{error}</p>}

        {data && tab === "npc" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 10, color: "rgba(167,139,250,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 4 }}>
              Nhân vật phụ liên quan đến {character.name}
            </p>
            {data.npcs.map((npc, i) => {
              const avatarSrc = npcAvatars[npc.name] || null;
              return (
                <div key={i} style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(108,92,231,0.12)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  {/* Avatar with upload button */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: avatarSrc ? "transparent" : "linear-gradient(135deg,#1a0a3e,#4c1d95)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, border: "1.5px solid rgba(108,92,231,0.35)", overflow: "hidden" }}>
                      {avatarSrc ? <img src={avatarSrc} alt={npc.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : npc.emoji}
                    </div>
                    <button onClick={() => npcFileRefs.current[npc.name]?.click()}
                      style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: "50%", border: "1.5px solid #0a0a0f", background: "#6c5ce7", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                      <Camera size={10} />
                    </button>
                    <input ref={el => { npcFileRefs.current[npc.name] = el; }} type="file" accept="image/*"
                      onChange={e => handleNpcAvatar(npc.name, e)} style={{ display: "none" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{npc.name}</p>
                    <p style={{ fontSize: 11, color: "#a78bfa", marginBottom: 4 }}>{npc.role}</p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{npc.relation}</p>
                  </div>
                </div>
              );
            })}
            <p style={{ fontSize: 10, color: "rgba(167,139,250,0.25)", textAlign: "center", paddingTop: 4 }}>
              Nhấn icon 📷 để đặt ảnh đại diện cho từng NPC
            </p>
          </div>
        )}

        {data && tab === "mess" && openConvIdx === null && (
          /* ── INBOX LIST ── */
          <div style={{ display: "flex", flexDirection: "column" }}>
            <p style={{ fontSize: 10, color: "rgba(167,139,250,0.35)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 12, paddingLeft: 2 }}>
              {data.messages.length} cuộc trò chuyện
            </p>
            {data.messages.map((conv, i) => {
              const lastMsg = conv.chat[conv.chat.length - 1];
              const npcAvatarSrc = npcAvatars[conv.between] || null;
              const isLastChar = lastMsg?.from === character.name;
              return (
                <div key={i} onClick={() => setOpenConvIdx(i)}
                  style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 2px", borderBottom: i < data.messages.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", cursor: "pointer", transition: "background 0.15s", borderRadius: 10 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(108,92,231,0.08)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                  {/* NPC avatar */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 50, height: 50, borderRadius: "50%", background: npcAvatarSrc ? "transparent" : "linear-gradient(135deg,#1a0a3e,#4c1d95)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, overflow: "hidden", border: "2px solid rgba(108,92,231,0.35)", boxShadow: "0 0 10px rgba(108,92,231,0.25)" }}>
                      {npcAvatarSrc ? <img src={npcAvatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (conv.chat.find(m => m.from === conv.between)?.emoji || "👤")}
                    </div>
                    {/* char avatar inset */}
                    <div style={{ position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: "50%", background: charAvatarUrl ? "transparent" : "linear-gradient(135deg,#6c5ce7,#a78bfa)", overflow: "hidden", border: "2px solid #0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                      {charAvatarUrl ? <img src={charAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : character.avatar}
                    </div>
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{character.name} & {conv.between}</p>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", flexShrink: 0, marginLeft: 8 }}>{lastMsg?.time || ""}</p>
                    </div>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontStyle: "italic" }}>
                      {isLastChar ? `${character.name}: ` : `${conv.between}: `}{lastMsg?.content?.slice(0, 45) || ""}
                    </p>
                  </div>
                  <span style={{ fontSize: 14, color: "rgba(108,92,231,0.4)", flexShrink: 0 }}>›</span>
                </div>
              );
            })}
          </div>
        )}

        {data && tab === "mess" && openConvIdx !== null && (() => {
          const conv = data.messages[openConvIdx];
          return (
            /* ── FULL-SCREEN CONVERSATION ── */
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#07050f,#0e0b1e)", display: "flex", flexDirection: "column", zIndex: 10 }}>
              {/* Conv header */}
              <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(108,92,231,0.15)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, background: "rgba(14,10,28,0.9)", backdropFilter: "blur(16px)" }}>
                <button onClick={() => setOpenConvIdx(null)}
                  style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <ChevronLeft size={15} />
                </button>
                {/* NPC avatar */}
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: npcAvatars[conv.between] ? "transparent" : "linear-gradient(135deg,#1a0a3e,#4c1d95)", overflow: "hidden", border: "1.5px solid rgba(108,92,231,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                  {npcAvatars[conv.between] ? <img src={npcAvatars[conv.between]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (conv.chat.find(m => m.from === conv.between)?.emoji || "👤")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{character.name} & {conv.between}</p>
                  <p style={{ fontSize: 10, color: "rgba(167,139,250,0.45)" }}>Mô phỏng · {conv.chat.length} tin nhắn</p>
                </div>
              </div>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {conv.chat.map((msg, j) => {
                  const isChar = msg.from === character.name;
                  const msgAvatarSrc = isChar ? charAvatarUrl : (npcAvatars[msg.from] || null);
                  return (
                    <div key={j} style={{ display: "flex", justifyContent: isChar ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
                      {!isChar && (
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: msgAvatarSrc ? "transparent" : "rgba(108,92,231,0.15)", border: "1.5px solid rgba(108,92,231,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, overflow: "hidden", boxShadow: "0 0 8px rgba(108,92,231,0.2)" }}>
                          {msgAvatarSrc ? <img src={msgAvatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : msg.emoji}
                        </div>
                      )}
                      <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: isChar ? "flex-end" : "flex-start" }}>
                        <div style={{ padding: "9px 13px", borderRadius: isChar ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: isChar ? "linear-gradient(135deg,rgba(108,92,231,0.55),rgba(124,58,237,0.45))" : "rgba(22,18,40,0.85)", backdropFilter: isChar ? "none" : "blur(12px)", border: `1px solid ${isChar ? "rgba(108,92,231,0.5)" : "rgba(255,255,255,0.07)"}`, fontSize: 13, lineHeight: 1.55, color: "#fff", boxShadow: isChar ? "0 2px 10px rgba(108,92,231,0.3)" : "0 2px 8px rgba(0,0,0,0.3)", wordBreak: "break-word" }}>
                          {msg.content}
                        </div>
                        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", marginTop: 3, paddingInline: 4 }}>{msg.time}</p>
                      </div>
                      {isChar && (
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: msgAvatarSrc ? "transparent" : "linear-gradient(135deg,#6c5ce7,#a78bfa)", border: "1.5px solid rgba(108,92,231,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, overflow: "hidden", boxShadow: "0 0 8px rgba(108,92,231,0.25)" }}>
                          {msgAvatarSrc ? <img src={msgAvatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : character.avatar}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {data && tab === "assets" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 10, color: "rgba(167,139,250,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 4 }}>
              Tài sản của {character.name}
            </p>
            <div style={{ padding: "20px", borderRadius: 16, background: "linear-gradient(135deg,rgba(16,185,129,0.08),rgba(5,150,105,0.04))", border: "1px solid rgba(16,185,129,0.2)", textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "rgba(52,211,153,0.6)", marginBottom: 8, letterSpacing: "0.1em" }}>💰 SỐ TIỀN HIỆN CÓ</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#34d399" }}>{data.assets.cash}</p>
            </div>
            <p style={{ fontSize: 10, color: "rgba(167,139,250,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginTop: 6 }}>🏠 Bất Động Sản</p>
            {data.assets.properties.map((prop, i) => (
              <div key={i} style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(108,92,231,0.12)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>🏛️</span>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{prop}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   C. GIFT MODAL
═══════════════════════════════════════════════════ */
function GiftModal({ gifts, charName, onClose }: { gifts: GiftItem[]; charName: string; onClose: () => void }) {
  const fmt = (ts: number) => new Date(ts).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, backdropFilter: "blur(10px)" }} onClick={onClose}>
      <div style={{ background: "linear-gradient(180deg,#1c1a2e,#0f0d1a)", border: "1px solid rgba(108,92,231,0.25)", borderTopLeftRadius: 28, borderTopRightRadius: 28, width: "100%", maxWidth: 480, maxHeight: "80dvh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(108,92,231,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800 }}>🎁 Quà nhận được</h2>
            <p style={{ fontSize: 11, color: "rgba(167,139,250,0.5)", marginTop: 2 }}>Từ {charName} · {gifts.length} vật phẩm</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
          {gifts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 0" }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>🎁</p>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }}>Chưa nhận được quà nào</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>Tiếp tục trò chuyện — có thể {charName} sẽ tặng điều gì đó...</p>
            </div>
          ) : (
            [...gifts].reverse().map(g => (
              <div key={g.id} style={{ padding: "16px", borderRadius: 16, background: "linear-gradient(135deg,rgba(108,92,231,0.1),rgba(76,29,149,0.05))", border: "1px solid rgba(108,92,231,0.2)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(108,92,231,0.15)", border: "1px solid rgba(108,92,231,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                  {g.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{g.name}</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, marginBottom: 6 }}>{g.description}</p>
                  <p style={{ fontSize: 11, color: "#a78bfa", fontStyle: "italic" }}>{g.howSent}</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>{fmt(g.timestamp)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   D. MEMORY MODAL — Khắc ghi Ký ức
═══════════════════════════════════════════════════ */
function MemoryModal({ uid, charId, charName, onClose }: {
  uid: string; charId: string; charName: string; onClose: () => void;
}) {
  const [memories, setMemories] = useState<string[]>(() => loadMemories(uid, charId));
  const [input, setInput]       = useState("");
  const used = memories.length;
  const full = used >= MEMORY_MAX;

  const addMemory = () => {
    const txt = input.trim();
    if (!txt || full) return;
    const next = [...memories, txt];
    setMemories(next);
    saveMemories(uid, charId, next);
    setInput("");
  };

  const deleteMemory = (i: number) => {
    const next = memories.filter((_, idx) => idx !== i);
    setMemories(next);
    saveMemories(uid, charId, next);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, backdropFilter: "blur(14px)" }} onClick={onClose}>
      <div style={{ background: "linear-gradient(180deg,#1c1a2e,#0f0d1a)", border: "1px solid rgba(108,92,231,0.28)", borderTopLeftRadius: 28, borderTopRightRadius: 28, width: "100%", maxWidth: 480, maxHeight: "88dvh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid rgba(108,92,231,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800 }}>🧿 Khắc ghi Ký ức</h2>
            <p style={{ fontSize: 11, color: "rgba(167,139,250,0.5)", marginTop: 2 }}>{charName} · <span style={{ color: full ? "#f87171" : "#34d399", fontWeight: 700 }}>Đã dùng: {used}/{MEMORY_MAX}</span></p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>

        {/* Info panel glassmorphism */}
        <div style={{ margin: "14px 16px 0", borderRadius: 16, border: "1px solid rgba(108,92,231,0.22)", background: "rgba(108,92,231,0.06)", backdropFilter: "blur(8px)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🔮</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#c4b5fd", marginBottom: 2 }}>Ký ức là gì?</p>
              <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.55 }}>Những sự kiện cốt lõi, lời hứa, bí mật mà <strong>{charName}</strong> sẽ không bao giờ được phép quên.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 2 }}>Sức mạnh</p>
              <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.55 }}>Ký ức có <strong>quyền năng tối cao</strong> — ghi đè phản hồi ngẫu nhiên của AI, đảm bảo nhất quán 100%.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#34d399", marginBottom: 2 }}>Mẹo</p>
              <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.55 }}>Dùng câu khẳng định chắc chắn. Ví dụ: <em style={{ color: "rgba(196,181,253,0.8)" }}>{`"${charName} và {user} đã hôn nhau lần đầu dưới mưa."`}</em></p>
            </div>
          </div>
        </div>

        {/* Memory list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {memories.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <p style={{ fontSize: 28, marginBottom: 10 }}>🧿</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Chưa có ký ức nào được khắc ghi</p>
            </div>
          )}
          {memories.map((mem, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 13, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(108,92,231,0.14)" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(108,92,231,0.15)", border: "1px solid rgba(108,92,231,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#a78bfa", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
              <p style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.55, minWidth: 0 }}>{mem}</p>
              <button onClick={() => deleteMemory(i)} style={{ background: "none", border: "none", color: "rgba(239,68,68,0.45)", cursor: "pointer", padding: "2px 4px", fontSize: 14, flexShrink: 0, display: "flex", alignItems: "center" }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Input bar */}
        <div style={{ padding: "12px 16px 20px", borderTop: "1px solid rgba(108,92,231,0.12)", flexShrink: 0 }}>
          {full && (
            <p style={{ fontSize: 11, color: "#f87171", textAlign: "center", marginBottom: 8 }}>
              Đã đạt giới hạn 20 ký ức. Xóa ký ức cũ để thêm mới.
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addMemory(); } }}
              disabled={full}
              placeholder={full ? "Đã đầy — xóa ký ức cũ để tiếp tục" : "Nhập ký ức cần khắc ghi..."}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: `1px solid ${full ? "rgba(239,68,68,0.2)" : "rgba(108,92,231,0.3)"}`, background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", opacity: full ? 0.5 : 1 }}
            />
            <button onClick={addMemory} disabled={full || !input.trim()}
              style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: full || !input.trim() ? "rgba(108,92,231,0.2)" : "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: full || !input.trim() ? "rgba(255,255,255,0.3)" : "#fff", fontSize: 13, fontWeight: 700, cursor: full || !input.trim() ? "not-allowed" : "pointer", flexShrink: 0 }}>
              Khắc ghi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLUS MENU
═══════════════════════════════════════════════════ */
function PlusMenu({ onPhone, onGift, onFavorites, onMemory, giftCount, memoryCount, onClose, safeMode, onToggleSafeMode, modelName }: {
  onPhone: () => void; onGift: () => void; onFavorites: () => void; onMemory: () => void;
  giftCount: number; memoryCount: number; onClose: () => void;
  safeMode: boolean; onToggleSafeMode: () => void; modelName: string;
}) {
  /* ── Feature button: deep glass card ── */
  const btn = (icon: React.ReactNode, label: string, badge: number, onClick: () => void, color: string) => (
    <button onClick={() => { onClick(); onClose(); }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
        padding: "13px 10px 11px",
        borderRadius: 20,
        /* Premium gradient glass stroke */
        background: "linear-gradient(rgba(255,255,255,0.045),rgba(255,255,255,0.015)) padding-box, linear-gradient(135deg,rgba(255,255,255,0.18) 0%,rgba(108,92,231,0.18) 50%,rgba(255,255,255,0.06) 100%) border-box",
        border: "1px solid transparent",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        cursor: "pointer", position: "relative", flex: 1,
        boxShadow: `0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 0 ${color}`,
        transition: "transform 0.12s, box-shadow 0.12s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 14px ${color}28`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 0 ${color}`; }}>
      <div style={{
        width: 42, height: 42, borderRadius: 13,
        background: `linear-gradient(135deg,${color}22,${color}10)`,
        border: `1px solid ${color}35`,
        display: "flex", alignItems: "center", justifyContent: "center", color,
        boxShadow: `0 0 16px ${color}28, 0 0 5px ${color}18`,
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(210,205,230,0.85)", letterSpacing: "0.02em" }}>{label}</span>
      {badge > 0 && (
        <div style={{ position: "absolute", top: 9, right: 9, width: 17, height: 17, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 8px rgba(239,68,68,0.7)" }}>{badge}</div>
      )}
    </button>
  );

  const is18 = !safeMode; /* 18+ mode active when safeMode is OFF */

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250 }} onClick={onClose}>
      <div style={{ position: "absolute", bottom: 76, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 28px)", maxWidth: 448 }} onClick={e => e.stopPropagation()}>
        <div style={{
          background: "rgba(12,9,24,0.82)",
          border: "1px solid rgba(108,92,231,0.18)",
          borderRadius: 26,
          padding: "14px 14px 16px",
          backdropFilter: "blur(36px)", WebkitBackdropFilter: "blur(36px)",
          boxShadow: "0 -12px 50px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)",
          display: "flex", flexDirection: "column", gap: 10,
        }}>

          {/* ── Top meta row: 18+ toggle + Model pill (single compact row) ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

            {/* 18+ mini toggle */}
            <div onClick={onToggleSafeMode}
              style={{
                flex: 1, display: "flex", alignItems: "center", gap: 9,
                padding: "8px 11px",
                borderRadius: 12,
                border: `1px solid ${is18 ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.07)"}`,
                background: is18 ? "rgba(220,38,38,0.08)" : "rgba(255,255,255,0.03)",
                boxShadow: is18 ? "0 0 12px rgba(239,68,68,0.18), inset 0 0 8px rgba(220,38,38,0.06)" : "none",
                cursor: "pointer", transition: "all 0.2s",
              }}>
              <div style={{ color: is18 ? "#f87171" : "rgba(167,139,250,0.45)", flexShrink: 0, transition: "color 0.2s" }}>
                {is18 ? <ShieldOff size={13} /> : <Shield size={13} />}
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: is18 ? "#f87171" : "rgba(200,195,220,0.45)", flex: 1, transition: "color 0.2s" }}>
                {is18 ? "🔞 18+ Bật" : "🔒 An toàn"}
              </span>
              {/* Minimalist neon switch */}
              <div style={{
                width: 32, height: 18, borderRadius: 9,
                background: is18 ? "rgba(220,38,38,0.7)" : "rgba(80,80,100,0.35)",
                border: `1px solid ${is18 ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.1)"}`,
                boxShadow: is18 ? "0 0 8px rgba(239,68,68,0.6), 0 0 16px rgba(220,38,38,0.25)" : "none",
                position: "relative", transition: "all 0.22s", flexShrink: 0,
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: is18 ? "#fff" : "rgba(255,255,255,0.5)",
                  position: "absolute", top: 2,
                  left: is18 ? 16 : 2,
                  transition: "left 0.22s",
                  boxShadow: is18 ? "0 0 4px rgba(239,68,68,0.8)" : "none",
                }} />
              </div>
            </div>

            {/* Model pill */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 11px",
              borderRadius: 12,
              border: "1px solid rgba(52,211,153,0.2)",
              background: "rgba(52,211,153,0.04)",
              maxWidth: 140, overflow: "hidden",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px rgba(52,211,153,0.8)", flexShrink: 0 }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#34d399", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{modelName}</span>
            </div>

          </div>

          {/* ── Feature buttons ── */}
          <div>
            <p style={{ fontSize: 9.5, color: "rgba(167,139,250,0.3)", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, marginBottom: 9, textAlign: "center" }}>Tính năng</p>
            <div style={{ display: "flex", gap: 7 }}>
              {btn(<Phone size={17} />, "Điện thoại", 0, onPhone, "#6c5ce7")}
              {btn(<Gift size={17} />, "Quà tặng", giftCount, onGift, "#f59e0b")}
              {btn(<span style={{ fontSize: 18 }}>🧿</span>, "Ký ức", memoryCount, onMemory, "#a855f7")}
              {btn(<Heart size={17} />, "Yêu thích", 0, onFavorites, "#ec4899")}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes plusMenuIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1);    }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN CHAT PAGE
═══════════════════════════════════════════════════ */
interface Props { character: Character; onBack: () => void; onEdit?: (char: Character) => void; }

export default function ChatPage({ character, onBack, onEdit }: Props) {
  const { user } = useAuth();
  const { keys, selectedModel, loading: keysLoading } = useKeys();
  const [safeMode, setSafeMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("kismet_safeMode");
      return saved !== null ? saved === "true" : true;
    } catch { return true; }
  });

  /* Quyền chủ sở hữu — createdBy stores uid, check both uid and email */
  const isOwner = !!user && (
    user.uid === character.createdBy ||
    user.email === character.createdBy ||
    user.email === ADMIN_EMAIL ||
    user.uid === ADMIN_EMAIL
  );

  /* ── Memories — load & live-sync ── */
  const [memories, setMemories] = useState<string[]>([]);
  useEffect(() => {
    if (!user) return;
    setMemories(loadMemories(user.uid, character.id));
  }, [user?.uid, character.id]);

  const { messages, loading, sending, statusText, error, send, deleteMessage, regenerate, clearHistory } =
    useChat(character, keys, selectedModel as GeminiModel, safeMode, memories);

  /* Persist safeMode to localStorage whenever it changes */
  useEffect(() => {
    try { localStorage.setItem("kismet_safeMode", String(safeMode)); } catch {}
  }, [safeMode]);

  const email = user?.email || user?.uid || "";

  /* ── state ── */
  const [input, setInput] = useState("");
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [quickContext, setQuickContext] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCharProfile, setShowCharProfile] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);

  /* avatars */
  const [charAvatarUrl, setCharAvatarUrl] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

  /* user profile (for modal) */
  const [profile, setProfile] = useState<UserProfile>({ gender: "", personality: "", bio: "", appearance: "" });
  const [profileDraft, setProfileDraft] = useState<UserProfile>({ gender: "", personality: "", bio: "", appearance: "" });
  const [userAvatarDraft, setUserAvatarDraft] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  /* gifts */
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [newGiftCount, setNewGiftCount] = useState(0);
  const [giftNotif, setGiftNotif] = useState<GiftItem | null>(null);
  const lastMsgIdRef = useRef<string | null>(null);

  /* refs */
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const charFileRef = useRef<HTMLInputElement>(null);
  const userFileRef = useRef<HTMLInputElement>(null);

  /* ── load initial data ── */
  useEffect(() => {
    if (!user) return;
    setCharAvatarUrl(getCharAvatarUrl(character));
    setUserAvatarUrl(loadUserAvatar(email));
    setUserAvatarDraft(loadUserAvatar(email));
    const p = loadProfile(user.uid);
    setProfile(p); setProfileDraft(p);
    const g = loadGifts(user.uid, character.id);
    setGifts(g);
  }, [user?.uid, character.id, email]);

  /* ── auto scroll ── */
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  /* ── gift trigger: 20% chance after AI response ── */
  useEffect(() => {
    if (!user || !keys.length || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    if (last.id === lastMsgIdRef.current) return;
    lastMsgIdRef.current = last.id;

    // 20% random chance
    if (Math.random() > 0.20) return;

    const apiKey = keys[0];
    const giftPrompt = `Bạn là ${character.name}. ${character.personality}
Bạn muốn tặng một món quà bí ẩn và ý nghĩa cho người bạn đang trò chuyện.
Hãy mô tả món quà theo phong cách nhân vật của bạn.
Trả về JSON hợp lệ (KHÔNG thêm text khác):
{"name":"Tên vật phẩm","emoji":"emoji phù hợp","description":"Mô tả vật phẩm (2-3 câu)","howSent":"Cách bạn gửi quà (1-2 câu, theo phong cách nhân vật)"}`;

    geminiJSON<Omit<GiftItem, "id" | "timestamp">>(apiKey, selectedModel, giftPrompt)
      .then(raw => {
        const gift: GiftItem = { ...raw, id: `gift_${Date.now()}`, timestamp: Date.now() };
        const updated = [...gifts, gift];
        setGifts(updated);
        saveGifts(user.uid, character.id, updated);
        setGiftNotif(gift);
        setNewGiftCount(n => n + 1);
        setTimeout(() => setGiftNotif(null), 6000);
      })
      .catch(() => {});
  }, [messages]);

  /* ── handlers ── */
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    send(text, quickContext.trim() || undefined);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input, sending, send, quickContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCharAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const { updateCharacterAvatar } = await import("@/lib/firebase");
      const b64 = await updateCharacterAvatar(character.id, file);
      localStorage.setItem(`kismet_char_avatar_${character.id}`, b64);
      setCharAvatarUrl(b64);
    } catch {
      /* Fallback: compress locally and cache */
      const { compressImageToBase64 } = await import("@/lib/firebase");
      const b64 = await compressImageToBase64(file);
      if (b64) {
        localStorage.setItem(`kismet_char_avatar_${character.id}`, b64);
        setCharAvatarUrl(b64);
      }
    }
    e.target.value = "";
  };

  const handleUserAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const b64 = await readFileAsBase64(file); setUserAvatarDraft(b64);
    e.target.value = "";
  };

  const handleProfileSave = () => {
    if (!user) return;
    saveProfile(user.uid, profileDraft);
    setProfile(profileDraft);
    if (userAvatarDraft !== userAvatarUrl) {
      if (userAvatarDraft) { saveUserAvatar(email, userAvatarDraft); setUserAvatarUrl(userAvatarDraft); }
      else { localStorage.removeItem(`avatar_${email}`); setUserAvatarUrl(null); }
    }
    setProfileSaved(true);
    setTimeout(() => { setProfileSaved(false); setShowProfile(false); }, 1200);
  };

  const handleClearHistory = async () => { await clearHistory(); setShowClearConfirm(false); };

  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  /* ── render ── */
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "linear-gradient(160deg,#07050f 0%,#0e0b1e 50%,#080616 100%)", color: "#fff", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>

      {/* ══ COMPACT HEADER ══ */}
      <div style={{ background: "rgba(14,10,28,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(108,92,231,0.18)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <ArrowLeft size={16} />
        </button>

        {/* Clickable char avatar → open profile */}
        <button onClick={() => setShowCharProfile(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, position: "relative" }}>
          <CharAvatar src={charAvatarUrl} emoji={character.avatar} size={42} />
          <div style={{ position: "absolute", bottom: -1, right: -1, width: 14, height: 14, borderRadius: "50%", background: "#22c55e", border: "2px solid #0f0d1a" }} />
        </button>

        {/* Clickable name → open profile */}
        <button onClick={() => setShowCharProfile(true)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{character.name}</p>
          <p style={{ fontSize: 10, color: "rgba(167,139,250,0.5)", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>"{character.slogan}"</p>
        </button>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {/* Camera button — only for character owner/admin */}
          {isOwner && (
            <button onClick={() => charFileRef.current?.click()} title="Thay ảnh nhân vật" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.04)", color: "rgba(167,139,250,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Camera size={14} />
            </button>
          )}
          <button onClick={() => setShowClearConfirm(true)} title="Xoá lịch sử" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.04)", color: "rgba(167,139,250,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Trash2 size={14} />
          </button>
        </div>
        <input ref={charFileRef} type="file" accept="image/*" onChange={handleCharAvatarChange} style={{ display: "none" }} />
      </div>

      {/* ══ MESSAGES ══ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 6px", display: "flex", flexDirection: "column", gap: 8 }}>
        {(loading || keysLoading) && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(167,139,250,0.5)" }}>
            <Loader2 style={{ width: 22, height: 22, margin: "0 auto 8px", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 13 }}>Đang tải lịch sử...</p>
          </div>
        )}

        {!loading && !keysLoading && messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <CharAvatar src={charAvatarUrl} emoji={character.avatar} size={72} />
            </div>
            <p style={{ fontSize: 15, color: "#a78bfa", fontWeight: 700, marginBottom: 4 }}>{character.name}</p>
            <p style={{ fontSize: 12, color: "rgba(167,139,250,0.45)", fontStyle: "italic", maxWidth: 240, margin: "0 auto 16px" }}>"{character.slogan}"</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>Gõ tin nhắn để bắt đầu cuộc hội thoại</p>
          </div>
        )}

        {messages.map(msg => {
          const isUser = msg.role === "user";
          const isHovered = hoveredMsgId === msg.id;
          return (
            <div
              key={msg.id}
              style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}
              onMouseEnter={() => setHoveredMsgId(msg.id)}
              onMouseLeave={() => setHoveredMsgId(null)}
              onTouchStart={() => setHoveredMsgId(msg.id)}
            >
              {isUser
                ? <button onClick={() => { setProfileDraft(profile); setUserAvatarDraft(userAvatarUrl); setShowProfile(true); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}><UserAvatar src={userAvatarUrl} size={32} /></button>
                : <button onClick={() => setShowCharProfile(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}><CharAvatar src={charAvatarUrl} emoji={character.avatar} size={32} /></button>
              }
              <div style={{ maxWidth: "90%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
                <div style={{ padding: "10px 14px", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isUser ? "linear-gradient(135deg,#7c3aed,#6c5ce7)" : "rgba(22,18,40,0.82)", backdropFilter: isUser ? "none" : "blur(14px)", WebkitBackdropFilter: isUser ? "none" : "blur(14px)", fontSize: 14, lineHeight: 1.7, boxShadow: isUser ? "0 4px 12px rgba(108,92,231,0.35)" : "0 2px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)", border: isUser ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.07)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {isUser ? msg.content : renderNovel(msg.content)}
                </div>
                {/* Timestamp + action buttons row */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, paddingInline: 4, flexDirection: isUser ? "row-reverse" : "row" }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>{fmt(msg.timestamp)}</span>
                  {/* Delete button — always visible but faint */}
                  <button
                    onClick={() => deleteMessage(msg.id)}
                    title="Xóa tin nhắn"
                    style={{ background: "none", border: "none", padding: "1px 3px", cursor: "pointer", display: "flex", alignItems: "center", opacity: isHovered ? 0.75 : 0.2, transition: "opacity 0.2s", color: "#f87171" }}
                  >
                    <Trash2 size={11} />
                  </button>
                  {/* Regenerate — only for char (assistant) messages */}
                  {!isUser && (
                    <button
                      onClick={() => regenerate(msg.id)}
                      title="Tạo lại phản hồi"
                      disabled={sending}
                      style={{ background: "none", border: "none", padding: "1px 3px", cursor: sending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", opacity: isHovered ? 0.75 : 0.2, transition: "opacity 0.2s", color: "#a78bfa" }}
                    >
                      <span style={{ fontSize: 12 }}>↻</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {sending && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <CharAvatar src={charAvatarUrl} emoji={character.avatar} size={32} />
            <div style={{ padding: "10px 16px", borderRadius: "18px 18px 18px 4px", background: "rgba(28,26,44,0.98)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={14} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 13, color: "rgba(167,139,250,0.7)", fontStyle: "italic" }}>{statusText || "Đang soạn..."}</span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ margin: "4px 8px", padding: "10px 14px", borderRadius: 12, background: "rgba(108,92,231,0.08)", border: "1px solid rgba(108,92,231,0.2)", color: "rgba(167,139,250,0.7)", fontSize: 12, display: "flex", alignItems: "flex-start", gap: 6 }}>
            <span style={{ flexShrink: 0 }}>✦</span><span>Không thể gửi tin. Vui lòng thử lại.</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ══ GIFT NOTIFICATION TOAST ══ */}
      {giftNotif && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 420, zIndex: 240, animation: "slideUp 0.4s ease" }}>
          <div style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(217,119,6,0.1))", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 18, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center", backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{giftNotif.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 2 }}>🎁 {character.name} vừa gửi quà!</p>
              <p style={{ fontSize: 13, color: "#fff", fontWeight: 600, marginBottom: 2 }}>{giftNotif.name}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>{giftNotif.howSent}</p>
            </div>
            <button onClick={() => setGiftNotif(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", flexShrink: 0 }}><X size={14} /></button>
          </div>
        </div>
      )}

      {/* ══ QUICK CONTEXT STRIP ══ */}
      <div style={{ background: "rgba(10,8,20,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", padding: "6px 14px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(108,92,231,0.15)", background: "rgba(108,92,231,0.05)" }}>
          <MapPin size={11} style={{ color: "rgba(167,139,250,0.4)", flexShrink: 0 }} />
          <input
            value={quickContext}
            onChange={e => setQuickContext(e.target.value)}
            placeholder="Bối cảnh hiện tại... (vd: Trong phòng ngủ tối, Bên bờ suối)"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "rgba(255,255,255,0.65)", fontSize: 11.5, fontFamily: "inherit", placeholder: "rgba(167,139,250,0.3)" }}
          />
          {quickContext && (
            <button onClick={() => setQuickContext("")} style={{ background: "none", border: "none", color: "rgba(167,139,250,0.35)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ══ INPUT BAR ══ */}
      <div style={{ borderTop: "1px solid rgba(108,92,231,0.18)", background: "rgba(10,8,20,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", padding: "10px 14px", display: "flex", alignItems: "flex-end", gap: 8, flexShrink: 0, boxShadow: "0 -4px 24px rgba(0,0,0,0.4)" }}>
        {/* + button */}
        <button
          onClick={() => setShowPlusMenu(v => !v)}
          style={{ width: 42, height: 42, borderRadius: 13, border: `1px solid ${showPlusMenu ? "rgba(108,92,231,0.6)" : "rgba(108,92,231,0.25)"}`, background: showPlusMenu ? "rgba(108,92,231,0.2)" : "rgba(108,92,231,0.08)", color: showPlusMenu ? "#a78bfa" : "rgba(108,92,231,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: 22, fontWeight: 300, transition: "all 0.2s", transform: showPlusMenu ? "rotate(45deg)" : "none" }}
        >
          <Plus size={20} />
        </button>

        <textarea
          ref={inputRef} value={input}
          onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
          onKeyDown={handleKeyDown}
          placeholder="Nhắn tin cho linh hồn..."
          enterKeyHint="enter"
          rows={1} disabled={sending}
          style={{ flex: 1, resize: "none", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(108,92,231,0.25)", borderRadius: 14, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", lineHeight: 1.5, maxHeight: 120, overflow: "auto", fontFamily: "inherit", transition: "border-color 0.2s" }}
          onFocus={e => { e.target.style.borderColor = "rgba(108,92,231,0.6)"; }}
          onBlur={e => { e.target.style.borderColor = "rgba(108,92,231,0.25)"; }}
        />

        <button
          onClick={handleSend} disabled={sending || !input.trim()}
          style={{ width: 42, height: 42, borderRadius: 13, border: "none", background: sending || !input.trim() ? "rgba(108,92,231,0.2)" : "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: sending || !input.trim() ? "rgba(255,255,255,0.25)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: sending || !input.trim() ? "not-allowed" : "pointer", flexShrink: 0, boxShadow: sending || !input.trim() ? "none" : "0 4px 12px rgba(108,92,231,0.4)", transition: "all 0.2s" }}
        >
          <Send size={17} />
        </button>
      </div>

      {/* ══ PLUS MENU OVERLAY ══ */}
      {showPlusMenu && (
        <PlusMenu
          onPhone={() => setShowPhone(true)}
          onGift={() => { setShowGift(true); setNewGiftCount(0); }}
          onFavorites={() => { setShowGift(true); setNewGiftCount(0); }}
          onMemory={() => setShowMemory(true)}
          giftCount={newGiftCount}
          memoryCount={memories.length}
          onClose={() => setShowPlusMenu(false)}
          safeMode={safeMode}
          onToggleSafeMode={() => setSafeMode(v => !v)}
          modelName={selectedModel}
        />
      )}

      {/* ══ MEMORY MODAL ══ */}
      {showMemory && user && (
        <MemoryModal
          uid={user.uid}
          charId={character.id}
          charName={character.name}
          onClose={() => {
            /* Sync updated memories back into state so AI picks them up immediately */
            setMemories(loadMemories(user.uid, character.id));
            setShowMemory(false);
          }}
        />
      )}

      {/* ══ CLEAR CONFIRM ══ */}
      {showClearConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24, backdropFilter: "blur(6px)" }} onClick={() => setShowClearConfirm(false)}>
          <div style={{ background: "#1a1825", border: "1px solid rgba(108,92,231,0.3)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 320, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Xóa cuộc trò chuyện?</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>Toàn bộ tin nhắn bạn đã chat với {character.name} sẽ bị xóa.</p>
            <p style={{ fontSize: 12, color: "rgba(167,139,250,0.55)", marginBottom: 24 }}>✦ Tin chào hỏi đầu tiên của {character.name} sẽ được giữ lại.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowClearConfirm(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 14, cursor: "pointer" }}>Huỷ</button>
              <button onClick={handleClearHistory} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#dc2626,#b91c1c)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Xóa hết</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ USER PROFILE MODAL ══ */}
      {showProfile && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, backdropFilter: "blur(10px)" }} onClick={() => setShowProfile(false)}>
          <div style={{ background: "linear-gradient(180deg,#1c1a2e,#13101f)", border: "1px solid rgba(108,92,231,0.25)", borderTopLeftRadius: 24, borderTopRightRadius: 24, width: "100%", maxWidth: 480, maxHeight: "92dvh", overflowY: "auto", padding: "24px 24px 32px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Hồ sơ của bạn</h2>
                <p style={{ fontSize: 11, color: "rgba(167,139,250,0.5)", marginTop: 2 }}>AI sẽ dùng thông tin này để nhập vai phù hợp hơn</p>
              </div>
              <button onClick={() => setShowProfile(false)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
            </div>

            {/* User avatar upload */}
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <UserAvatar src={userAvatarDraft} size={82} />
                <button onClick={() => userFileRef.current?.click()} style={{ position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: "50%", border: "2px solid #13101f", background: "#6c5ce7", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                  <Camera size={12} />
                </button>
              </div>
              <input ref={userFileRef} type="file" accept="image/*" onChange={handleUserAvatarChange} style={{ display: "none" }} />
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>Nhấn 📷 để chọn ảnh đại diện</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Giới tính */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.8)", display: "block", marginBottom: 8 }}>Giới tính</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["Nữ", "Nam", "Khác"].map(g => (
                    <button key={g} onClick={() => setProfileDraft(p => ({ ...p, gender: g }))} style={{ flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer", border: `1px solid ${profileDraft.gender === g ? "rgba(108,92,231,0.7)" : "rgba(255,255,255,0.08)"}`, background: profileDraft.gender === g ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.04)", color: profileDraft.gender === g ? "#c4b5fd" : "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: profileDraft.gender === g ? 700 : 400, transition: "all 0.15s" }}>{g}</button>
                  ))}
                </div>
              </div>
              {[
                { key: "personality" as const, label: "Tính cách", placeholder: "Ví dụ: U ám, tinh nghịch..." },
                { key: "bio" as const, label: "Thông tin bản thân", placeholder: "Nghề nghiệp, sở thích..." },
                { key: "appearance" as const, label: "Ngoại hình", placeholder: "Màu tóc, chiều cao..." },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.8)", display: "block", marginBottom: 8 }}>{label}</label>
                  <textarea value={profileDraft[key]} onChange={e => setProfileDraft(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: 12, outline: "none", border: "1px solid rgba(108,92,231,0.2)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 13, resize: "none", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.5 }} onFocus={e => { e.target.style.borderColor = "rgba(108,92,231,0.6)"; }} onBlur={e => { e.target.style.borderColor = "rgba(108,92,231,0.2)"; }} />
                </div>
              ))}
            </div>

            <button onClick={handleProfileSave} style={{ marginTop: 20, width: "100%", padding: "13px 0", borderRadius: 14, border: "none", background: profileSaved ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "background 0.3s" }}>
              {profileSaved ? "✓ Đã lưu hồ sơ!" : "Lưu hồ sơ"}
            </button>
          </div>
        </div>
      )}

      {/* ══ CHARACTER PROFILE MODAL ══ */}
      {showCharProfile && <CharProfileModal character={character} charAvatarUrl={charAvatarUrl} isOwner={isOwner} onClose={() => setShowCharProfile(false)} onEdit={onEdit ? () => onEdit(character) : undefined} />}

      {/* ══ PHONE MODAL ══ */}
      {showPhone && <PhoneModal character={character} charAvatarUrl={charAvatarUrl} keys={keys} model={selectedModel} onClose={() => setShowPhone(false)} />}

      {/* ══ GIFT MODAL ══ */}
      {showGift && <GiftModal gifts={gifts} charName={character.name} onClose={() => setShowGift(false)} />}

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        @keyframes slideUp { from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
        textarea::placeholder, input::placeholder { color:rgba(255,255,255,0.2); }
        *::-webkit-scrollbar{width:4px}*::-webkit-scrollbar-track{background:transparent}*::-webkit-scrollbar-thumb{background:rgba(108,92,231,0.3);border-radius:4px}
      `}</style>
    </div>
  );
}
