import { useState, useRef } from "react";
import { ArrowLeft, Share2, Download, Loader2, QrCode, Link2, X } from "lucide-react";
import QRCode from "qrcode";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { Character } from "@/lib/types";

/* ── Char card 1:1 ── */
function CharCard({ char, onClick }: { char: Character; onClick: () => void }) {
  const isUrl = char.avatar.startsWith("http");
  return (
    <button onClick={onClick} style={{ all: "unset", cursor: "pointer", display: "block", position: "relative", paddingTop: "100%", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(108,92,231,0.25)", background: "linear-gradient(135deg,#1a0a3e,#0c0520)", boxShadow: "0 4px 20px rgba(0,0,0,0.4)", transition: "transform 0.18s, box-shadow 0.18s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.04)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 28px rgba(108,92,231,0.4)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.4)"; }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 8px" }}>
        {/* Sparkle ambient */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(108,92,231,0.25) 0%, transparent 70%)", pointerEvents: "none" }} />
        {/* Avatar */}
        <div style={{ width: "52%", aspectRatio: "1/1", borderRadius: "50%", overflow: "hidden", background: isUrl ? "transparent" : "linear-gradient(135deg,#1a0a3e,#6c5ce7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "min(28px, 10vw)", border: "2px solid rgba(108,92,231,0.5)", boxShadow: "0 0 16px rgba(108,92,231,0.4)", flexShrink: 0, position: "relative", zIndex: 1 }}>
          {isUrl ? <img src={char.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : char.avatar}
        </div>
        {/* Name */}
        <p style={{ fontSize: 12, fontWeight: 800, color: "#fff", textAlign: "center", lineHeight: 1.3, maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", position: "relative", zIndex: 1 }}>
          {char.name}
        </p>
        {/* Tag chip */}
        {char.tags && char.tags.length > 0 && (
          <span style={{ fontSize: 9.5, padding: "2px 8px", borderRadius: 10, background: "rgba(108,92,231,0.15)", border: "1px solid rgba(108,92,231,0.3)", color: "rgba(167,139,250,0.8)", position: "relative", zIndex: 1, whiteSpace: "nowrap", maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis" }}>
            {char.tags[0]}
          </span>
        )}
      </div>
    </button>
  );
}

/* ── QR Share overlay ── */
async function generateProfileQR(uid: string): Promise<string> {
  const url = `${window.location.origin}${window.location.pathname}?profile=${uid}`;
  return QRCode.toDataURL(url, {
    width: 600,
    margin: 2,
    color: { dark: "#000000ff", light: "#ffffffff" },
    errorCorrectionLevel: "H",
  });
}

interface Props {
  uid: string;
  onBack: () => void;
  onChat?: (char: Character) => void;
  isSelf?: boolean;
}

export default function UserPage({ uid, onBack, onChat, isSelf = false }: Props) {
  const { profile, characters, loading } = useUserProfile(uid);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const displayName = profile?.displayName || uid.slice(0, 8) + "...";
  const coverUrl = profile?.coverDataUrl || null;
  const avatarDataUrl = profile?.avatarDataUrl || null;

  const handleShare = async () => {
    setShowQr(true);
    if (!qrUrl) {
      setGeneratingQr(true);
      const url = await generateProfileQR(uid);
      setQrUrl(url);
      setGeneratingQr(false);
    }
  };

  const handleDownloadQr = () => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `kismet-profile-${displayName}.png`;
    a.click();
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#0a0a0f", color: "#fff", fontFamily: "'Segoe UI', system-ui, sans-serif", overflowY: "auto" }}>

      {/* ── COVER SECTION ── */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {/* Cover */}
        <div style={{ height: 200, background: coverUrl ? `url(${coverUrl}) center/cover` : "linear-gradient(135deg,#1a0a3e 0%,#2d1b69 40%,#0c0520 100%)", position: "relative", overflow: "hidden" }}>
          {/* Cosmic overlay */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 50%, rgba(108,92,231,0.35) 0%, transparent 65%), radial-gradient(ellipse at 75% 40%, rgba(212,175,55,0.18) 0%, transparent 60%)", pointerEvents: "none" }} />
          {/* Sparkles */}
          {[
            { t: "15%", l: "10%", sz: 4, c: "#d4af37", d: "0s" }, { t: "60%", l: "20%", sz: 2.5, c: "#a78bfa", d: "0.8s" },
            { t: "25%", l: "75%", sz: 3.5, c: "#fff8a0", d: "1.4s" }, { t: "70%", l: "85%", sz: 2, c: "#d4af37", d: "2s" },
            { t: "40%", l: "50%", sz: 2.5, c: "#c4b5fd", d: "0.5s" }, { t: "80%", l: "60%", sz: 3, c: "#d4af37", d: "1.8s" },
          ].map((s, i) => (
            <div key={i} style={{ position: "absolute", top: s.t, left: s.l, width: s.sz, height: s.sz, borderRadius: "50%", background: s.c, boxShadow: `0 0 ${s.sz * 4}px 1px ${s.c}`, animation: `upSparkle 2.8s ease-in-out ${s.d} infinite`, pointerEvents: "none" }} />
          ))}
          {/* Glassmorphism bottom fade */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(transparent, #0a0a0f)" }} />
        </div>

        {/* Back button */}
        <button onClick={onBack} style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ArrowLeft size={16} />
        </button>

        {/* Share button */}
        <button onClick={handleShare} style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(212,175,55,0.35)", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)", color: "#d4af37", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <QrCode size={16} />
        </button>

        {/* Avatar — overlapping cover and content */}
        <div style={{ position: "absolute", bottom: -48, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: avatarDataUrl ? "transparent" : "linear-gradient(135deg,#1a0a3e,#6c5ce7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, overflow: "hidden", border: "3px solid #0a0a0f", boxShadow: "0 0 0 2px rgba(108,92,231,0.6), 0 0 0 4px rgba(212,175,55,0.25), 0 0 32px rgba(108,92,231,0.5)" }}>
            {avatarDataUrl ? <img src={avatarDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (displayName[0]?.toUpperCase() || "✦")}
          </div>
        </div>
      </div>

      {/* ── PROFILE INFO ── */}
      <div style={{ paddingTop: 60, paddingBottom: 8, textAlign: "center", paddingLeft: 20, paddingRight: 20, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 4, textShadow: "0 0 24px rgba(108,92,231,0.5)" }}>
          {displayName}
        </h1>

        {isSelf && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, padding: "3px 12px", borderRadius: 20, background: "rgba(108,92,231,0.12)", border: "1px solid rgba(108,92,231,0.3)", color: "#a78bfa", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 10 }}>
            ✦ Trang của tôi
          </span>
        )}

        {profile?.bio && (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, maxWidth: 340, margin: "10px auto 0", fontStyle: "italic" }}>
            {profile.bio}
          </p>
        )}

        {/* Social links */}
        {profile?.socialLinks && profile.socialLinks.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 12 }}>
            {profile.socialLinks.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 13px", borderRadius: 20, background: "rgba(108,92,231,0.1)", border: "1px solid rgba(108,92,231,0.25)", color: "#a78bfa", fontSize: 12, fontWeight: 600, textDecoration: "none", transition: "background 0.15s" }}>
                <Link2 size={11} /> {link.label}
              </a>
            ))}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(108,92,231,0.3) 30%, rgba(212,175,55,0.2) 70%, transparent)", marginTop: 20 }} />
      </div>

      {/* ── CHARACTERS REPOSITORY ── */}
      <div style={{ flex: 1, padding: "16px 16px 32px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", gap: 12 }}>
            <Loader2 size={22} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 13, color: "rgba(167,139,250,0.4)", fontStyle: "italic" }}>Đang tải kho lưu trữ...</p>
          </div>
        ) : (
          <div style={{ maxWidth: 500, margin: "0 auto" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(167,139,250,0.45)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14, paddingLeft: 2 }}>
              ✦ Kho Nhân Vật · {characters.length} nhân vật công khai
            </p>

            {characters.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <p style={{ fontSize: 32, marginBottom: 10 }}>🔮</p>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.25)" }}>Chưa có nhân vật công khai nào</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {characters.map(char => (
                  <CharCard key={char.id} char={char} onClick={() => onChat?.(char)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── QR SHARE OVERLAY ── */}
      {showQr && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)" }} onClick={() => setShowQr(false)}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "32px 24px", borderRadius: 28, background: "linear-gradient(180deg,rgba(28,20,54,0.97),rgba(12,7,26,0.99))", border: "1px solid rgba(108,92,231,0.3)", maxWidth: 340, width: "90vw" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowQr(false)} style={{ alignSelf: "flex-end", width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={13} />
            </button>

            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(212,175,55,0.7)", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: -8 }}>✦ Chia sẻ Trang Cá Nhân</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginTop: -8 }}>{displayName}</p>

            {generatingQr ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "40px 0" }}>
                <Loader2 size={26} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
                <p style={{ fontSize: 13, color: "rgba(167,139,250,0.5)" }}>Đang tạo QR...</p>
              </div>
            ) : qrUrl ? (
              <>
                {/* 1:1 QR container */}
                <div style={{ width: "min(240px, 72vw)", aspectRatio: "1/1", borderRadius: 20, overflow: "hidden", boxShadow: "0 0 0 2px rgba(212,175,55,0.4), 0 0 40px rgba(108,92,231,0.35), 0 0 60px rgba(212,175,55,0.12)", padding: 12, background: "#fff", boxSizing: "border-box" }}>
                  <img src={qrUrl} alt="QR Code" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                </div>

                <button onClick={handleDownloadQr} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 24px", borderRadius: 13, border: "none", background: "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(108,92,231,0.4)" }}>
                  <Download size={14} /> Tải QR về máy
                </button>
              </>
            ) : null}

            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
              Quét QR để xem trang cá nhân · KISMET
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        @keyframes upSparkle {
          0%,100% { opacity:0.2; transform:scale(0.7); }
          50%      { opacity:1; transform:scale(1.7); }
        }
      `}</style>
    </div>
  );
}
