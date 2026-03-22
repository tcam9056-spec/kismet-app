import { useState, useEffect, useRef, useCallback } from "react";
import {
  Settings, Plus, Loader2, Globe, MessageCircle, User,
  Pencil, Search, CheckCircle, XCircle, Clock, Wand2, X
} from "lucide-react";
import { decodeCharacter } from "./CharacterProfile";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useCharacters } from "@/hooks/useCharacters";
import type { Character } from "@/lib/types";
import CharacterProfile from "./CharacterProfile";
import { fetchCreatorDisplayNames, fetchCreatorRoles, invalidateProfileCache } from "@/hooks/useUserProfile";
import { UserBadge } from "@/components/UserBadge";
import type { UserRole } from "@/components/UserBadge";

type Tab = "all" | "messages" | "profile";

interface Props {
  onChat: (character: Character) => void;
  onSettings: () => void;
  onAddCharacter: () => void;
  onViewUser: (uid: string) => void;
}

/* ── helpers ── */
const loadUserAvatar = (email: string) => localStorage.getItem(`avatar_${email}`);
const saveUserAvatar = (email: string, b64: string) => localStorage.setItem(`avatar_${email}`, b64);
function readFileAsBase64(file: File): Promise<string> {
  return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(file); });
}

/* ── CharAvatar — avatar can be URL or emoji ── */
function CharAvatar({ avatar, size }: { avatar: string; size: number }) {
  const isUrl = avatar.startsWith("http");
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: isUrl ? "transparent" : "linear-gradient(135deg,#1a0a3e,#6c5ce7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.48, flexShrink: 0, border: "2px solid rgba(108,92,231,0.35)", overflow: "hidden", boxShadow: "0 0 20px rgba(108,92,231,0.2)" }}>
      {isUrl ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : avatar}
    </div>
  );
}
function UserAvatar({ src, size }: { src: string | null; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: src ? "transparent" : "rgba(108,92,231,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.45, border: "2px solid rgba(108,92,231,0.35)", overflow: "hidden" }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
    </div>
  );
}

/* ══════════════════════════════════════════════
   ADMIN PANEL — approve / reject pending chars
══════════════════════════════════════════════ */
function AdminPanel({ onClose }: { onClose: () => void }) {
  const { pending, approveCharacter, rejectCharacter, loading } = useCharacters();

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 500, display: "flex", flexDirection: "column" }} onClick={onClose}>
      <div style={{ background: "linear-gradient(180deg,#1c1a2e,#0f0d1a)", borderBottom: "1px solid rgba(108,92,231,0.2)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <XCircle size={16} />
        </button>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Quản lý Nhân Vật</h2>
          <p style={{ fontSize: 11, color: "rgba(167,139,250,0.5)" }}>Duyệt bài từ cộng đồng · Admin Only</p>
        </div>
        {pending.length > 0 && (
          <div style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 10px" }}>
            {pending.length} chờ duyệt
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 32px", maxWidth: 480, width: "100%", margin: "0 auto" }} onClick={e => e.stopPropagation()}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Loader2 size={22} style={{ color: "#a78bfa", animation: "spin 1s linear infinite", margin: "0 auto" }} />
          </div>
        ) : pending.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>✅</p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>Không có nhân vật nào chờ duyệt</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(167,139,250,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Chờ duyệt · {pending.length} nhân vật
            </p>
            {pending.map(char => (
              <div key={char.id} style={{ borderRadius: 18, border: "1px solid rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.05)", overflow: "hidden" }}>
                <div style={{ display: "flex", gap: 14, padding: "14px 16px", alignItems: "flex-start" }}>
                  <CharAvatar avatar={char.avatar} size={52} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{char.name}</p>
                      <span style={{ fontSize: 10, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24", borderRadius: 20, padding: "1px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={9} /> Chờ duyệt
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "rgba(167,139,250,0.6)", fontStyle: "italic", marginBottom: 6 }}>"{char.slogan}"</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                      {char.personality.slice(0, 100)}...
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", borderTop: "1px solid rgba(108,92,231,0.1)", gap: 1 }}>
                  <button onClick={() => rejectCharacter(char.id)}
                    style={{ flex: 1, padding: "11px 0", background: "rgba(239,68,68,0.08)", border: "none", color: "rgba(239,68,68,0.7)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderBottomLeftRadius: 18 }}>
                    <XCircle size={14} /> Từ chối
                  </button>
                  <div style={{ width: 1, background: "rgba(108,92,231,0.1)" }} />
                  <button onClick={() => approveCharacter(char.id)}
                    style={{ flex: 1, padding: "11px 0", background: "rgba(34,197,94,0.08)", border: "none", color: "#22c55e", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderBottomRightRadius: 18 }}>
                    <CheckCircle size={14} /> Duyệt
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   IMPORT MODAL — paste code to summon character
══════════════════════════════════════════════ */
function ImportModal({ onClose, onImported, onChat }: {
  onClose: () => void;
  onImported: (name: string) => void;
  onChat?: (char: import("@/lib/types").Character) => void;
}) {
  const { addCharacter } = useCharacters();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok">("idle");
  const [msg, setMsg] = useState("");

  const doImport = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const decoded = decodeCharacter(trimmed);
    if (!decoded) {
      setMsg("❌ Mã không hợp lệ. Vui lòng thử lại.");
      return;
    }
    setStatus("loading"); setMsg("");
    try {
      const charId = await addCharacter({ ...decoded, isPublic: false, isApproved: true });
      const fullChar: import("@/lib/types").Character = {
        ...decoded, id: charId, createdBy: user?.email || user?.uid || "",
      };
      setStatus("ok");
      setMsg(`✨ Linh hồn ${decoded.name} đã được triệu hồi! Đang vào phòng chat...`);
      setTimeout(() => {
        onImported(decoded.name);
        onClose();
        if (onChat) onChat(fullChar);
      }, 1200);
    } catch {
      setStatus("idle");
      setMsg("❌ Không thể triệu hồi. Vui lòng thử lại.");
    }
  }, [addCharacter, user, onImported, onClose, onChat]);

  const busy = status === "loading" || status === "ok";

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(2,1,14,0.93)", backdropFilter: "blur(22px)", animation: "fadeIn 0.18s ease" }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(420px, 96vw)", borderRadius: 24, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(212,175,55,0.10) inset", animation: "slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)", background: "linear-gradient(160deg,#16102a,#0c0820)", display: "flex", flexDirection: "column", padding: "24px 22px 22px" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 3 }}>✦ Triệu Hồi Bằng Mã</h2>
            <p style={{ fontSize: 10, color: "rgba(167,139,250,0.45)", lineHeight: 1.4 }}>Dán mã chuỗi để triệu hồi nhân vật</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <X size={12} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,transparent,rgba(108,92,231,0.25))" }} />
          <span style={{ fontSize: 9, color: "rgba(167,139,250,0.3)", fontWeight: 700, letterSpacing: "0.08em" }}>DÁN MÃ</span>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(108,92,231,0.25),transparent)" }} />
        </div>

        {/* Textarea */}
        <textarea
          value={code}
          onChange={e => { setCode(e.target.value); if (status !== "loading" && status !== "ok") setMsg(""); }}
          placeholder="Dán mã nhân vật vào đây..."
          rows={5}
          style={{ padding: "11px 13px", borderRadius: 12, border: "1px solid rgba(108,92,231,0.22)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 11.5, outline: "none", fontFamily: "monospace", resize: "none", boxSizing: "border-box", lineHeight: 1.6, width: "100%", transition: "border-color 0.2s" }}
          onFocus={e => { e.target.style.borderColor = "rgba(108,92,231,0.5)"; }}
          onBlur={e => { e.target.style.borderColor = "rgba(108,92,231,0.22)"; }}
          autoFocus
        />

        {/* Status message */}
        <div style={{ minHeight: 20, marginTop: 8 }}>
          {msg && (
            <p style={{ fontSize: 11, color: status === "ok" || msg.startsWith("🔗") || msg.startsWith("✓") ? "#34d399" : "rgba(255,255,255,0.55)", lineHeight: 1.4, textAlign: "center" }}>
              {msg}
            </p>
          )}
        </div>

        {/* Import button */}
        <button
          onClick={() => doImport(code)}
          disabled={!code.trim() || busy}
          style={{ width: "100%", padding: "12px 0", marginTop: 4, borderRadius: 12, border: "none", background: status === "ok" ? "rgba(52,211,153,0.2)" : "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: !code.trim() || busy ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: busy ? "none" : "0 4px 16px rgba(108,92,231,0.38)", transition: "all 0.2s", opacity: !code.trim() ? 0.5 : 1 }}>
          {status === "loading" ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Đang triệu hồi...</>
            : status === "ok" ? "✦ Thành công!"
            : <><Wand2 size={13} /> Triệu hồi nhân vật</>}
        </button>
      </div>

      <style>{`
        @keyframes fadeIn  { from{opacity:0}                                        to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(28px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes spin    { from{transform:rotate(0deg)}                           to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════
   TAB: ALL — Forum/Feed style character cards
══════════════════════════════════════════════ */
function AllTab({ onChat, onAddCharacter, onViewUser }: { onChat: (c: Character) => void; onAddCharacter: () => void; onViewUser: (uid: string) => void }) {
  const { characters, loading } = useCharacters();
  const { user } = useAuth();
  /* Use uid as primary identifier so isOwner check in CharacterProfile works correctly */
  const viewerEmail = user?.uid || user?.email || "";
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [query, setQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [creatorNames, setCreatorNames] = useState<Map<string, string>>(new Map());
  const [creatorRoles, setCreatorRoles] = useState<Map<string, UserRole>>(new Map());
  const handleImported = useCallback((name: string) => { setShowImport(false); }, []);

  /* Fetch creator display names + roles whenever characters change */
  useEffect(() => {
    if (characters.length === 0) return;
    const uids = characters.map(c => c.createdBy).filter(Boolean);
    Promise.all([
      fetchCreatorDisplayNames(uids),
      fetchCreatorRoles(uids),
    ]).then(([names, roles]) => {
      setCreatorNames(names);
      setCreatorRoles(roles);
    });
  }, [characters]);

  const filtered = query.trim()
    ? characters.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : characters;

  /* Separate public (approved) and private */
  const publicChars = filtered.filter(c => c.isPublic && c.isApproved !== false);
  const privateChars = filtered.filter(c => !c.isPublic);

  return (
    <div style={{ padding: "16px 14px 0" }}>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(167,139,250,0.4)" }} />
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm nhân vật..."
          style={{ width: "100%", padding: "10px 14px 10px 34px", borderRadius: 12, border: "1px solid rgba(108,92,231,0.18)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          onFocus={e => (e.target.style.borderColor = "rgba(108,92,231,0.5)")} onBlur={e => (e.target.style.borderColor = "rgba(108,92,231,0.18)")} />
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", gap: 10 }}>
          <Loader2 size={22} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: 13, color: "rgba(167,139,250,0.4)", fontStyle: "italic" }}>Đang triệu hồi nhân vật...</p>
        </div>
      ) : (
        <div>
          {/* ── PUBLIC FORUM FEED ── */}
          {publicChars.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(167,139,250,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12, paddingLeft: 2 }}>
                ✦ Cộng đồng · {publicChars.length} nhân vật
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {publicChars.map(char => (
                  <ForumCard key={char.id} char={char} onChat={() => onChat(char)} onProfile={() => setSelectedChar(char)}
                    creatorRole={creatorRoles.get(char.createdBy)} />
                ))}
              </div>
            </div>
          )}

          {/* ── PRIVATE CHARS ── */}
          {privateChars.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(167,139,250,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12, paddingLeft: 2 }}>
                🔒 Nhân vật riêng tư của bạn
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {privateChars.map(char => (
                  <div key={char.id} onClick={() => onChat(char)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(108,92,231,0.12)", background: "rgba(255,255,255,0.02)", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(108,92,231,0.06)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}>
                    <button style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }} onClick={e => { e.stopPropagation(); setSelectedChar(char); }}>
                      <CharAvatar avatar={char.avatar} size={44} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{char.name}</p>
                      <p style={{ fontSize: 11, color: "rgba(167,139,250,0.5)", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>"{char.slogan}"</p>
                    </div>
                    <span style={{ fontSize: 16, color: "rgba(108,92,231,0.4)" }}>›</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ADD NEW + IMPORT ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            <button onClick={onAddCharacter}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "1px dashed rgba(108,92,231,0.22)", background: "transparent", cursor: "pointer", width: "100%", transition: "all 0.15s", color: "#fff" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(108,92,231,0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", border: "1.5px dashed rgba(108,92,231,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Plus size={18} style={{ color: "rgba(108,92,231,0.5)" }} />
              </div>
              <div style={{ textAlign: "left" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(167,139,250,0.5)" }}>Tạo nhân vật mới</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>Nhân vật công khai cần Admin duyệt</p>
              </div>
            </button>

            <button onClick={() => setShowImport(true)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "1px dashed rgba(212,175,55,0.25)", background: "transparent", cursor: "pointer", width: "100%", transition: "all 0.15s", color: "#fff" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,175,55,0.05)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", border: "1.5px dashed rgba(212,175,55,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Wand2 size={18} style={{ color: "rgba(212,175,55,0.6)" }} />
              </div>
              <div style={{ textAlign: "left" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(212,175,55,0.6)" }}>Triệu hồi bằng mã</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>Dán mã QR từ bạn bè để thêm nhân vật</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {selectedChar && (
        <CharacterProfile
          character={selectedChar}
          onClose={() => setSelectedChar(null)}
          onChat={() => { onChat(selectedChar); setSelectedChar(null); }}
          viewerEmail={viewerEmail}
          creatorName={creatorNames.get(selectedChar.createdBy) || selectedChar.createdBy?.slice(0, 8) || "KISMET"}
          onViewCreator={selectedChar.createdBy ? () => { setSelectedChar(null); onViewUser(selectedChar.createdBy); } : undefined}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={handleImported}
          onChat={char => { onChat(char); }}
        />
      )}
    </div>
  );
}

/* ── Forum card component ── */
function ForumCard({ char, onChat, onProfile, creatorRole }: { char: Character; onChat: () => void; onProfile: () => void; creatorRole?: UserRole }) {
  const isUrl = char.avatar.startsWith("http");
  return (
    <div style={{ borderRadius: 22, border: "1px solid rgba(108,92,231,0.22)", background: "rgba(20,17,40,0.72)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", overflow: "hidden", transition: "border-color 0.2s, box-shadow 0.2s", boxShadow: "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "rgba(108,92,231,0.5)"; el.style.boxShadow = "0 8px 32px rgba(108,92,231,0.18), inset 0 1px 0 rgba(255,255,255,0.06)"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "rgba(108,92,231,0.22)"; el.style.boxShadow = "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)"; }}>
      {/* Card body */}
      <div style={{ padding: "18px 18px 14px", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <button onClick={onProfile} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
          <div style={{ width: 68, height: 68, borderRadius: 18, background: isUrl ? "transparent" : "linear-gradient(135deg,#1a0a3e,#6c5ce7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, overflow: "hidden", border: "2px solid rgba(108,92,231,0.35)", boxShadow: "0 4px 16px rgba(108,92,231,0.3)" }}>
            {isUrl ? <img src={char.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : char.avatar}
          </div>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>{char.name}</h3>
              {creatorRole && <UserBadge role={creatorRole} size="sm" />}
            </div>
            <span style={{ fontSize: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399", borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap", flexShrink: 0, fontWeight: 600 }}>
              ✦ Công khai
            </span>
          </div>
          <p style={{ fontSize: 12, color: "#a78bfa", fontStyle: "italic", lineHeight: 1.5, marginBottom: 8 }}>
            "{char.slogan}"
          </p>
          {char.tags && char.tags.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
              {char.tags.slice(0, 4).map(tag => (
                <span key={tag} style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 12,
                  background: tag.includes("18+") || tag === "Bạo lực" ? "rgba(239,68,68,0.1)" : "rgba(108,92,231,0.1)",
                  border: `1px solid ${tag.includes("18+") || tag === "Bạo lực" ? "rgba(239,68,68,0.25)" : "rgba(108,92,231,0.25)"}`,
                  color: tag.includes("18+") || tag === "Bạo lực" ? "#f87171" : "rgba(167,139,250,0.7)",
                  fontWeight: 500,
                  boxShadow: tag.includes("18+") || tag === "Bạo lực" ? "0 0 6px rgba(239,68,68,0.2)" : "0 0 6px rgba(108,92,231,0.2)",
                }}>
                  {tag}
                </span>
              ))}
            </div>
          ) : char.curse ? (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>{char.curse}</p>
          ) : null}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(108,92,231,0.1)", margin: "0 18px" }} />

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, padding: "12px 18px" }}>
        <button onClick={onProfile}
          style={{ flex: 0, padding: "8px 14px", borderRadius: 12, border: "1px solid rgba(108,92,231,0.25)", background: "rgba(108,92,231,0.08)", color: "#a78bfa", fontSize: 12, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
          Xem hồ sơ
        </button>
        <button onClick={onChat}
          style={{ flex: 1, padding: "8px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(108,92,231,0.3)" }}>
          Chat ngay →
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   TAB: MESSAGES — Smartphone Inbox Style
══════════════════════════════════════════════ */
function MessagesTab({ onChat }: { onChat: (c: Character) => void }) {
  const { user } = useAuth();
  const { characters, loading } = useCharacters();

  interface RecentChat { char: Character; lastMsg: string; lastTime: number; unread: boolean; }
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
        const unread = last.role === "assistant";
        recentChats.push({ char, lastMsg: last.content, lastTime: last.timestamp, unread });
      } catch {}
    }
    recentChats.sort((a, b) => b.lastTime - a.lastTime);
  }

  const fmt = (ts: number) => {
    const d = new Date(ts); const now = new Date();
    if (d.toDateString() === now.toDateString())
      return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    const diff = Math.floor((Date.now() - ts) / 86400000);
    if (diff < 7) return ["CN","T2","T3","T4","T5","T6","T7"][d.getDay()];
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
      <Loader2 size={22} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (recentChats.length === 0) return (
    <div style={{ textAlign: "center", padding: "70px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 16, filter: "drop-shadow(0 0 16px rgba(108,92,231,0.4))" }}>💬</div>
      <p style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Chưa có tin nhắn nào</p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>Vào "Tất cả" để bắt đầu cuộc trò chuyện</p>
    </div>
  );

  return (
    <div style={{ padding: "0 0 16px" }}>
      {/* Inbox header */}
      <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Tin Nhắn</p>
          <p style={{ fontSize: 11, color: "rgba(167,139,250,0.45)", marginTop: 1 }}>{recentChats.length} cuộc trò chuyện</p>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(108,92,231,0.12)", border: "1px solid rgba(108,92,231,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
          💬
        </div>
      </div>

      {/* Inbox list */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {recentChats.map(({ char, lastMsg, lastTime, unread }, idx) => {
          const isUrl = char.avatar.startsWith("http") || char.avatar.startsWith("data:");
          return (
            <div
              key={char.id}
              onClick={() => onChat(char)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "13px 18px",
                borderBottom: idx < recentChats.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                cursor: "pointer",
                transition: "background 0.15s",
                background: "transparent",
                position: "relative",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(108,92,231,0.07)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              {/* Avatar with online indicator */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{
                  width: 54, height: 54, borderRadius: "50%",
                  background: isUrl ? "transparent" : "linear-gradient(135deg,#1a0a3e,#6c5ce7)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26, overflow: "hidden",
                  border: unread ? "2px solid rgba(167,139,250,0.7)" : "2px solid rgba(108,92,231,0.25)",
                  boxShadow: unread ? "0 0 14px rgba(108,92,231,0.35)" : "none",
                }}>
                  {isUrl
                    ? <img src={char.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : char.avatar}
                </div>
                {/* Online dot */}
                <div style={{
                  position: "absolute", bottom: 2, right: 2,
                  width: 13, height: 13, borderRadius: "50%",
                  background: "#22c55e",
                  border: "2px solid #0a0a0f",
                  boxShadow: "0 0 6px rgba(34,197,94,0.6)",
                }} />
              </div>

              {/* Text content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <p style={{ fontSize: 15, fontWeight: unread ? 800 : 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }}>
                    {char.name}
                  </p>
                  <p style={{ fontSize: 11, color: unread ? "rgba(167,139,250,0.8)" : "rgba(255,255,255,0.22)", flexShrink: 0, fontWeight: unread ? 600 : 400 }}>
                    {fmt(lastTime)}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p style={{
                    flex: 1, fontSize: 13,
                    color: unread ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.28)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    fontStyle: "italic",
                    fontWeight: unread ? 500 : 400,
                  }}>
                    {lastMsg.length > 58 ? lastMsg.slice(0, 58) + "…" : lastMsg}
                  </p>
                  {unread && (
                    <div style={{
                      width: 9, height: 9, borderRadius: "50%",
                      background: "#a78bfa", flexShrink: 0,
                      boxShadow: "0 0 6px rgba(167,139,250,0.7)",
                    }} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   TAB: PROFILE
══════════════════════════════════════════════ */
interface ProfileData { gender: string; personality: string; bio: string; appearance: string; displayName: string; socialLinks?: { label: string; url: string }[]; avatarDataUrl?: string; }

function ProfileTab({ onSettings, onAddCharacter, onViewMyPage }: { onSettings: () => void; onAddCharacter: () => void; onViewMyPage?: () => void }) {
  const { user, logout } = useAuth();
  const { pending, isAdmin } = useCharacters();
  const email = user?.email || user?.uid || "";
  const fileRef = useRef<HTMLInputElement>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileData>({ gender: "", personality: "", bio: "", appearance: "", displayName: "", socialLinks: [] });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
          setDraft(d);
          localStorage.setItem(`kismet_profile_${user.uid}`, JSON.stringify(d));
          /* Sync avatar from Firestore → localStorage. Firestore is the source of truth. */
          if (d.avatarDataUrl) {
            saveUserAvatar(email, d.avatarDataUrl);
            setAvatarUrl(d.avatarDataUrl);
            setAvatarDraft(d.avatarDataUrl);
          }
        } else {
          const raw = localStorage.getItem(`kismet_profile_${user.uid}`);
          if (raw) {
            const parsed = JSON.parse(raw) as ProfileData;
            setDraft(parsed);
            if (parsed.avatarDataUrl && !ua) {
              saveUserAvatar(email, parsed.avatarDataUrl);
              setAvatarUrl(parsed.avatarDataUrl);
              setAvatarDraft(parsed.avatarDataUrl);
            }
          }
        }
      } catch {
        const raw = localStorage.getItem(`kismet_profile_${user.uid}`);
        if (raw) setDraft(JSON.parse(raw));
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
      /* Determine final avatar — never erase an existing one */
      const finalAvatar = avatarDraft || avatarUrl;
      if (finalAvatar && finalAvatar !== avatarUrl) {
        saveUserAvatar(email, finalAvatar);
        setAvatarUrl(finalAvatar);
      }
      const ref = doc(db, "users", user.uid, "profile", "data");
      const saveData: ProfileData = { ...draft };
      if (finalAvatar) saveData.avatarDataUrl = finalAvatar;
      await setDoc(ref, { ...saveData, updatedAt: serverTimestamp() }, { merge: true });
      localStorage.setItem(`kismet_profile_${user.uid}`, JSON.stringify(saveData));
      invalidateProfileCache(user.uid);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      const saveData: ProfileData = { ...draft };
      const finalAvatar = avatarDraft || avatarUrl;
      if (finalAvatar) saveData.avatarDataUrl = finalAvatar;
      localStorage.setItem(`kismet_profile_${user.uid}`, JSON.stringify(saveData));
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

  const iStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 12, outline: "none",
    border: "1px solid rgba(108,92,231,0.2)", background: "rgba(255,255,255,0.05)",
    color: "#fff", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "20px 16px 32px" }}>
      {/* Admin banner */}
      {isAdmin && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 14, background: "linear-gradient(135deg,rgba(212,175,55,0.1),rgba(180,120,10,0.08))", border: "1px solid rgba(212,175,55,0.3)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>👑</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#d4af37" }}>Admin KISMET</p>
            <p style={{ fontSize: 11, color: "rgba(212,175,55,0.6)" }}>{email}</p>
          </div>
          <button onClick={() => setShowAdmin(true)}
            style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(212,175,55,0.4)", background: "rgba(212,175,55,0.1)", color: "#d4af37", fontSize: 12, fontWeight: 700, cursor: "pointer", position: "relative" }}>
            Duyệt Char
            {pending.length > 0 && (
              <span style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {pending.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Avatar */}
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <UserAvatar src={avatarDraft} size={88} />
          <button onClick={() => fileRef.current?.click()}
            style={{ position: "absolute", bottom: 4, right: 4, width: 28, height: 28, borderRadius: "50%", border: "2px solid #0a0a0f", background: "#6c5ce7", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
            <Pencil size={11} />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
        <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginTop: 10, marginBottom: 2 }}>
          {draft.displayName || email.split("@")[0]}
        </p>
        <p style={{ fontSize: 11, color: "rgba(167,139,250,0.4)", marginBottom: 6 }}>{email}</p>
        {/* Role badge — always show one */}
        <div style={{ marginBottom: 8 }}>
          <UserBadge
            role={
              isAdmin ? "admin"
              : ((draft as ProfileData & { role?: string }).role as UserRole) || "hanhkhach"
            }
            size="md"
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 20, background: "rgba(108,92,231,0.1)", border: "1px solid rgba(108,92,231,0.2)" }}>
            <span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 600 }}>✦ Hồ sơ lưu cloud · Đồng bộ đa thiết bị</span>
          </div>
          {onViewMyPage && (
            <button onClick={onViewMyPage} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 12px", borderRadius: 20, background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "#d4af37", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
              ✦ Xem trang cá nhân
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Display name */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.7)", display: "block", marginBottom: 7 }}>Tên hiển thị</label>
          <input type="text" value={draft.displayName} onChange={e => setDraft(p => ({ ...p, displayName: e.target.value }))} placeholder="Tên trong roleplay..." style={iStyle}
            onFocus={e => (e.target.style.borderColor = "rgba(108,92,231,0.6)")} onBlur={e => (e.target.style.borderColor = "rgba(108,92,231,0.2)")} />
        </div>

        {/* Giới tính */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.7)", display: "block", marginBottom: 7 }}>Giới tính</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["Nữ", "Nam", "Khác"].map(g => (
              <button key={g} onClick={() => setDraft(p => ({ ...p, gender: g }))}
                style={{ flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer", border: `1px solid ${draft.gender === g ? "rgba(108,92,231,0.7)" : "rgba(255,255,255,0.08)"}`, background: draft.gender === g ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.04)", color: draft.gender === g ? "#c4b5fd" : "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: draft.gender === g ? 700 : 400, transition: "all 0.15s" }}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {[
          { key: "personality" as const, label: "Tính cách", placeholder: "U ám, tinh nghịch..." },
          { key: "appearance" as const, label: "Ngoại hình", placeholder: "Màu tóc, chiều cao..." },
          { key: "bio" as const, label: "Giới thiệu bản thân", placeholder: "Nghề nghiệp, sở thích..." },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.7)", display: "block", marginBottom: 7 }}>{label}</label>
            <textarea value={draft[key]} onChange={e => setDraft(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} rows={2}
              style={{ ...iStyle, resize: "none" }}
              onFocus={e => (e.target.style.borderColor = "rgba(108,92,231,0.6)")} onBlur={e => (e.target.style.borderColor = "rgba(108,92,231,0.2)")} />
          </div>
        ))}

        {/* Social links */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.7)", display: "block", marginBottom: 7 }}>Liên kết mạng xã hội</label>
          {[0, 1, 2].map(i => {
            const link = draft.socialLinks?.[i] || { label: "", url: "" };
            const update = (field: "label" | "url", val: string) => {
              setDraft(p => {
                const links = [...(p.socialLinks || [{ label: "", url: "" }, { label: "", url: "" }, { label: "", url: "" }])];
                while (links.length < 3) links.push({ label: "", url: "" });
                links[i] = { ...links[i], [field]: val };
                return { ...p, socialLinks: links.filter(l => l.label || l.url) };
              });
            };
            return (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 7 }}>
                <input type="text" value={link.label} onChange={e => update("label", e.target.value)} placeholder="Nhãn (Instagram...)" style={{ ...iStyle, width: "38%", flexShrink: 0, fontSize: 12 }}
                  onFocus={e => (e.target.style.borderColor = "rgba(108,92,231,0.6)")} onBlur={e => (e.target.style.borderColor = "rgba(108,92,231,0.2)")} />
                <input type="text" value={link.url} onChange={e => update("url", e.target.value)} placeholder="https://..." style={{ ...iStyle, fontSize: 12 }}
                  onFocus={e => (e.target.style.borderColor = "rgba(108,92,231,0.6)")} onBlur={e => (e.target.style.borderColor = "rgba(108,92,231,0.2)")} />
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{ marginTop: 18, width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: saved ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", boxShadow: "0 6px 20px rgba(108,92,231,0.25)", transition: "background 0.3s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {saving ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />Đang lưu...</> : saved ? "✓ Đã lưu lên cloud!" : "Lưu hồ sơ"}
      </button>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={onSettings}
          style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid rgba(108,92,231,0.2)", background: "rgba(108,92,231,0.06)", color: "rgba(167,139,250,0.7)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Settings size={13} /> Cài đặt
        </button>
        <button onClick={() => { if (user) logout(); }}
          style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid rgba(239,68,68,0.18)", background: "rgba(239,68,68,0.05)", color: "rgba(239,68,68,0.55)", fontSize: 12, cursor: "pointer" }}>
          Đăng xuất
        </button>
      </div>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN HOME PAGE
══════════════════════════════════════════════ */
export default function HomePage({ onChat, onSettings, onAddCharacter, onViewUser }: Props) {
  const { user } = useAuth();
  const { isAdmin, pending } = useCharacters();
  const email = user?.email || user?.uid || "";
  const [tab, setTab] = useState<Tab>("all");
  const appLogo = localStorage.getItem("kismet_logo");

  const navTab = (t: Tab, icon: React.ReactNode, label: string, badge?: number) => {
    const active = tab === t;
    return (
      <button onClick={() => setTab(t)}
        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "10px 0 6px", position: "relative" }}>
        {active && <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 2, borderRadius: 2, background: "#6c5ce7" }} />}
        <div style={{ color: active ? "#a78bfa" : "rgba(255,255,255,0.22)", transition: "color 0.2s", position: "relative" }}>
          {icon}
          {badge && badge > 0 ? (
            <span style={{ position: "absolute", top: -5, right: -7, width: 16, height: 16, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>
          ) : null}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: active ? "#a78bfa" : "rgba(255,255,255,0.22)", transition: "color 0.2s", letterSpacing: "0.04em" }}>{label}</span>
      </button>
    );
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "linear-gradient(160deg,#07050f 0%,#0e0b1e 50%,#080616 100%)", color: "#fff", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── TOP HEADER ── */}
      <div style={{ background: "rgba(14,10,28,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(108,92,231,0.18)", padding: "13px 16px 11px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, boxShadow: "0 1px 0 rgba(108,92,231,0.08), 0 4px 20px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {appLogo ? (
            <img src={appLogo} alt="logo" style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(212,175,55,0.3)" }} />
          ) : (
            <span style={{ fontSize: 22, filter: "drop-shadow(0 0 10px rgba(212,175,55,0.4))" }}>🌌</span>
          )}
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.1em", background: "linear-gradient(135deg,#f5e6a3,#d4af37)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>KISMET</h1>
            <p style={{ fontSize: 10, color: "rgba(167,139,250,0.35)", letterSpacing: "0.04em" }}>{email}</p>
          </div>
        </div>
        <button onClick={onAddCharacter} title="Tạo nhân vật mới"
          style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(108,92,231,0.3)", background: "rgba(108,92,231,0.1)", color: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Plus size={16} />
        </button>
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          {tab === "all" && <AllTab onChat={onChat} onAddCharacter={onAddCharacter} onViewUser={onViewUser} />}
          {tab === "messages" && <MessagesTab onChat={onChat} />}
          {tab === "profile" && <ProfileTab onSettings={onSettings} onAddCharacter={onAddCharacter} onViewMyPage={user ? () => onViewUser(user.uid) : undefined} />}
        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ flexShrink: 0, background: "rgba(8,6,18,0.92)", borderTop: "1px solid rgba(108,92,231,0.18)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", paddingBottom: "env(safe-area-inset-bottom,0px)", boxShadow: "0 -1px 0 rgba(108,92,231,0.06), 0 -8px 32px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", maxWidth: 500, margin: "0 auto" }}>
          {navTab("all", <Globe size={20} />, "Tất cả")}
          {navTab("messages", <MessageCircle size={20} />, "Tin nhắn")}
          {navTab("profile", <User size={20} />, "Hồ sơ", isAdmin ? pending.length : 0)}
        </div>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        textarea::placeholder, input::placeholder { color:rgba(255,255,255,0.2); }
        *::-webkit-scrollbar{width:4px}*::-webkit-scrollbar-track{background:transparent}*::-webkit-scrollbar-thumb{background:rgba(108,92,231,0.3);border-radius:4px}
      `}</style>
    </div>
  );
}
