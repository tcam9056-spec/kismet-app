import { useState, useRef } from "react";
import { X, Share2, Download, Loader2, Copy, Check } from "lucide-react";
import type { Character } from "@/lib/types";
import QRCode from "qrcode";

/* ── Encode / Decode ── */
export function encodeCharacter(char: Character): string {
  const data = { n: char.name, a: char.avatar, s: char.slogan, p: char.personality, t: char.tags || [], fm: char.firstMessage || "", c: char.curse || "" };
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(data)))); }
  catch { return btoa(JSON.stringify(data)); }
}

export function decodeCharacter(code: string): Omit<Character, "id" | "createdBy"> | null {
  try {
    const raw = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    return { name: raw.n || "Nhân vật", avatar: raw.a || "🔮", slogan: raw.s || "", personality: raw.p || "", tags: Array.isArray(raw.t) ? raw.t : [], firstMessage: raw.fm || undefined, curse: raw.c || undefined, isPublic: false, isApproved: true };
  } catch { return null; }
}

/* ── Tag colors ── */
function tagColor(tag: string) {
  const hot = tag.includes("18+") || tag === "Bạo lực";
  return { bg: hot ? "rgba(239,68,68,0.15)" : "rgba(108,92,231,0.15)", border: hot ? "rgba(239,68,68,0.4)" : "rgba(108,92,231,0.45)", color: hot ? "#f87171" : "#c4b5fd" };
}

/* ── roundRect helper ── */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ── Load image helper ── */
async function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/* ══════════════════════════════════════
   TAROT CARD — SHARE CARD GENERATOR
══════════════════════════════════════ */
async function generateShareCard(char: Character, avatarSrc: string | null, creatorName: string, code: string): Promise<string> {
  const W = 400, H = 680;
  const canvas = document.createElement("canvas");
  canvas.width = W * 2; canvas.height = H * 2; // 2x for retina
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  /* ── 1. Deep space background ── */
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#04020f");
  bgGrad.addColorStop(0.4, "#0d0520");
  bgGrad.addColorStop(0.75, "#130a30");
  bgGrad.addColorStop(1, "#080410");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  /* ── 2. Nebula / cosmic mist overlays ── */
  const nebulas = [
    { x: W * 0.5, y: H * 0.22, r: 200, c0: "rgba(108,92,231,0.22)", c1: "transparent" },
    { x: W * 0.15, y: H * 0.6,  r: 150, c0: "rgba(147,51,234,0.14)", c1: "transparent" },
    { x: W * 0.85, y: H * 0.45, r: 130, c0: "rgba(212,175,55,0.10)", c1: "transparent" },
    { x: W * 0.5,  y: H * 0.85, r: 180, c0: "rgba(79,70,229,0.18)",  c1: "transparent" },
  ];
  nebulas.forEach(({ x, y, r, c0, c1 }) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });

  /* ── 3. Stars ── */
  const rng = (seed: number) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
  const rand = rng(42);
  for (let i = 0; i < 120; i++) {
    const sx = rand() * W, sy = rand() * H;
    const sr = 0.4 + rand() * 1.1;
    const alpha = 0.25 + rand() * 0.65;
    const hue = rand() > 0.7 ? `rgba(200,180,255,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = hue; ctx.fill();
  }

  /* ── 4. Avatar — misty blurred background ── */
  const avatarCX = W / 2, avatarCY = 178, avatarR = 58;
  if (avatarSrc) {
    const img = await loadImg(avatarSrc);
    if (img) {
      ctx.save();
      ctx.filter = "blur(28px)";
      ctx.globalAlpha = 0.28;
      ctx.drawImage(img, avatarCX - 120, avatarCY - 120, 240, 240);
      ctx.restore();
    }
  }

  /* ── 5. Avatar glow rings ── */
  [{ r: avatarR + 22, a: 0.08 }, { r: avatarR + 12, a: 0.15 }, { r: avatarR + 4, a: 0.28 }].forEach(({ r, a }) => {
    const g = ctx.createRadialGradient(avatarCX, avatarCY, r - 10, avatarCX, avatarCY, r + 10);
    g.addColorStop(0, `rgba(108,92,231,${a})`); g.addColorStop(0.5, `rgba(212,175,55,${a * 0.6})`); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(avatarCX, avatarCY, r + 12, 0, Math.PI * 2); ctx.fill();
  });

  /* ── 6. Avatar circle ── */
  ctx.save();
  ctx.beginPath(); ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2); ctx.clip();
  if (avatarSrc) {
    const img = await loadImg(avatarSrc);
    if (img) ctx.drawImage(img, avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
    else { ctx.fillStyle = "#1a0a3e"; ctx.fillRect(avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2); }
  } else {
    const grad = ctx.createLinearGradient(avatarCX - avatarR, avatarCY - avatarR, avatarCX + avatarR, avatarCY + avatarR);
    grad.addColorStop(0, "#1a0a3e"); grad.addColorStop(1, "#6c5ce7");
    ctx.fillStyle = grad; ctx.fillRect(avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
    ctx.restore();
    ctx.font = `${avatarR * 1.1}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(char.avatar, avatarCX, avatarCY);
    ctx.save();
  }
  ctx.restore();

  /* Avatar border ring gradient */
  ctx.beginPath(); ctx.arc(avatarCX, avatarCY, avatarR + 2.5, 0, Math.PI * 2);
  const ringGrad = ctx.createLinearGradient(avatarCX - avatarR, avatarCY - avatarR, avatarCX + avatarR, avatarCY + avatarR);
  ringGrad.addColorStop(0, "rgba(212,175,55,0.9)"); ringGrad.addColorStop(0.5, "rgba(108,92,231,0.8)"); ringGrad.addColorStop(1, "rgba(212,175,55,0.7)");
  ctx.strokeStyle = ringGrad; ctx.lineWidth = 2; ctx.stroke();

  /* ── 7. KISMET branding (top) ── */
  ctx.font = "bold 11px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#d4af37";
  ctx.globalAlpha = 0.9;
  ctx.fillText("✦   K I S M E T   ✦", W / 2, 28);
  ctx.globalAlpha = 1;

  /* Top ornamental line */
  {
    const ly = 38;
    const lg = ctx.createLinearGradient(40, ly, W - 40, ly);
    lg.addColorStop(0, "transparent"); lg.addColorStop(0.35, "rgba(212,175,55,0.5)"); lg.addColorStop(0.65, "rgba(108,92,231,0.5)"); lg.addColorStop(1, "transparent");
    ctx.strokeStyle = lg; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(40, ly); ctx.lineTo(W - 40, ly); ctx.stroke();
  }

  /* ── 8. Text block (below avatar) ── */
  const textTop = avatarCY + avatarR + 18;

  /* Name */
  ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
  const nameGrad = ctx.createLinearGradient(W / 2 - 80, 0, W / 2 + 80, 0);
  nameGrad.addColorStop(0, "#ffffff"); nameGrad.addColorStop(0.5, "#e8ddff"); nameGrad.addColorStop(1, "#d4af37");
  ctx.fillStyle = nameGrad;
  ctx.fillText(char.name, W / 2, textTop);

  /* Creator */
  ctx.font = "10px Arial"; ctx.fillStyle = "rgba(167,139,250,0.5)";
  ctx.fillText(`bởi ${creatorName}`, W / 2, textTop + 18);

  /* Slogan */
  ctx.font = "italic 11.5px Arial"; ctx.fillStyle = "#c4b5fd";
  const sloganFull = `\u201C${char.slogan}\u201D`;
  const maxSW = W - 60;
  const shortSlogan = ctx.measureText(sloganFull).width > maxSW ? sloganFull.slice(0, 44) + "\u2026\u201D" : sloganFull;
  ctx.fillText(shortSlogan, W / 2, textTop + 38);

  /* ── 9. Tags ── */
  const tags = (char.tags || []).slice(0, 5);
  const tagY = textTop + 56, tagH = 20;
  if (tags.length > 0) {
    ctx.font = "bold 10px Arial";
    const measured = tags.map(t => ({ t, w: Math.ceil(ctx.measureText(t).width) + 18 }));
    const totalW = measured.reduce((s, m) => s + m.w + 6, -6);
    let tx = (W - totalW) / 2;
    measured.forEach(({ t, w }) => {
      const hot = t.includes("18+") || t === "Bạo lực";
      ctx.fillStyle = hot ? "rgba(239,68,68,0.2)" : "rgba(108,92,231,0.2)";
      rr(ctx, tx, tagY, w, tagH, 10); ctx.fill();
      ctx.strokeStyle = hot ? "rgba(239,68,68,0.5)" : "rgba(108,92,231,0.55)";
      ctx.lineWidth = 0.8; rr(ctx, tx, tagY, w, tagH, 10); ctx.stroke();
      ctx.fillStyle = hot ? "#f87171" : "#c4b5fd";
      ctx.textAlign = "center"; ctx.fillText(t, tx + w / 2, tagY + 13.5);
      tx += w + 6;
    });
  }

  /* ── 10. Ornamental divider ── */
  const divY = tagY + (tags.length ? 32 : 8);
  {
    const lg = ctx.createLinearGradient(30, divY, W - 30, divY);
    lg.addColorStop(0, "transparent"); lg.addColorStop(0.4, "rgba(108,92,231,0.35)"); lg.addColorStop(0.6, "rgba(212,175,55,0.35)"); lg.addColorStop(1, "transparent");
    ctx.strokeStyle = lg; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(30, divY); ctx.lineTo(W - 30, divY); ctx.stroke();
    ctx.font = "9px Arial"; ctx.fillStyle = "rgba(212,175,55,0.5)"; ctx.textAlign = "center";
    ctx.fillText("⊹  LINH HỒN & THẾ GIỚI  ⊹", W / 2, divY + 10);
  }

  /* ── 11. Personality snippet ── */
  const snipY = divY + 22;
  ctx.font = "11px Arial"; ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.textAlign = "left";
  const snippet = char.personality.replace(/\n/g, " ").slice(0, 180);
  const words = snippet.split(" ");
  let line = "", ly = snipY;
  for (const w of words) {
    const test = line + (line ? " " : "") + w;
    if (ctx.measureText(test).width > W - 52) {
      ctx.fillText(line, 26, ly); line = w; ly += 15;
      if (ly > H - 175) { ctx.fillText(line + "…", 26, ly); line = ""; break; }
    } else line = test;
  }
  if (line) ctx.fillText(line, 26, ly);

  /* ── 12. QR Code — rounded + K center logo ── */
  const qrSize = 110;
  const qrPad = 10;
  const qrBoxW = qrSize + qrPad * 2, qrBoxH = qrSize + qrPad * 2;
  const qrBX = W / 2 - qrBoxW / 2, qrBY = H - qrBoxH - 42;

  try {
    /* QR on transparent bg */
    const qrDataUrl = await QRCode.toDataURL(code, {
      width: qrSize * 4, margin: 1,
      color: { dark: "#fffffff0", light: "#00000000" },
      errorCorrectionLevel: "H",
    });
    const qrImg = await loadImg(qrDataUrl);

    if (qrImg) {
      /* Glow behind QR box */
      const qglow = ctx.createRadialGradient(W / 2, qrBY + qrBoxH / 2, 0, W / 2, qrBY + qrBoxH / 2, 90);
      qglow.addColorStop(0, "rgba(108,92,231,0.25)"); qglow.addColorStop(1, "transparent");
      ctx.fillStyle = qglow; ctx.fillRect(qrBX - 20, qrBY - 20, qrBoxW + 40, qrBoxH + 40);

      /* QR box background */
      rr(ctx, qrBX, qrBY, qrBoxW, qrBoxH, 14);
      ctx.fillStyle = "rgba(10,5,30,0.85)"; ctx.fill();
      ctx.strokeStyle = "rgba(108,92,231,0.4)"; ctx.lineWidth = 1;
      rr(ctx, qrBX, qrBY, qrBoxW, qrBoxH, 14); ctx.stroke();

      /* Draw QR clipped with rounded corners */
      ctx.save();
      rr(ctx, qrBX + 4, qrBY + 4, qrBoxW - 8, qrBoxH - 8, 10);
      ctx.clip();
      ctx.drawImage(qrImg, qrBX + qrPad, qrBY + qrPad, qrSize, qrSize);
      ctx.restore();

      /* "K" center badge */
      const kCX = qrBX + qrBoxW / 2, kCY = qrBY + qrBoxH / 2;
      const kR = 10;
      ctx.fillStyle = "#0d0520"; ctx.beginPath(); ctx.arc(kCX, kCY, kR + 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#d4af37"; ctx.beginPath(); ctx.arc(kCX, kCY, kR, 0, Math.PI * 2); ctx.fill();
      ctx.font = "bold 11px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#0d0520"; ctx.fillText("K", kCX, kCY);
      ctx.textBaseline = "alphabetic";
    }
  } catch { /* skip QR on error */ }

  /* ── 13. Bottom label ── */
  ctx.font = "9px Arial"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(212,175,55,0.45)";
  ctx.fillText("Quét QR để triệu hồi • KISMET", W / 2, H - 24);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillText("kismet.app", W / 2, H - 12);

  /* ── 14. Outer Tarot border frame ── */
  const bm = 10; // margin
  rr(ctx, bm, bm, W - bm * 2, H - bm * 2, 20);
  const borderGrad = ctx.createLinearGradient(bm, bm, W - bm, H - bm);
  borderGrad.addColorStop(0,   "rgba(212,175,55,0.85)");
  borderGrad.addColorStop(0.25,"rgba(108,92,231,0.7)");
  borderGrad.addColorStop(0.5, "rgba(167,139,250,0.6)");
  borderGrad.addColorStop(0.75,"rgba(108,92,231,0.7)");
  borderGrad.addColorStop(1,   "rgba(212,175,55,0.85)");
  ctx.strokeStyle = borderGrad; ctx.lineWidth = 1.5; ctx.stroke();

  /* Inner thin frame */
  const bm2 = 14;
  rr(ctx, bm2, bm2, W - bm2 * 2, H - bm2 * 2, 16);
  const innerGrad = ctx.createLinearGradient(bm2, bm2, W - bm2, H - bm2);
  innerGrad.addColorStop(0, "rgba(212,175,55,0.3)"); innerGrad.addColorStop(0.5, "rgba(108,92,231,0.2)"); innerGrad.addColorStop(1, "rgba(212,175,55,0.3)");
  ctx.strokeStyle = innerGrad; ctx.lineWidth = 0.6; ctx.stroke();

  /* Corner ornaments */
  const corners = [{ x: 22, y: 22 }, { x: W - 22, y: 22 }, { x: 22, y: H - 22 }, { x: W - 22, y: H - 22 }];
  ctx.fillStyle = "rgba(212,175,55,0.6)";
  corners.forEach(({ x, y }) => {
    ctx.font = "10px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("✦", x, y);
  });

  return canvas.toDataURL("image/png");
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

  const personalityPreview = character.personality.length > 300
    ? character.personality.slice(0, 300) + "…"
    : character.personality;

  const handleShare = async () => {
    setShareMode(true);
    setGeneratingCard(true);
    setCardUrl(null);
    try {
      const url = await generateShareCard(character, avatarSrc, creatorName, code);
      setCardUrl(url);
    } catch { setCardUrl(null); }
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
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.82)", backdropFilter: "blur(14px)" }} onClick={onClose}>
      <div style={{ background: "linear-gradient(180deg,#1c1825 0%,#100d1a 100%)", border: "1px solid rgba(108,92,231,0.3)", borderTopLeftRadius: 28, borderTopRightRadius: 28, width: "100%", maxWidth: 480, maxHeight: "92dvh", overflowY: "auto", paddingBottom: 32, position: "relative" }} onClick={e => e.stopPropagation()}>

        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 18px 0" }}>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={13} />
          </button>
          <button onClick={handleShare} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 10, border: "1px solid rgba(212,175,55,0.35)", background: "rgba(212,175,55,0.08)", color: "#d4af37", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Share2 size={13} /> Chia sẻ
          </button>
        </div>

        {/* Avatar section */}
        <div style={{ padding: "22px 24px 0", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(108,92,231,0.3) 0%, transparent 70%)", filter: "blur(32px)", pointerEvents: "none" }} />

          <div style={{ width: 112, height: 112, borderRadius: "50%", background: avatarSrc ? "transparent" : "linear-gradient(135deg,#1a0a3e,#6c5ce7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 58, overflow: "hidden", border: "2.5px solid transparent", backgroundClip: "padding-box", boxShadow: "0 0 0 2.5px rgba(108,92,231,0.6), 0 0 0 5px rgba(212,175,55,0.25), 0 0 40px rgba(108,92,231,0.45), 0 0 80px rgba(108,92,231,0.15)", position: "relative", zIndex: 1 }}>
            {avatarSrc ? <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : character.avatar}
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginTop: 14, marginBottom: 3, textAlign: "center", textShadow: "0 0 24px rgba(108,92,231,0.6)" }}>
            {character.name}
          </h2>
          <p style={{ fontSize: 11, color: "rgba(167,139,250,0.4)", marginBottom: 10 }}>Tạo bởi {creatorName}</p>

          <div style={{ padding: "7px 20px", borderRadius: 20, background: "rgba(108,92,231,0.1)", border: "1px solid rgba(108,92,231,0.28)", marginBottom: 16, maxWidth: "88%", textAlign: "center" }}>
            <p style={{ color: "#c4b5fd", fontSize: 13, fontStyle: "italic", lineHeight: 1.5 }}>"{character.slogan}"</p>
          </div>

          {character.tags && character.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", marginBottom: 20 }}>
              {character.tags.map(tag => {
                const tc = tagColor(tag);
                return (
                  <span key={tag} style={{ padding: "5px 13px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color, boxShadow: `0 0 8px ${tc.border}` }}>
                    {tag}
                  </span>
                );
              })}
            </div>
          )}

          {character.isPublic && (
            <span style={{ fontSize: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399", borderRadius: 20, padding: "3px 12px", fontWeight: 600, marginBottom: 16 }}>
              ✦ Nhân vật công khai
            </span>
          )}
        </div>

        {/* Personality */}
        <div style={{ margin: "4px 20px 20px", padding: "16px", borderRadius: 16, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(108,92,231,0.12)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(167,139,250,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>⊹ Linh Hồn & Thế Giới</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, whiteSpace: "pre-line" }}>{personalityPreview}</p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, padding: "0 20px" }}>
          <button onClick={handleCopyCode} style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 16px", borderRadius: 13, border: "1px solid rgba(108,92,231,0.3)", background: "rgba(108,92,231,0.1)", color: "#a78bfa", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            {copied ? <><Check size={13} /> Đã sao chép!</> : <><Copy size={13} /> Sao chép mã</>}
          </button>
          <button onClick={() => { onClose(); onChat(); }} style={{ flex: 1, padding: "13px 0", borderRadius: 13, border: "none", background: "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 20px rgba(108,92,231,0.4)" }}>
            Bắt đầu tâm giao →
          </button>
        </div>
      </div>

      {/* ── Share card overlay ── */}
      {shareMode && (
        <div style={{ position: "fixed", inset: 0, zIndex: 350, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.94)", backdropFilter: "blur(20px)" }} onClick={() => setShareMode(false)}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "24px 20px" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(212,175,55,0.7)", letterSpacing: "0.15em", textTransform: "uppercase" }}>✦ Thẻ Nhân Vật</p>

            {generatingCard ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "50px 60px" }}>
                <Loader2 size={28} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
                <p style={{ color: "rgba(167,139,250,0.5)", fontSize: 13 }}>Đang tạo thẻ Tarot...</p>
              </div>
            ) : cardUrl ? (
              <>
                <img ref={cardRef} src={cardUrl} alt="Thẻ nhân vật" style={{ width: "min(320px, 80vw)", borderRadius: 18, boxShadow: "0 0 60px rgba(108,92,231,0.4), 0 20px 60px rgba(0,0,0,0.8)" }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={handleDownload} style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 20px", borderRadius: 13, border: "none", background: "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(108,92,231,0.4)" }}>
                    <Download size={14} /> Tải về máy
                  </button>
                  <button onClick={handleCopyCode} style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 18px", borderRadius: 13, border: "1px solid rgba(212,175,55,0.4)", background: "rgba(212,175,55,0.09)", color: "#d4af37", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {copied ? <><Check size={13} /> Đã sao!</> : <><Copy size={13} /> Sao chép mã</>}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", textAlign: "center", maxWidth: 280 }}>
                  Người khác dùng mã hoặc quét QR để triệu hồi nhân vật này
                </p>
              </>
            ) : (
              <p style={{ color: "#fca5a5", fontSize: 13 }}>Không thể tạo thẻ. Thử lại sau.</p>
            )}

            <button onClick={() => setShareMode(false)} style={{ padding: "8px 28px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer" }}>
              Đóng
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
