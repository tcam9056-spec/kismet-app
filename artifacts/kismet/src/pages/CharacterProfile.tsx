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

/* ══════════════════════════════════════════════════
   MEMORY SHARD — SPARKLE SHARE CARD GENERATOR
   Phong cách: Bí ẩn · Lấp lánh · Mảnh ký ức
══════════════════════════════════════════════════ */
async function generateShareCard(char: Character, avatarSrc: string | null, creatorName: string, code: string): Promise<string> {
  const W = 420, H = 580;
  const canvas = document.createElement("canvas");
  canvas.width = W * 2; canvas.height = H * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  /* ── 1. Nền vũ trụ sâu ── */
  const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.35, W * 0.9);
  bgGrad.addColorStop(0, "#130830");
  bgGrad.addColorStop(0.55, "#080420");
  bgGrad.addColorStop(1, "#030210");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  /* Nebula mist overlays */
  const nebulas = [
    { x: W * 0.5,  y: H * 0.25, r: 220, c: "rgba(108,92,231,0.20)" },
    { x: W * 0.15, y: H * 0.5,  r: 160, c: "rgba(147,51,234,0.12)" },
    { x: W * 0.88, y: H * 0.42, r: 140, c: "rgba(212,175,55,0.09)" },
    { x: W * 0.5,  y: H * 0.82, r: 200, c: "rgba(79,70,229,0.16)"  },
    { x: W * 0.28, y: H * 0.12, r: 120, c: "rgba(167,139,250,0.10)" },
  ];
  nebulas.forEach(({ x, y, r, c }) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });

  /* ── 2. Glassmorphism panel chính ── */
  const panelM = 14;
  rr(ctx, panelM, panelM, W - panelM * 2, H - panelM * 2, 22);
  ctx.fillStyle = "rgba(255,255,255,0.030)";
  ctx.fill();
  /* Highlight phía trên panel */
  const highlight = ctx.createLinearGradient(panelM, panelM, panelM, panelM + 60);
  highlight.addColorStop(0, "rgba(255,255,255,0.06)");
  highlight.addColorStop(1, "transparent");
  rr(ctx, panelM, panelM, W - panelM * 2, H - panelM * 2, 22);
  ctx.fillStyle = highlight; ctx.fill();
  /* Viền glass */
  rr(ctx, panelM, panelM, W - panelM * 2, H - panelM * 2, 22);
  const glassStroke = ctx.createLinearGradient(panelM, panelM, W - panelM, H - panelM);
  glassStroke.addColorStop(0, "rgba(212,175,55,0.45)");
  glassStroke.addColorStop(0.35, "rgba(167,139,250,0.30)");
  glassStroke.addColorStop(0.65, "rgba(108,92,231,0.35)");
  glassStroke.addColorStop(1, "rgba(212,175,55,0.40)");
  ctx.strokeStyle = glassStroke; ctx.lineWidth = 1.2; ctx.stroke();

  /* ── 3. Hạt lấp lánh (sparkle) ── */
  const rand = (() => { let s = 73; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
  const sparkleColors = ["rgba(255,255,255,A)", "rgba(212,175,55,A)", "rgba(200,180,255,A)", "rgba(167,139,250,A)"];
  for (let i = 0; i < 60; i++) {
    const sx = panelM + rand() * (W - panelM * 2);
    const sy = panelM + rand() * (H - panelM * 2);
    const size = 0.5 + rand() * 2.2;
    const alpha = (0.2 + rand() * 0.7).toFixed(2);
    const color = sparkleColors[Math.floor(rand() * 4)].replace("A", alpha);
    ctx.fillStyle = color;
    if (rand() > 0.55) {
      /* Chấm tròn */
      ctx.beginPath(); ctx.arc(sx, sy, size * 0.7, 0, Math.PI * 2); ctx.fill();
    } else {
      /* Hình chéo nhỏ (cross/diamond) */
      const s2 = size * 1.4;
      ctx.fillRect(sx - s2 * 0.12, sy - s2, s2 * 0.24, s2 * 2);
      ctx.fillRect(sx - s2, sy - s2 * 0.12, s2 * 2, s2 * 0.24);
    }
  }

  /* ── 4. KISMET header ── */
  ctx.font = "bold 10px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const headerGrad = ctx.createLinearGradient(W / 2 - 60, 0, W / 2 + 60, 0);
  headerGrad.addColorStop(0, "#d4af37"); headerGrad.addColorStop(0.5, "#f0d060"); headerGrad.addColorStop(1, "#d4af37");
  ctx.fillStyle = headerGrad;
  ctx.globalAlpha = 0.92;
  ctx.fillText("✦   K I S M E T   ✦", W / 2, 36);
  ctx.globalAlpha = 1;

  /* Thin glow line below header */
  {
    const ly = 44;
    const lg = ctx.createLinearGradient(50, ly, W - 50, ly);
    lg.addColorStop(0, "transparent"); lg.addColorStop(0.4, "rgba(212,175,55,0.55)"); lg.addColorStop(0.6, "rgba(167,139,250,0.45)"); lg.addColorStop(1, "transparent");
    ctx.strokeStyle = lg; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(50, ly); ctx.lineTo(W - 50, ly); ctx.stroke();
  }

  /* ── 5. Avatar — ghost blur + sharp circle ── */
  const avatarCX = W / 2, avatarCY = 148, avatarR = 56;

  /* Ghost / aura blur */
  if (avatarSrc) {
    const img = await loadImg(avatarSrc);
    if (img) {
      ctx.save();
      ctx.filter = "blur(32px)";
      ctx.globalAlpha = 0.22;
      ctx.drawImage(img, avatarCX - 130, avatarCY - 130, 260, 260);
      ctx.restore();
    }
  }

  /* Glow rings (outer → inner) */
  const glowRings = [
    { r: avatarR + 30, a: 0.06, c1: "108,92,231", c2: "212,175,55" },
    { r: avatarR + 16, a: 0.14, c1: "108,92,231", c2: "212,175,55" },
    { r: avatarR + 5,  a: 0.30, c1: "147,51,234", c2: "212,175,55" },
  ];
  glowRings.forEach(({ r, a, c1, c2 }) => {
    const g = ctx.createRadialGradient(avatarCX, avatarCY, r - 14, avatarCX, avatarCY, r + 14);
    g.addColorStop(0, `rgba(${c1},${a})`); g.addColorStop(0.5, `rgba(${c2},${a * 0.5})`); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(avatarCX, avatarCY, r + 16, 0, Math.PI * 2); ctx.fill();
  });

  /* Avatar circle */
  ctx.save();
  ctx.beginPath(); ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2); ctx.clip();
  if (avatarSrc) {
    const img = await loadImg(avatarSrc);
    if (img) ctx.drawImage(img, avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
    else {
      const fg = ctx.createLinearGradient(avatarCX - avatarR, avatarCY - avatarR, avatarCX + avatarR, avatarCY + avatarR);
      fg.addColorStop(0, "#1a0a3e"); fg.addColorStop(1, "#6c5ce7");
      ctx.fillStyle = fg; ctx.fillRect(avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
    }
  } else {
    const fg = ctx.createLinearGradient(avatarCX - avatarR, avatarCY - avatarR, avatarCX + avatarR, avatarCY + avatarR);
    fg.addColorStop(0, "#1a0a3e"); fg.addColorStop(1, "#6c5ce7");
    ctx.fillStyle = fg; ctx.fillRect(avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
    ctx.restore();
    ctx.font = `${avatarR}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(char.avatar, avatarCX, avatarCY);
    ctx.save();
  }
  ctx.restore();

  /* Avatar border — gradient gold → purple → gold */
  ctx.beginPath(); ctx.arc(avatarCX, avatarCY, avatarR + 2, 0, Math.PI * 2);
  const ringG = ctx.createLinearGradient(avatarCX - avatarR, avatarCY - avatarR, avatarCX + avatarR, avatarCY + avatarR);
  ringG.addColorStop(0, "rgba(212,175,55,0.95)"); ringG.addColorStop(0.4, "rgba(108,92,231,0.85)"); ringG.addColorStop(0.7, "rgba(167,139,250,0.8)"); ringG.addColorStop(1, "rgba(212,175,55,0.9)");
  ctx.strokeStyle = ringG; ctx.lineWidth = 2.2; ctx.stroke();

  /* ── 6. Text block ── */
  const textTop = avatarCY + avatarR + 22;
  ctx.textBaseline = "alphabetic";

  /* Name gradient */
  ctx.font = "bold 21px Arial"; ctx.textAlign = "center";
  const nameGr = ctx.createLinearGradient(W / 2 - 90, 0, W / 2 + 90, 0);
  nameGr.addColorStop(0, "#ffffff"); nameGr.addColorStop(0.45, "#e8ddff"); nameGr.addColorStop(1, "#d4af37");
  ctx.fillStyle = nameGr;
  ctx.fillText(char.name, W / 2, textTop);

  /* Creator */
  ctx.font = "10px Arial"; ctx.fillStyle = "rgba(167,139,250,0.48)";
  ctx.fillText(`b\u1edfi ${creatorName}`, W / 2, textTop + 18);

  /* Slogan */
  ctx.font = "italic 11.5px Arial"; ctx.fillStyle = "rgba(196,181,253,0.85)";
  const sloganFull = `\u201C${char.slogan}\u201D`;
  const shortSlogan = ctx.measureText(sloganFull).width > W - 70 ? sloganFull.slice(0, 44) + "\u2026\u201D" : sloganFull;
  ctx.fillText(shortSlogan, W / 2, textTop + 38);

  /* ── 7. Tags ── */
  const tags = (char.tags || []).slice(0, 5);
  const tagY = textTop + 56, tagH = 20;
  if (tags.length > 0) {
    ctx.font = "bold 10px Arial";
    const measured = tags.map(t => ({ t, w: Math.ceil(ctx.measureText(t).width) + 18 }));
    const totalW = measured.reduce((s, m) => s + m.w + 6, -6);
    let tx = (W - totalW) / 2;
    measured.forEach(({ t, w }) => {
      const hot = t.includes("18+") || t === "B\u1ea1o l\u1ef1c";
      ctx.fillStyle = hot ? "rgba(239,68,68,0.18)" : "rgba(108,92,231,0.18)";
      rr(ctx, tx, tagY, w, tagH, 10); ctx.fill();
      ctx.strokeStyle = hot ? "rgba(239,68,68,0.55)" : "rgba(108,92,231,0.6)";
      ctx.lineWidth = 0.8; rr(ctx, tx, tagY, w, tagH, 10); ctx.stroke();
      ctx.fillStyle = hot ? "#f87171" : "#c4b5fd";
      ctx.textAlign = "center"; ctx.fillText(t, tx + w / 2, tagY + 13.5);
      tx += w + 6;
    });
  }

  /* ── 8. Divider with glow ── */
  const divY = tagY + (tags.length ? 30 : 6);
  {
    /* Glow dot at center */
    const dg = ctx.createRadialGradient(W / 2, divY, 0, W / 2, divY, 30);
    dg.addColorStop(0, "rgba(212,175,55,0.35)"); dg.addColorStop(1, "transparent");
    ctx.fillStyle = dg; ctx.fillRect(W / 2 - 32, divY - 8, 64, 16);
    /* Lines */
    const lg = ctx.createLinearGradient(30, divY, W - 30, divY);
    lg.addColorStop(0, "transparent"); lg.addColorStop(0.35, "rgba(212,175,55,0.45)"); lg.addColorStop(0.65, "rgba(167,139,250,0.35)"); lg.addColorStop(1, "transparent");
    ctx.strokeStyle = lg; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(30, divY); ctx.lineTo(W - 30, divY); ctx.stroke();
    ctx.font = "8px Arial"; ctx.fillStyle = "rgba(212,175,55,0.45)"; ctx.textAlign = "center";
    ctx.fillText("LINH H\u1ed2N & TH\u1ebc GI\u1edaI", W / 2, divY + 10);
  }

  /* ── 9. Personality snippet ── */
  const snipY = divY + 22;
  ctx.font = "10.5px Arial"; ctx.fillStyle = "rgba(255,255,255,0.48)"; ctx.textAlign = "left";
  const snippet = char.personality.replace(/\n/g, " ").slice(0, 200);
  const wds = snippet.split(" ");
  let line = "", aly = snipY;
  for (const w of wds) {
    const test = line + (line ? " " : "") + w;
    if (ctx.measureText(test).width > W - 60) {
      ctx.fillText(line, 30, aly); line = w; aly += 14;
      if (aly > H - 160) { ctx.fillText(line + "\u2026", 30, aly); line = ""; break; }
    } else line = test;
  }
  if (line) ctx.fillText(line, 30, aly);

  /* ── 10. QR Code — rounded box + K logo ── */
  const qrSize = 108;
  const qrPad = 11;
  const qrBoxW = qrSize + qrPad * 2, qrBoxH = qrSize + qrPad * 2;
  const qrBX = W / 2 - qrBoxW / 2, qrBY = H - qrBoxH - 38;

  try {
    const qrDataUrl = await QRCode.toDataURL(code, {
      width: qrSize * 4, margin: 1,
      color: { dark: "#ffffffff", light: "#00000000" },
      errorCorrectionLevel: "H",
    });
    const qrImg = await loadImg(qrDataUrl);
    if (qrImg) {
      /* Hào quang tím phía sau QR */
      const qglow = ctx.createRadialGradient(W / 2, qrBY + qrBoxH / 2, 0, W / 2, qrBY + qrBoxH / 2, qrBoxW * 0.8);
      qglow.addColorStop(0, "rgba(108,92,231,0.28)"); qglow.addColorStop(0.6, "rgba(108,92,231,0.10)"); qglow.addColorStop(1, "transparent");
      ctx.fillStyle = qglow; ctx.fillRect(qrBX - 24, qrBY - 24, qrBoxW + 48, qrBoxH + 48);

      /* Box glass bg */
      rr(ctx, qrBX, qrBY, qrBoxW, qrBoxH, 16);
      ctx.fillStyle = "rgba(8,4,28,0.80)"; ctx.fill();
      const boxBorder = ctx.createLinearGradient(qrBX, qrBY, qrBX + qrBoxW, qrBY + qrBoxH);
      boxBorder.addColorStop(0, "rgba(212,175,55,0.5)"); boxBorder.addColorStop(0.5, "rgba(108,92,231,0.4)"); boxBorder.addColorStop(1, "rgba(212,175,55,0.45)");
      ctx.strokeStyle = boxBorder; ctx.lineWidth = 1;
      rr(ctx, qrBX, qrBY, qrBoxW, qrBoxH, 16); ctx.stroke();

      /* QR clipped rounded */
      ctx.save();
      rr(ctx, qrBX + 4, qrBY + 4, qrBoxW - 8, qrBoxH - 8, 12);
      ctx.clip();
      ctx.drawImage(qrImg, qrBX + qrPad, qrBY + qrPad, qrSize, qrSize);
      ctx.restore();

      /* K badge center */
      const kCX = qrBX + qrBoxW / 2, kCY = qrBY + qrBoxH / 2, kR = 11;
      const kGlow = ctx.createRadialGradient(kCX, kCY, 0, kCX, kCY, kR + 8);
      kGlow.addColorStop(0, "rgba(212,175,55,0.5)"); kGlow.addColorStop(1, "transparent");
      ctx.fillStyle = kGlow; ctx.beginPath(); ctx.arc(kCX, kCY, kR + 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#060118"; ctx.beginPath(); ctx.arc(kCX, kCY, kR + 1, 0, Math.PI * 2); ctx.fill();
      const kFill = ctx.createRadialGradient(kCX - 2, kCY - 2, 0, kCX, kCY, kR);
      kFill.addColorStop(0, "#f0d060"); kFill.addColorStop(1, "#b8900a");
      ctx.fillStyle = kFill; ctx.beginPath(); ctx.arc(kCX, kCY, kR, 0, Math.PI * 2); ctx.fill();
      ctx.font = "bold 12px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#1a0830"; ctx.fillText("K", kCX, kCY);
      ctx.textBaseline = "alphabetic";
    }
  } catch { /* skip */ }

  /* ── 11. Bottom label ── */
  ctx.font = "9px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(212,175,55,0.40)";
  ctx.fillText("Qu\u00e9t QR \u0111\u1ec3 tri\u1ec7u h\u1ed3i \u2022 KISMET", W / 2, H - 22);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillText("kismet.app", W / 2, H - 11);

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
