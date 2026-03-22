import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft, Send, Trash2, X, Loader2, Camera, Plus,
  Phone, Gift, Heart, ChevronLeft, Shield, ShieldOff, CheckCircle2, MapPin
} from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useKeys } from "@/hooks/useKeys";
import { useAuth } from "@/contexts/AuthContext";
import { geminiRaw } from "@/lib/gemini";
import type { Character, GeminiModel } from "@/lib/types";

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
const loadCharAvatar = (id: string) => localStorage.getItem(`kismet_char_avatar_${id}`);
const saveCharAvatar = (id: string, b64: string) => localStorage.setItem(`kismet_char_avatar_${id}`, b64);
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
function CharAvatar({ src, emoji, size }: { src: string | null; emoji: string; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: src ? "transparent" : "linear-gradient(135deg,#1a0a3e,#6c5ce7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.48, flexShrink: 0, border: `${size > 40 ? 2 : 1.5}px solid rgba(108,92,231,0.45)`, overflow: "hidden", boxShadow: size > 40 ? "0 0 20px rgba(108,92,231,0.3)" : "none" }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : emoji}
    </div>
  );
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
function CharProfileModal({ character, charAvatarUrl, onClose }: { character: Character; charAvatarUrl: string | null; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, backdropFilter: "blur(12px)" }} onClick={onClose}>
      <div style={{ background: "linear-gradient(180deg,#1c1a2e,#0f0d1a)", border: "1px solid rgba(108,92,231,0.25)", borderTopLeftRadius: 28, borderTopRightRadius: 28, width: "100%", maxWidth: 480, maxHeight: "88dvh", overflowY: "auto", paddingBottom: 40 }} onClick={e => e.stopPropagation()}>
        {/* Header: avatar + name + close — no empty banner */}
        <div style={{ padding: "22px 20px 16px", display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid rgba(108,92,231,0.12)" }}>
          <CharAvatar src={charAvatarUrl} emoji={character.avatar} size={68} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 3, lineHeight: 1.2 }}>{character.name}</h2>
            <p style={{ fontSize: 12, color: "#a78bfa", fontStyle: "italic", lineHeight: 1.4 }}>"{character.slogan}"</p>
            {character.isPublic && (
              <span style={{ display: "inline-block", marginTop: 6, fontSize: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399", borderRadius: 20, padding: "1px 8px", fontWeight: 600 }}>✦ Công khai</span>
            )}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        {/* Info sections */}
        <div style={{ padding: "18px 20px 0" }}>
          {[
            { label: "✦ Bối cảnh & Tính cách", value: character.personality },
            { label: "⚡ Lời nguyền", value: character.curse },
          ].map(({ label, value }) => (
            <div key={label} style={{ marginBottom: 14, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(108,92,231,0.1)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(167,139,250,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{label}</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.65 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
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
        <button style={tabStyle("npc")} onClick={() => setTab("npc")}>👥 NPC</button>
        <button style={tabStyle("mess")} onClick={() => setTab("mess")}>💬 Mess</button>
        <button style={tabStyle("assets")} onClick={() => setTab("assets")}>💎 Tài Sản</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
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
            {data.npcs.map((npc, i) => (
              <div key={i} style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(108,92,231,0.12)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#1a0a3e,#4c1d95)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, border: "1.5px solid rgba(108,92,231,0.3)" }}>
                  {npc.emoji}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{npc.name}</p>
                  <p style={{ fontSize: 11, color: "#a78bfa", marginBottom: 4 }}>{npc.role}</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{npc.relation}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {data && tab === "mess" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <p style={{ fontSize: 10, color: "rgba(167,139,250,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 4 }}>
              Tin nhắn mô phỏng
            </p>
            {data.messages.map((conv, i) => (
              <div key={i} style={{ borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(108,92,231,0.1)", overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(108,92,231,0.08)", background: "rgba(108,92,231,0.07)", fontSize: 12, fontWeight: 700, color: "#c4b5fd" }}>
                  💬 {character.name} & {conv.between}
                </div>
                <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {conv.chat.map((msg, j) => {
                    const isChar = msg.from === character.name;
                    return (
                      <div key={j} style={{ display: "flex", justifyContent: isChar ? "flex-end" : "flex-start", gap: 6, alignItems: "flex-end" }}>
                        {!isChar && <span style={{ fontSize: 20 }}>{msg.emoji}</span>}
                        <div>
                          <div style={{ padding: "8px 12px", borderRadius: isChar ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: isChar ? "rgba(108,92,231,0.35)" : "rgba(255,255,255,0.07)", border: `1px solid ${isChar ? "rgba(108,92,231,0.4)" : "rgba(255,255,255,0.06)"}`, fontSize: 12, lineHeight: 1.5, maxWidth: 220 }}>
                            {msg.content}
                          </div>
                          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 3, textAlign: isChar ? "right" : "left", paddingInline: 4 }}>{msg.time}</p>
                        </div>
                        {isChar && <span style={{ fontSize: 20 }}>{msg.emoji}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

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
   PLUS MENU
═══════════════════════════════════════════════════ */
function PlusMenu({ onPhone, onGift, onFavorites, giftCount, onClose, safeMode, onToggleSafeMode, modelName }: {
  onPhone: () => void; onGift: () => void; onFavorites: () => void; giftCount: number; onClose: () => void;
  safeMode: boolean; onToggleSafeMode: () => void; modelName: string;
}) {
  const btn = (icon: React.ReactNode, label: string, badge: number, onClick: () => void, color: string) => (
    <button onClick={() => { onClick(); onClose(); }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 16px", borderRadius: 16, border: `1px solid ${color}20`, background: `${color}10`, cursor: "pointer", position: "relative", minWidth: 68, flex: 1 }}>
      <div style={{ width: 42, height: 42, borderRadius: 13, background: `${color}20`, border: `1px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
        {icon}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{label}</span>
      {badge > 0 && <div style={{ position: "absolute", top: 10, right: 10, width: 18, height: 18, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</div>}
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250 }} onClick={onClose}>
      <div style={{ position: "absolute", bottom: 76, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 448 }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "rgba(20,18,34,0.98)", border: "1px solid rgba(108,92,231,0.25)", borderRadius: 20, padding: "16px 16px 18px", backdropFilter: "blur(20px)", boxShadow: "0 -8px 32px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ── 1. Toggle 18+ ── */}
          <div
            onClick={onToggleSafeMode}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: `1px solid ${safeMode ? "rgba(108,92,231,0.2)" : "rgba(239,68,68,0.3)"}`, background: safeMode ? "rgba(108,92,231,0.07)" : "rgba(239,68,68,0.08)", cursor: "pointer" }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 11, background: safeMode ? "rgba(108,92,231,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${safeMode ? "rgba(108,92,231,0.3)" : "rgba(239,68,68,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", color: safeMode ? "#a78bfa" : "#f87171", flexShrink: 0 }}>
              {safeMode ? <Shield size={17} /> : <ShieldOff size={17} />}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 1 }}>
                {safeMode ? "🔒 Lọc nội dung nhạy cảm" : "🔞 Chế độ 18+ (Không kiểm duyệt)"}
              </p>
              <p style={{ fontSize: 11, color: safeMode ? "rgba(167,139,250,0.5)" : "rgba(248,113,113,0.6)" }}>
                {safeMode ? "Bật — Nội dung an toàn" : "Tắt — Nhân vật phản hồi tự do"}
              </p>
            </div>
            {/* Toggle pill */}
            <div style={{ width: 44, height: 26, borderRadius: 13, background: safeMode ? "rgba(108,92,231,0.3)" : "#dc2626", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: safeMode ? 3 : 21, transition: "left 0.2s" }} />
            </div>
          </div>

          {/* ── 2. Model status ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, border: "1px solid rgba(52,211,153,0.2)", background: "rgba(52,211,153,0.05)" }}>
            <CheckCircle2 size={16} style={{ color: "#34d399", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: "rgba(167,139,250,0.45)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Model đang dùng</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#34d399", marginTop: 1 }}>{modelName}</p>
            </div>
          </div>

          {/* ── 3. Feature buttons ── */}
          <div>
            <p style={{ fontSize: 10, color: "rgba(167,139,250,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 10, textAlign: "center" }}>Tính năng</p>
            <div style={{ display: "flex", gap: 10 }}>
              {btn(<Phone size={19} />, "Điện thoại", 0, onPhone, "#6c5ce7")}
              {btn(<Gift size={19} />, "Quà tặng", giftCount, onGift, "#f59e0b")}
              {btn(<Heart size={19} />, "Yêu thích", 0, onFavorites, "#ec4899")}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN CHAT PAGE
═══════════════════════════════════════════════════ */
interface Props { character: Character; onBack: () => void; }

export default function ChatPage({ character, onBack }: Props) {
  const { user } = useAuth();
  const { keys, selectedModel, loading: keysLoading } = useKeys();
  const [safeMode, setSafeMode] = useState(true);
  const { messages, loading, sending, statusText, error, send, clearHistory } =
    useChat(character, keys, selectedModel as GeminiModel, safeMode);

  const email = user?.email || user?.uid || "";

  /* ── state ── */
  const [input, setInput] = useState("");
  const [quickContext, setQuickContext] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCharProfile, setShowCharProfile] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showGift, setShowGift] = useState(false);
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
    setCharAvatarUrl(loadCharAvatar(character.id));
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCharAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const b64 = await readFileAsBase64(file);
    saveCharAvatar(character.id, b64); setCharAvatarUrl(b64);
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
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#0a0a0f", color: "#fff", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>

      {/* ══ COMPACT HEADER ══ */}
      <div style={{ background: "linear-gradient(180deg,#13101f,#0f0d1a)", borderBottom: "1px solid rgba(108,92,231,0.18)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
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
          {/* Camera button to upload char avatar */}
          <button onClick={() => charFileRef.current?.click()} title="Thay ảnh nhân vật" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.04)", color: "rgba(167,139,250,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Camera size={14} />
          </button>
          <button onClick={() => setShowClearConfirm(true)} title="Xoá lịch sử" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.04)", color: "rgba(167,139,250,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Trash2 size={14} />
          </button>
        </div>
        <input ref={charFileRef} type="file" accept="image/*" onChange={handleCharAvatarChange} style={{ display: "none" }} />
      </div>

      {/* ══ MESSAGES ══ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
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
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
              {isUser
                ? <button onClick={() => { setProfileDraft(profile); setUserAvatarDraft(userAvatarUrl); setShowProfile(true); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}><UserAvatar src={userAvatarUrl} size={32} /></button>
                : <button onClick={() => setShowCharProfile(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}><CharAvatar src={charAvatarUrl} emoji={character.avatar} size={32} /></button>
              }
              <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
                <div style={{ padding: "10px 14px", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isUser ? "linear-gradient(135deg,#7c3aed,#6c5ce7)" : "rgba(28,26,44,0.98)", fontSize: 14, lineHeight: 1.7, boxShadow: isUser ? "0 4px 12px rgba(108,92,231,0.35)" : "0 2px 8px rgba(0,0,0,0.4)", border: isUser ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.06)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {isUser ? msg.content : renderNovel(msg.content)}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", marginTop: 4, paddingInline: 4 }}>{fmt(msg.timestamp)}</div>
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
      <div style={{ background: "#0f0d1a", padding: "6px 14px 0", flexShrink: 0 }}>
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
      <div style={{ borderTop: "1px solid rgba(108,92,231,0.15)", background: "#0f0d1a", padding: "10px 14px", display: "flex", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
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
          giftCount={newGiftCount}
          onClose={() => setShowPlusMenu(false)}
          safeMode={safeMode}
          onToggleSafeMode={() => setSafeMode(v => !v)}
          modelName={selectedModel}
        />
      )}

      {/* ══ CLEAR CONFIRM ══ */}
      {showClearConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24, backdropFilter: "blur(6px)" }} onClick={() => setShowClearConfirm(false)}>
          <div style={{ background: "#1a1825", border: "1px solid rgba(108,92,231,0.3)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 320, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Xoá lịch sử chat?</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 24 }}>Toàn bộ tin nhắn với {character.name} sẽ bị xoá vĩnh viễn.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowClearConfirm(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 14, cursor: "pointer" }}>Huỷ</button>
              <button onClick={handleClearHistory} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#dc2626,#b91c1c)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Xoá tất cả</button>
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
      {showCharProfile && <CharProfileModal character={character} charAvatarUrl={charAvatarUrl} onClose={() => setShowCharProfile(false)} />}

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
