import { useState, useRef } from "react";
import { X, Share2, Download, Loader2, Copy, Check } from "lucide-react";
import type { Character } from "@/lib/types";
import QRCode from "qrcode";

/* ── Encode / Decode ── */
export function encodeCharacter(char: Character): string {
  const data = { n: char.name, a: char.avatar, s: char.slogan, p: char.personality, t: char.tags || [], fm: char.firstMessage || "", c: char.curse || "" };
  const json = JSON.stringify(data);
  try {
    /* TextEncoder: chuẩn UTF-8, hỗ trợ tiếng Việt đầy đủ */
    const bytes = new TextEncoder().encode(json);
    let bin = ""; bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  } catch {
    try { return btoa(unescape(encodeURIComponent(json))); }
    catch { return btoa(json); }
  }
}

export function decodeCharacter(code: string): Omit<Character, "id" | "createdBy"> | null {
  /* Loại bỏ khoảng trắng/xuống dòng có thể xuất hiện khi copy-paste */
  const c = code.trim().replace(/[\s\r\n]+/g, "");
  if (!c) return null;

  /* Thử nhiều phương pháp giải mã để đảm bảo tương thích tối đa */
  const methods = [
    /* 1. TextDecoder — chuẩn UTF-8 (khớp với encodeCharacter mới) */
    () => {
      const bin = atob(c);
      const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
      return JSON.parse(new TextDecoder("utf-8").decode(bytes));
    },
    /* 2. unescape/escape — phương pháp cũ, vẫn giải được mã cũ */
    () => JSON.parse(decodeURIComponent(escape(atob(c)))),
    /* 3. atob thuần — fallback cho mã ASCII-only */
    () => JSON.parse(atob(c)),
  ];

  for (const parse of methods) {
    try {
      const raw = parse();
      if (raw && typeof raw.n === "string") {
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
      }
    } catch { /* thử phương pháp tiếp theo */ }
  }
  return null;
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
   Tỉ lệ 16:9 ngang · QR lớn · Lấp lánh bí ẩn
══════════════════════════════════════════════════ */
async function generateShareCard(char: Character, avatarSrc: string | null, creatorName: string, code: string): Promise<string> {
  const W = 640, H = 360;
  const canvas = document.createElement("canvas");
  canvas.width = W * 2; canvas.height = H * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  /* ═══════════════════════════════════════════════════
     LAYOUT 16:9 NGANG
     Left  (0..296):   Avatar + Tên + Slogan + Tags
     Divider (297..303): dải ánh sáng dọc
     Right (304..628):  KISMET + Personality + QR
  ═══════════════════════════════════════════════════ */

  /* ── 1. Nền vũ trụ ── */
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#0d0525"); bgGrad.addColorStop(0.5, "#080320"); bgGrad.addColorStop(1, "#050218");
  ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

  /* Nebula overlays */
  [
    { x: 150, y: 150, r: 200, c: "rgba(108,92,231,0.22)" },
    { x: 470, y: 200, r: 200, c: "rgba(79,70,229,0.18)" },
    { x: 70,  y: 300, r: 130, c: "rgba(147,51,234,0.12)" },
    { x: 580, y: 80,  r: 120, c: "rgba(212,175,55,0.09)" },
  ].forEach(({ x, y, r, c }) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });

  /* ── 2. Glassmorphism panel ── */
  const pm = 10;
  rr(ctx, pm, pm, W - pm * 2, H - pm * 2, 18);
  ctx.fillStyle = "rgba(255,255,255,0.025)"; ctx.fill();
  const hl = ctx.createLinearGradient(pm, pm, pm, pm + 50);
  hl.addColorStop(0, "rgba(255,255,255,0.055)"); hl.addColorStop(1, "transparent");
  rr(ctx, pm, pm, W - pm * 2, H - pm * 2, 18); ctx.fillStyle = hl; ctx.fill();
  const gs = ctx.createLinearGradient(pm, pm, W - pm, H - pm);
  gs.addColorStop(0, "rgba(212,175,55,0.5)"); gs.addColorStop(0.4, "rgba(167,139,250,0.28)");
  gs.addColorStop(0.6, "rgba(108,92,231,0.32)"); gs.addColorStop(1, "rgba(212,175,55,0.45)");
  rr(ctx, pm, pm, W - pm * 2, H - pm * 2, 18); ctx.strokeStyle = gs; ctx.lineWidth = 1.2; ctx.stroke();

  /* ── 3. Hạt lấp lánh ── */
  const rand = (() => { let s = 91; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
  const scolors = ["rgba(255,255,255,A)", "rgba(212,175,55,A)", "rgba(200,180,255,A)", "rgba(167,139,250,A)"];
  for (let i = 0; i < 55; i++) {
    const sx = pm + rand() * (W - pm * 2), sy = pm + rand() * (H - pm * 2);
    const sz = 0.5 + rand() * 2, al = (0.15 + rand() * 0.65).toFixed(2);
    ctx.fillStyle = scolors[Math.floor(rand() * 4)].replace("A", al);
    if (rand() > 0.5) {
      ctx.beginPath(); ctx.arc(sx, sy, sz * 0.65, 0, Math.PI * 2); ctx.fill();
    } else {
      const s2 = sz * 1.3;
      ctx.fillRect(sx - s2 * 0.11, sy - s2, s2 * 0.22, s2 * 2);
      ctx.fillRect(sx - s2, sy - s2 * 0.11, s2 * 2, s2 * 0.22);
    }
  }

  /* ════════ LEFT PANEL (x: 0..296) ════════ */
  const LCX = 152;  /* center x */
  const avatarR = 52, avatarCY = 147;

  /* Avatar ghost blur */
  if (avatarSrc) {
    const img = await loadImg(avatarSrc);
    if (img) {
      ctx.save();
      ctx.filter = "blur(28px)"; ctx.globalAlpha = 0.20;
      /* clip to left panel so ghost doesn't spill over */
      ctx.beginPath(); ctx.rect(pm, pm, 290 - pm, H - pm * 2); ctx.clip();
      ctx.drawImage(img, LCX - 110, avatarCY - 110, 220, 220);
      ctx.restore();
    }
  }

  /* Glow rings */
  [{ r: avatarR + 26, a: 0.07 }, { r: avatarR + 13, a: 0.16 }, { r: avatarR + 4, a: 0.32 }].forEach(({ r, a }) => {
    const g = ctx.createRadialGradient(LCX, avatarCY, r - 12, LCX, avatarCY, r + 12);
    g.addColorStop(0, `rgba(108,92,231,${a})`); g.addColorStop(0.5, `rgba(212,175,55,${a * 0.5})`); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(LCX, avatarCY, r + 14, 0, Math.PI * 2); ctx.fill();
  });

  /* Avatar circle */
  ctx.save();
  ctx.beginPath(); ctx.arc(LCX, avatarCY, avatarR, 0, Math.PI * 2); ctx.clip();
  if (avatarSrc) {
    const img = await loadImg(avatarSrc);
    if (img) {
      ctx.drawImage(img, LCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
    } else {
      const fg = ctx.createLinearGradient(LCX - avatarR, avatarCY - avatarR, LCX + avatarR, avatarCY + avatarR);
      fg.addColorStop(0, "#1a0a3e"); fg.addColorStop(1, "#6c5ce7");
      ctx.fillStyle = fg; ctx.fillRect(LCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
    }
  } else {
    const fg = ctx.createLinearGradient(LCX - avatarR, avatarCY - avatarR, LCX + avatarR, avatarCY + avatarR);
    fg.addColorStop(0, "#1a0a3e"); fg.addColorStop(1, "#6c5ce7");
    ctx.fillStyle = fg; ctx.fillRect(LCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
    ctx.restore();
    ctx.font = `${avatarR * 0.9}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(char.avatar, LCX, avatarCY);
    ctx.save();
  }
  ctx.restore();

  /* Avatar ring */
  ctx.beginPath(); ctx.arc(LCX, avatarCY, avatarR + 2, 0, Math.PI * 2);
  const ringG = ctx.createLinearGradient(LCX - avatarR, avatarCY - avatarR, LCX + avatarR, avatarCY + avatarR);
  ringG.addColorStop(0, "#d4af37"); ringG.addColorStop(0.4, "#a78bfa"); ringG.addColorStop(1, "#d4af37");
  ctx.strokeStyle = ringG; ctx.lineWidth = 2; ctx.stroke();

  /* Name */
  const nameY = avatarCY + avatarR + 20;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "center";
  ctx.font = "bold 17px Arial";
  const nameGr = ctx.createLinearGradient(LCX - 70, 0, LCX + 70, 0);
  nameGr.addColorStop(0, "#fff"); nameGr.addColorStop(0.5, "#e8ddff"); nameGr.addColorStop(1, "#d4af37");
  ctx.fillStyle = nameGr;
  /* truncate name to fit left panel */
  let dispName = char.name;
  while (ctx.measureText(dispName).width > 220 && dispName.length > 4) dispName = dispName.slice(0, -1);
  if (dispName !== char.name) dispName += "…";
  ctx.fillText(dispName, LCX, nameY);

  /* Creator */
  ctx.font = "9.5px Arial"; ctx.fillStyle = "rgba(167,139,250,0.45)";
  ctx.fillText(`b\u1edfi ${creatorName}`, LCX, nameY + 16);

  /* Slogan */
  ctx.font = "italic 10px Arial"; ctx.fillStyle = "rgba(196,181,253,0.82)";
  const sf = `\u201C${char.slogan}\u201D`;
  const sl = ctx.measureText(sf).width > 230 ? sf.slice(0, 34) + "\u2026\u201D" : sf;
  ctx.fillText(sl, LCX, nameY + 32);

  /* Tags */
  const tags = (char.tags || []).slice(0, 3);
  if (tags.length > 0) {
    const tagH = 17, tagY2 = nameY + 50;
    ctx.font = "bold 9px Arial";
    const ms = tags.map(t => ({ t, w: Math.ceil(ctx.measureText(t).width) + 14 }));
    const tw = ms.reduce((s, m) => s + m.w + 5, -5);
    let tx = LCX - tw / 2;
    ms.forEach(({ t, w }) => {
      const hot = t.includes("18+") || t === "B\u1ea1o l\u1ef1c";
      ctx.fillStyle = hot ? "rgba(239,68,68,0.18)" : "rgba(108,92,231,0.20)";
      rr(ctx, tx, tagY2, w, tagH, 8); ctx.fill();
      ctx.strokeStyle = hot ? "rgba(239,68,68,0.5)" : "rgba(108,92,231,0.55)";
      ctx.lineWidth = 0.7; rr(ctx, tx, tagY2, w, tagH, 8); ctx.stroke();
      ctx.fillStyle = hot ? "#f87171" : "#c4b5fd";
      ctx.textAlign = "center"; ctx.fillText(t, tx + w / 2, tagY2 + 12);
      tx += w + 5;
    });
  }

  /* ════════ DIVIDER (x ≈ 299..303) ════════ */
  {
    const dg = ctx.createLinearGradient(300, 30, 300, H - 30);
    dg.addColorStop(0, "transparent");
    dg.addColorStop(0.25, "rgba(212,175,55,0.45)");
    dg.addColorStop(0.75, "rgba(108,92,231,0.35)");
    dg.addColorStop(1, "transparent");
    ctx.strokeStyle = dg; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(300, 24); ctx.lineTo(300, H - 24); ctx.stroke();
  }

  /* ════════ RIGHT PANEL (x: 310..628) ════════ */
  const RX = 310; /* left edge of right panel content */
  const RCX = (310 + 628) / 2; /* 469 */
  const RMAX = 618 - RX; /* max text width ≈ 308 */

  /* KISMET branding — top right */
  ctx.font = "bold 10px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const hgr = ctx.createLinearGradient(RCX - 55, 0, RCX + 55, 0);
  hgr.addColorStop(0, "#d4af37"); hgr.addColorStop(0.5, "#f0d060"); hgr.addColorStop(1, "#d4af37");
  ctx.fillStyle = hgr; ctx.globalAlpha = 0.9;
  ctx.fillText("\u2736  K I S M E T  \u2736", RCX, 30);
  ctx.globalAlpha = 1;
  {
    const ll = ctx.createLinearGradient(RX, 38, RX + RMAX, 38);
    ll.addColorStop(0, "transparent"); ll.addColorStop(0.4, "rgba(212,175,55,0.5)"); ll.addColorStop(0.6, "rgba(167,139,250,0.4)"); ll.addColorStop(1, "transparent");
    ctx.strokeStyle = ll; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(RX + 4, 38); ctx.lineTo(RX + RMAX - 4, 38); ctx.stroke();
  }

  /* Personality snippet — 4 lines max */
  ctx.font = "10px Arial"; ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.textAlign = "left";
  const snip = char.personality.replace(/\n/g, " ").slice(0, 240);
  const wds = snip.split(" ");
  let pline = "", ply = 56;
  for (const w of wds) {
    const test = pline + (pline ? " " : "") + w;
    if (ctx.measureText(test).width > RMAX) {
      ctx.fillText(pline, RX + 4, ply); pline = w; ply += 13;
      if (ply > 108) { ctx.fillText(pline + "\u2026", RX + 4, ply); pline = ""; break; }
    } else pline = test;
  }
  if (pline && ply <= 108) ctx.fillText(pline, RX + 4, ply);

  /* ── QR Code — large, clear, scannable ── */
  /* QR is 134×134 display, generated at 536px (4×) for sharpness */
  const qrSize = 134, qrPad = 10;
  const qrBoxW = qrSize + qrPad * 2, qrBoxH = qrSize + qrPad * 2; /* 154×154 */
  const qrBX = RCX - qrBoxW / 2, qrBY = H - qrBoxH - 18; /* bottom-anchored */

  try {
    /* Nền trắng mờ đằng sau QR để đảm bảo độ tương phản khi quét */
    const qrDataUrl = await QRCode.toDataURL(code, {
      width: qrSize * 4,
      margin: 2, /* quiet zone đủ rộng cho scanner */
      color: { dark: "#000000ff", light: "#ffffffff" }, /* đen trên trắng — máy quét đọc chắc chắn nhất */
      errorCorrectionLevel: "H",
    });
    const qrImg = await loadImg(qrDataUrl);
    if (qrImg) {
      /* Hào quang vàng nhạt phía sau */
      const qglow = ctx.createRadialGradient(RCX, qrBY + qrBoxH / 2, 0, RCX, qrBY + qrBoxH / 2, 90);
      qglow.addColorStop(0, "rgba(212,175,55,0.18)"); qglow.addColorStop(0.6, "rgba(108,92,231,0.10)"); qglow.addColorStop(1, "transparent");
      ctx.fillStyle = qglow; ctx.fillRect(qrBX - 20, qrBY - 20, qrBoxW + 40, qrBoxH + 40);

      /* Nền trắng của box QR — tương phản cao để scanner đọc được */
      rr(ctx, qrBX, qrBY, qrBoxW, qrBoxH, 14);
      ctx.fillStyle = "#ffffff"; ctx.fill();

      /* Viền gradient đẹp bên ngoài */
      const bb = ctx.createLinearGradient(qrBX, qrBY, qrBX + qrBoxW, qrBY + qrBoxH);
      bb.addColorStop(0, "rgba(212,175,55,0.7)"); bb.addColorStop(0.5, "rgba(108,92,231,0.6)"); bb.addColorStop(1, "rgba(212,175,55,0.65)");
      rr(ctx, qrBX, qrBY, qrBoxW, qrBoxH, 14); ctx.strokeStyle = bb; ctx.lineWidth = 1.5; ctx.stroke();

      /* Vẽ QR — không clip, không filter, không blur → scanner đọc 100% */
      ctx.drawImage(qrImg, qrBX + qrPad, qrBY + qrPad, qrSize, qrSize);

      /* K badge nhỏ ở góc trên-phải của box (không che QR) */
      const kCX = qrBX + qrBoxW - 14, kCY = qrBY + 14, kR = 10;
      const kFill = ctx.createRadialGradient(kCX - 1, kCY - 1, 0, kCX, kCY, kR);
      kFill.addColorStop(0, "#f0d060"); kFill.addColorStop(1, "#b8900a");
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(kCX, kCY, kR + 1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = kFill; ctx.beginPath(); ctx.arc(kCX, kCY, kR, 0, Math.PI * 2); ctx.fill();
      ctx.font = "bold 11px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#1a0830"; ctx.fillText("K", kCX, kCY);
      ctx.textBaseline = "alphabetic";
    }
  } catch { /* skip QR on error */ }

  /* ── Label dưới QR ── */
  ctx.font = "8.5px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(212,175,55,0.38)";
  ctx.fillText("Qu\u00e9t QR \u0111\u1ec3 tri\u1ec7u h\u1ed3i \u2022 KISMET", RCX, H - 8);

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
