import { useState, useRef } from "react";
import { X, Share2, Download, Loader2, Copy, Check } from "lucide-react";
import type { Character } from "@/lib/types";
import QRCode from "qrcode";

/* ── Encode/Decode character for QR sharing ── */
export function encodeCharacter(char: Character): string {
  const data = {
    n: char.name,
    a: char.avatar,
    s: char.slogan,
    p: char.personality,
    t: char.tags || [],
    fm: char.firstMessage || "",
    c: char.curse || "",
  };
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  } catch {
    return btoa(JSON.stringify(data));
  }
}

export function decodeCharacter(code: string): Omit<Character, "id" | "createdBy"> | null {
  try {
    const raw = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    return {
      name: raw.n || "Nhân vật",
      avatar: raw.a || "🔮",
      slogan: raw.s || "",
      personality: raw.p || "",
      tags: Array.isArray(raw.t) ? raw.t : [],
      firstMessage: raw.fm || undefined,
      curse: raw.c || undefined,
      isPublic: false,
      isApproved: true,
    };
  } catch {
    return null;
  }
}

/* ── Tag color helpers ── */
function tagColor(tag: string) {
  const hot = tag.includes("18+") || tag === "Bạo lực";
  return {
    bg: hot ? "rgba(239,68,68,0.15)" : "rgba(108,92,231,0.15)",
    border: hot ? "rgba(239,68,68,0.4)" : "rgba(108,92,231,0.45)",
    color: hot ? "#f87171" : "#c4b5fd",
  };
}

/* ── Generate share card via Canvas ── */
async function generateShareCard(
  char: Character,
  avatarSrc: string | null,
  creatorName: string,
  code: string
): Promise<string> {
  const W = 400, H = 620;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  /* Background */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0e0820");
  bg.addColorStop(0.5, "#1a0a3e");
  bg.addColorStop(1, "#0a0a0f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  /* Subtle glow circles */
  const g1 = ctx.createRadialGradient(80, 120, 0, 80, 120, 180);
  g1.addColorStop(0, "rgba(108,92,231,0.18)");
  g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(340, 500, 0, 340, 500, 160);
  g2.addColorStop(0, "rgba(212,175,55,0.1)");
  g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

  /* Top border accent */
  const top = ctx.createLinearGradient(0, 0, W, 0);
  top.addColorStop(0, "transparent");
  top.addColorStop(0.3, "rgba(108,92,231,0.8)");
  top.addColorStop(0.7, "rgba(212,175,55,0.6)");
  top.addColorStop(1, "transparent");
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, 2);

  /* KISMET branding */
  ctx.font = "bold 13px Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = "#d4af37";
  ctx.letterSpacing = "0.2em";
  ctx.fillText("✦  K I S M E T  ✦", W / 2, 30);

  /* Avatar */
  const avatarY = 60, avatarR = 64, avatarCX = W / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCX, avatarY + avatarR, avatarR, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(108,92,231,0.3)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(avatarCX, avatarY + avatarR, avatarR, 0, Math.PI * 2);
  ctx.clip();
  if (avatarSrc) {
    const img = new Image();
    await new Promise<void>(res => {
      img.onload = () => res();
      img.onerror = () => res();
      img.src = avatarSrc;
    });
    ctx.drawImage(img, avatarCX - avatarR, avatarY, avatarR * 2, avatarR * 2);
  } else {
    const grad = ctx.createLinearGradient(avatarCX - avatarR, avatarY, avatarCX + avatarR, avatarY + avatarR * 2);
    grad.addColorStop(0, "#1a0a3e");
    grad.addColorStop(1, "#6c5ce7");
    ctx.fillStyle = grad;
    ctx.fillRect(avatarCX - avatarR, avatarY, avatarR * 2, avatarR * 2);
    ctx.restore();
    ctx.font = `${avatarR}px serif`;
    ctx.textAlign = "center";
    ctx.fillText(char.avatar, avatarCX, avatarY + avatarR * 1.25);
    ctx.save();
  }
  ctx.restore();

  /* Avatar ring */
  ctx.beginPath();
  ctx.arc(avatarCX, avatarY + avatarR, avatarR + 3, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(108,92,231,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();

  /* Character name */
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(char.name, W / 2, avatarY + avatarR * 2 + 30);

  /* Creator */
  ctx.font = "12px Arial";
  ctx.fillStyle = "rgba(167,139,250,0.55)";
  ctx.fillText(`Tạo bởi ${creatorName}`, W / 2, avatarY + avatarR * 2 + 50);

  /* Slogan */
  ctx.font = "italic 12px Arial";
  ctx.fillStyle = "#c4b5fd";
  const sloganText = `"${char.slogan}"`;
  const maxW = 320;
  if (ctx.measureText(sloganText).width > maxW) {
    ctx.fillText(sloganText.slice(0, 48) + '\u2026\u201D', W / 2, avatarY + avatarR * 2 + 74);
  } else {
    ctx.fillText(sloganText, W / 2, avatarY + avatarR * 2 + 74);
  }

  /* Tags */
  const tags = (char.tags || []).slice(0, 5);
  if (tags.length > 0) {
    let tagX = 0;
    const tagY = avatarY + avatarR * 2 + 95;
    const tagH = 22;
    const measured = tags.map(t => ({ t, w: ctx.measureText(t).width + 20 }));
    const totalW = measured.reduce((s, m) => s + m.w + 8, -8);
    tagX = (W - totalW) / 2;
    ctx.font = "bold 11px Arial";
    measured.forEach(({ t, w }) => {
      const hot = t.includes("18+") || t === "Bạo lực";
      ctx.fillStyle = hot ? "rgba(239,68,68,0.18)" : "rgba(108,92,231,0.18)";
      roundRect(ctx, tagX, tagY, w, tagH, 11);
      ctx.fill();
      ctx.strokeStyle = hot ? "rgba(239,68,68,0.4)" : "rgba(108,92,231,0.45)";
      ctx.lineWidth = 1;
      roundRect(ctx, tagX, tagY, w, tagH, 11);
      ctx.stroke();
      ctx.fillStyle = hot ? "#f87171" : "#c4b5fd";
      ctx.textAlign = "center";
      ctx.fillText(t, tagX + w / 2, tagY + 15);
      tagX += w + 8;
    });
  }

  /* Divider */
  const divY = avatarY + avatarR * 2 + (tags.length ? 130 : 95);
  ctx.strokeStyle = "rgba(108,92,231,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(24, divY); ctx.lineTo(W - 24, divY); ctx.stroke();

  /* Personality snippet */
  const snippetY = divY + 16;
  ctx.font = "11px Arial";
  ctx.fillStyle = "rgba(167,139,250,0.5)";
  ctx.textAlign = "left";
  ctx.fillText("LINH HỒN & THẾ GIỚI", 24, snippetY);
  const snippet = char.personality.slice(0, 200).replace(/\n/g, " ");
  const words = snippet.split(" ");
  ctx.font = "12px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  let line = ""; let ly = snippetY + 18;
  for (const w of words) {
    const test = line + (line ? " " : "") + w;
    if (ctx.measureText(test).width > W - 48) {
      ctx.fillText(line, 24, ly);
      line = w; ly += 17;
      if (ly > H - 120) { ctx.fillText(line + "…", 24, ly); break; }
    } else { line = test; }
  }
  if (ly <= H - 120) ctx.fillText(line, 24, ly);

  /* QR code */
  const qrSize = 120;
  const qrY = H - qrSize - 28;
  const qrX = W / 2 - qrSize / 2;
  try {
    const qrDataUrl = await QRCode.toDataURL(code, {
      width: qrSize * 2, margin: 1,
      color: { dark: "#ffffffee", light: "#00000000" },
    });
    const qrImg = new Image();
    await new Promise<void>(res => { qrImg.onload = () => res(); qrImg.onerror = () => res(); qrImg.src = qrDataUrl; });
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 14);
    ctx.fill();
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } catch {}

  /* Bottom label */
  ctx.font = "10px Arial";
  ctx.fillStyle = "rgba(212,175,55,0.4)";
  ctx.textAlign = "center";
  ctx.fillText("Quét QR để triệu hồi nhân vật • kismet.app", W / 2, H - 10);

  return canvas.toDataURL("image/png");
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
interface Props {
  character: Character;
  onClose: () => void;
  onChat: () => void;
  creatorName?: string;
}

export default function CharacterProfile({ character, onClose, onChat, creatorName = "KISMET" }: Props) {
  const avatarSrc = localStorage.getItem(`kismet_char_avatar_${character.id}`);
  const code = encodeCharacter(character);

  const [shareMode, setShareMode] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLImageElement>(null);

  /* Personality preview — max 300 chars */
  const personalityPreview = character.personality.length > 300
    ? character.personality.slice(0, 300) + "…"
    : character.personality;

  const handleShare = async () => {
    setShareMode(true);
    setGeneratingCard(true);
    try {
      const url = await generateShareCard(character, avatarSrc, creatorName, code);
      setCardUrl(url);
    } catch {
      setCardUrl(null);
    }
    setGeneratingCard(false);
  };

  const handleDownload = () => {
    if (!cardUrl) return;
    const a = document.createElement("a");
    a.href = cardUrl;
    a.download = `kismet-${character.name.replace(/\s+/g, "-")}.png`;
    a.click();
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      <div
        style={{ background: "linear-gradient(180deg,#1c1825 0%,#100d1a 100%)", border: "1px solid rgba(108,92,231,0.3)", borderTopLeftRadius: 28, borderTopRightRadius: 28, width: "100%", maxWidth: 480, maxHeight: "92dvh", overflowY: "auto", paddingBottom: 32, position: "relative" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close + Share buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 18px 0" }}>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={13} />
          </button>
          <button onClick={handleShare} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 10, border: "1px solid rgba(212,175,55,0.3)", background: "rgba(212,175,55,0.07)", color: "#d4af37", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Share2 size={13} /> Chia sẻ
          </button>
        </div>

        {/* Avatar + glow banner */}
        <div style={{ position: "relative", padding: "20px 24px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Blur glow behind avatar */}
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(108,92,231,0.35) 0%, transparent 70%)", filter: "blur(30px)", pointerEvents: "none" }} />

          {/* Avatar */}
          <div style={{ width: 110, height: 110, borderRadius: "50%", background: avatarSrc ? "transparent" : "linear-gradient(135deg,#1a0a3e,#6c5ce7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, overflow: "hidden", border: "3px solid rgba(108,92,231,0.55)", boxShadow: "0 0 40px rgba(108,92,231,0.4), 0 0 80px rgba(108,92,231,0.15)", position: "relative", zIndex: 1 }}>
            {avatarSrc
              ? <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : character.avatar}
          </div>

          {/* Name */}
          <h2 style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginTop: 14, marginBottom: 4, textAlign: "center", textShadow: "0 0 20px rgba(108,92,231,0.5)" }}>
            {character.name}
          </h2>

          {/* Creator */}
          <p style={{ fontSize: 11, color: "rgba(167,139,250,0.4)", marginBottom: 10 }}>
            Tạo bởi {creatorName}
          </p>

          {/* Slogan */}
          <div style={{ padding: "7px 18px", borderRadius: 20, background: "rgba(108,92,231,0.1)", border: "1px solid rgba(108,92,231,0.28)", marginBottom: 14, maxWidth: "85%", textAlign: "center" }}>
            <p style={{ color: "#c4b5fd", fontSize: 13, fontStyle: "italic", lineHeight: 1.5 }}>"{character.slogan}"</p>
          </div>

          {/* Tags — shiny badges */}
          {character.tags && character.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", marginBottom: 20 }}>
              {character.tags.map(tag => {
                const tc = tagColor(tag);
                return (
                  <span key={tag} style={{ padding: "5px 13px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color, boxShadow: `0 0 8px ${tc.border}`, letterSpacing: "0.03em" }}>
                    {tag}
                  </span>
                );
              })}
            </div>
          )}

          {/* Status badge */}
          {character.isPublic && (
            <span style={{ fontSize: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399", borderRadius: 20, padding: "3px 12px", fontWeight: 600, marginBottom: 16 }}>
              ✦ Nhân vật công khai
            </span>
          )}
        </div>

        {/* Personality section */}
        <div style={{ margin: "4px 20px 20px", padding: "16px", borderRadius: 16, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(108,92,231,0.12)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(167,139,250,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            ✦ Linh Hồn & Thế Giới
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, whiteSpace: "pre-line" }}>
            {personalityPreview}
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, padding: "0 20px" }}>
          <button onClick={handleCopyCode} style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 16px", borderRadius: 13, border: "1px solid rgba(108,92,231,0.3)", background: "rgba(108,92,231,0.1)", color: "#a78bfa", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            {copied ? <><Check size={13} /> Đã sao chép!</> : <><Copy size={13} /> Sao chép mã</>}
          </button>
          <button onClick={() => { onClose(); onChat(); }} style={{ flex: 1, padding: "13px 0", borderRadius: 13, border: "none", background: "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 20px rgba(108,92,231,0.4)" }}>
            Bắt đầu tâm giao →
          </button>
        </div>
      </div>

      {/* ── Share card modal ── */}
      {shareMode && (
        <div style={{ position: "fixed", inset: 0, zIndex: 350, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.92)", backdropFilter: "blur(16px)" }} onClick={() => setShareMode(false)}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 24 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(167,139,250,0.6)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Thẻ Nhân Vật</p>

            {generatingCard ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "60px 40px" }}>
                <Loader2 size={28} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
                <p style={{ color: "rgba(167,139,250,0.5)", fontSize: 13 }}>Đang tạo thẻ chia sẻ...</p>
              </div>
            ) : cardUrl ? (
              <>
                <img ref={cardRef} src={cardUrl} alt="Share card" style={{ width: "min(340px, 85vw)", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={handleDownload} style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 20px", borderRadius: 13, border: "none", background: "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(108,92,231,0.4)" }}>
                    <Download size={14} /> Tải về máy
                  </button>
                  <button onClick={handleCopyCode} style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 18px", borderRadius: 13, border: "1px solid rgba(212,175,55,0.35)", background: "rgba(212,175,55,0.08)", color: "#d4af37", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {copied ? <><Check size={13} /> Đã sao chép!</> : <><Copy size={13} /> Sao chép mã</>}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", maxWidth: 300 }}>
                  Người khác dùng mã hoặc quét QR để triệu hồi nhân vật này
                </p>
              </>
            ) : (
              <p style={{ color: "#fca5a5", fontSize: 13 }}>Không thể tạo thẻ. Thử lại sau.</p>
            )}

            <button onClick={() => setShareMode(false)} style={{ padding: "8px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer" }}>
              Đóng
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
