import { useState, useRef } from "react";
import { X, Share2, Download, Loader2, Copy, Check, Lock, Camera } from "lucide-react";
import type { Character } from "@/lib/types";
import { ADMIN_EMAIL } from "@/lib/types";
import QRCode from "qrcode";
import { UserBadge } from "@/components/UserBadge";
import type { UserRole } from "@/components/UserBadge";

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

/* ══════════════════════════════════════════════════
   PARSE PERSONALITY — trích xuất sạch, ẩn code {}
══════════════════════════════════════════════════ */
function parsePersonalitySections(personality: string): {
  background: string;   /* Linh Hồn & Thế Giới — đã lọc code */
  appearance: string;   /* Ngoại hình */
  traits: string;       /* Tính cách */
  curse: string;        /* Lời nguyền nếu có */
} {
  /* Xoá mọi block {...} system-prompt code */
  const stripped = personality.replace(/\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, "").trim();

  /* Tách theo markers ━━ */
  const appMatch  = stripped.match(/━━\s*NGOẠI HÌNH[^━]*━━\s*([\s\S]*?)(?=━━|$)/i);
  const traitMatch = stripped.match(/━━\s*TÍNH CÁCH[^━]*━━\s*([\s\S]*?)(?=━━|$)/i);
  const curseMatch = stripped.match(/━━\s*LỜI NGUYỀN[^━]*━━\s*([\s\S]*?)(?=━━|$)/i);

  /* Phần trước marker đầu tiên = background */
  const bgRaw = stripped.split(/━━\s*NGOẠI HÌNH/i)[0]
    .split(/━━\s*TÍNH CÁCH/i)[0]
    .replace(/^\s*━+.*━+\s*/gm, "")   /* xoá dòng ━ */
    .replace(/^\s*\[.*?\]\s*$/gm, "") /* xoá [BLOCK HEADER] */
    .trim();

  return {
    background: bgRaw,
    appearance: appMatch  ? appMatch[1].replace(/^\s*━+.*━+\s*/gm,"").trim() : "",
    traits:     traitMatch ? traitMatch[1].replace(/^\s*━+.*━+\s*/gm,"").trim() : "",
    curse:      curseMatch ? curseMatch[1].replace(/^\s*━+.*━+\s*/gm,"").trim() : "",
  };
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
   KISMET TAROT CARD — Glassmorphism 1:1
   Kính mờ · Chiều sâu 3D · Vũ trụ bí ẩn · 500×500
══════════════════════════════════════════════════ */
async function generateShareCard(char: Character, avatarSrc: string | null, creatorName: string, code: string): Promise<string> {
  const W = 500, H = 500;
  const canvas = document.createElement("canvas");
  canvas.width = W * 2; canvas.height = H * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  /* ═══════════════════════════════════════════════════════════
     1. NỀN VŨ TRỤ — deep cosmic radial + nebula overlays
  ═══════════════════════════════════════════════════════════ */
  const bg = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, W * 0.85);
  bg.addColorStop(0,   "#1b0d42");
  bg.addColorStop(0.45,"#0c052a");
  bg.addColorStop(0.75,"#060318");
  bg.addColorStop(1,   "#020110");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  [
    { x: W * 0.5,  y: H * 0.32, r: 210, c: "rgba(108,92,231,0.28)" },
    { x: W * 0.18, y: H * 0.5,  r: 150, c: "rgba(147,51,234,0.16)" },
    { x: W * 0.82, y: H * 0.45, r: 140, c: "rgba(212,175,55,0.11)" },
    { x: W * 0.5,  y: H * 0.88, r: 190, c: "rgba(79,70,229,0.20)"  },
    { x: W * 0.25, y: H * 0.08, r: 130, c: "rgba(167,139,250,0.12)" },
  ].forEach(({ x, y, r, c }) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });

  /* ═══════════════════════════════════════════════════════════
     2. AVATAR MISTY-GLASSY BACKGROUND — làm mờ cực mạnh
  ═══════════════════════════════════════════════════════════ */
  const AX = W / 2, AY = 165, AR = 66;
  if (avatarSrc) {
    const img = await loadImg(avatarSrc);
    if (img) {
      /* Lớp 1: blur cực mạnh, phủ rộng — tạo nền misty */
      ctx.save(); ctx.filter = "blur(40px)"; ctx.globalAlpha = 0.32;
      ctx.drawImage(img, AX - 170, AY - 170, 340, 340);
      ctx.restore();
      /* Lớp 2: blur vừa, nhỏ hơn — tạo hào quang trực tiếp */
      ctx.save(); ctx.filter = "blur(18px)"; ctx.globalAlpha = 0.18;
      ctx.drawImage(img, AX - 110, AY - 110, 220, 220);
      ctx.restore();
    }
  }

  /* ═══════════════════════════════════════════════════════════
     3. GLASSMORPHISM PANEL — kính mờ có chiều sâu 3D
  ═══════════════════════════════════════════════════════════ */
  const pm = 13;
  /* Lớp đáy tối */
  rr(ctx, pm + 2, pm + 5, W - pm * 2 - 4, H - pm * 2 - 4, 22);
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fill();
  /* Mặt kính chính */
  rr(ctx, pm, pm, W - pm * 2, H - pm * 2, 22);
  ctx.fillStyle = "rgba(255,255,255,0.038)"; ctx.fill();
  /* Highlight trên cùng — hiệu ứng phản chiếu ánh sáng */
  const hlG = ctx.createLinearGradient(pm, pm, pm, pm + 80);
  hlG.addColorStop(0, "rgba(255,255,255,0.09)");
  hlG.addColorStop(0.5, "rgba(255,255,255,0.025)");
  hlG.addColorStop(1, "transparent");
  rr(ctx, pm, pm, W - pm * 2, H - pm * 2, 22); ctx.fillStyle = hlG; ctx.fill();
  /* Highlight cạnh trái */
  const hlL = ctx.createLinearGradient(pm, pm, pm + 60, pm);
  hlL.addColorStop(0, "rgba(255,255,255,0.06)"); hlL.addColorStop(1, "transparent");
  rr(ctx, pm, pm, W - pm * 2, H - pm * 2, 22); ctx.fillStyle = hlL; ctx.fill();

  /* ═══════════════════════════════════════════════════════════
     4. TAROT BORDER FRAME — viền vàng sang trọng
  ═══════════════════════════════════════════════════════════ */
  /* Outer glow */
  for (let i = 3; i >= 0; i--) {
    const a = 0.06 + i * 0.04;
    rr(ctx, pm - i, pm - i, W - pm * 2 + i * 2, H - pm * 2 + i * 2, 22 + i);
    const og = ctx.createLinearGradient(pm, pm, W - pm, H - pm);
    og.addColorStop(0, `rgba(212,175,55,${a})`); og.addColorStop(0.5, `rgba(108,92,231,${a * 0.7})`); og.addColorStop(1, `rgba(212,175,55,${a})`);
    ctx.strokeStyle = og; ctx.lineWidth = 1; ctx.stroke();
  }
  /* Main border */
  rr(ctx, pm, pm, W - pm * 2, H - pm * 2, 22);
  const bG = ctx.createLinearGradient(pm, pm, W - pm, H - pm);
  bG.addColorStop(0,    "rgba(212,175,55,0.95)");
  bG.addColorStop(0.25, "rgba(167,139,250,0.65)");
  bG.addColorStop(0.5,  "rgba(108,92,231,0.70)");
  bG.addColorStop(0.75, "rgba(167,139,250,0.65)");
  bG.addColorStop(1,    "rgba(212,175,55,0.95)");
  ctx.strokeStyle = bG; ctx.lineWidth = 1.8; ctx.stroke();
  /* Inner thin border */
  const ib = pm + 5;
  rr(ctx, ib, ib, W - ib * 2, H - ib * 2, 17);
  const ibG = ctx.createLinearGradient(ib, ib, W - ib, H - ib);
  ibG.addColorStop(0, "rgba(212,175,55,0.30)"); ibG.addColorStop(0.5, "rgba(108,92,231,0.20)"); ibG.addColorStop(1, "rgba(212,175,55,0.30)");
  ctx.strokeStyle = ibG; ctx.lineWidth = 0.6; ctx.stroke();

  /* Corner ornaments */
  ctx.font = "11px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(212,175,55,0.75)";
  [[pm + 11, pm + 11], [W - pm - 11, pm + 11], [pm + 11, H - pm - 11], [W - pm - 11, H - pm - 11]].forEach(([cx, cy]) => {
    ctx.fillText("\u2736", cx, cy);
  });

  /* ═══════════════════════════════════════════════════════════
     5. HẠT LẤP LÁNH SPARKLE — chấm + chữ thập nhỏ
  ═══════════════════════════════════════════════════════════ */
  const rand = (() => { let s = 57; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
  const sc = ["rgba(255,255,255,A)", "rgba(212,175,55,A)", "rgba(196,181,253,A)", "rgba(167,139,250,A)"];
  for (let i = 0; i < 65; i++) {
    const sx = pm + 6 + rand() * (W - pm * 2 - 12);
    const sy = pm + 6 + rand() * (H - pm * 2 - 12);
    const sz = 0.4 + rand() * 2.0;
    const al = (0.18 + rand() * 0.65).toFixed(2);
    ctx.fillStyle = sc[Math.floor(rand() * 4)].replace("A", al);
    if (rand() > 0.48) {
      ctx.beginPath(); ctx.arc(sx, sy, sz * 0.65, 0, Math.PI * 2); ctx.fill();
    } else {
      const arm = sz * 1.2;
      ctx.fillRect(sx - arm * 0.10, sy - arm, arm * 0.20, arm * 2);
      ctx.fillRect(sx - arm, sy - arm * 0.10, arm * 2, arm * 0.20);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     6. KISMET HEADER — vàng lấp lánh phía trên
  ═══════════════════════════════════════════════════════════ */
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "center";
  ctx.font = "bold 11px Arial";
  const hG = ctx.createLinearGradient(W / 2 - 65, 0, W / 2 + 65, 0);
  hG.addColorStop(0, "#b8900a"); hG.addColorStop(0.35, "#f0d060"); hG.addColorStop(0.5, "#fff8dc"); hG.addColorStop(0.65, "#f0d060"); hG.addColorStop(1, "#b8900a");
  ctx.fillStyle = hG; ctx.globalAlpha = 0.95;
  ctx.fillText("\u2736   K I S M E T   \u2736", W / 2, 35);
  ctx.globalAlpha = 1;
  {
    const ll = ctx.createLinearGradient(40, 43, W - 40, 43);
    ll.addColorStop(0, "transparent"); ll.addColorStop(0.3, "rgba(212,175,55,0.6)"); ll.addColorStop(0.7, "rgba(167,139,250,0.5)"); ll.addColorStop(1, "transparent");
    ctx.strokeStyle = ll; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(40, 43); ctx.lineTo(W - 40, 43); ctx.stroke();
  }

  /* ═══════════════════════════════════════════════════════════
     7. AVATAR — glow rings + sharp circle + gradient ring
  ═══════════════════════════════════════════════════════════ */
  /* Glow rings: ngoài → trong */
  [
    { r: AR + 32, a: 0.06, rgb: "108,92,231" },
    { r: AR + 19, a: 0.14, rgb: "108,92,231" },
    { r: AR +  8, a: 0.28, rgb: "147,51,234" },
    { r: AR +  2, a: 0.45, rgb: "212,175,55" },
  ].forEach(({ r, a, rgb }) => {
    const g = ctx.createRadialGradient(AX, AY, Math.max(0, r - 16), AX, AY, r + 16);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(AX, AY, r + 18, 0, Math.PI * 2); ctx.fill();
  });

  /* Avatar circle */
  ctx.save();
  ctx.beginPath(); ctx.arc(AX, AY, AR, 0, Math.PI * 2); ctx.clip();
  if (avatarSrc) {
    const img = await loadImg(avatarSrc);
    if (img) {
      ctx.drawImage(img, AX - AR, AY - AR, AR * 2, AR * 2);
    } else {
      const fg = ctx.createLinearGradient(AX - AR, AY - AR, AX + AR, AY + AR);
      fg.addColorStop(0, "#1a0a3e"); fg.addColorStop(1, "#6c5ce7");
      ctx.fillStyle = fg; ctx.fillRect(AX - AR, AY - AR, AR * 2, AR * 2);
    }
  } else {
    const fg = ctx.createLinearGradient(AX - AR, AY - AR, AX + AR, AY + AR);
    fg.addColorStop(0, "#1a0a3e"); fg.addColorStop(1, "#6c5ce7");
    ctx.fillStyle = fg; ctx.fillRect(AX - AR, AY - AR, AR * 2, AR * 2);
    ctx.restore();
    ctx.font = `${AR * 0.95}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(char.avatar, AX, AY);
    ctx.save();
  }
  ctx.restore();

  /* Avatar border ring */
  ctx.beginPath(); ctx.arc(AX, AY, AR + 2.5, 0, Math.PI * 2);
  const rG = ctx.createLinearGradient(AX - AR, AY - AR, AX + AR, AY + AR);
  rG.addColorStop(0, "#d4af37"); rG.addColorStop(0.3, "#a78bfa"); rG.addColorStop(0.7, "#c084fc"); rG.addColorStop(1, "#d4af37");
  ctx.strokeStyle = rG; ctx.lineWidth = 2.5; ctx.stroke();

  /* ═══════════════════════════════════════════════════════════
     8. TEXT BLOCK — name, creator, slogan, tags
  ═══════════════════════════════════════════════════════════ */
  const TY = AY + AR + 22;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "center";

  /* Name */
  ctx.font = "bold 20px Arial";
  const nG = ctx.createLinearGradient(W / 2 - 90, 0, W / 2 + 90, 0);
  nG.addColorStop(0, "#fff"); nG.addColorStop(0.45, "#e8ddff"); nG.addColorStop(1, "#d4af37");
  ctx.fillStyle = nG;
  ctx.fillText(char.name.slice(0, 26) + (char.name.length > 26 ? "\u2026" : ""), W / 2, TY);

  /* Creator */
  ctx.font = "9.5px Arial"; ctx.fillStyle = "rgba(167,139,250,0.45)";
  ctx.fillText(`b\u1edfi ${creatorName}`, W / 2, TY + 17);

  /* Slogan */
  ctx.font = "italic 11px Arial"; ctx.fillStyle = "rgba(196,181,253,0.88)";
  const sfull = `\u201C${char.slogan}\u201D`;
  const sshort = ctx.measureText(sfull).width > W - 64 ? sfull.slice(0, 40) + "\u2026\u201D" : sfull;
  ctx.fillText(sshort, W / 2, TY + 35);

  /* Tags */
  const tags = (char.tags || []).slice(0, 4);
  const tagY = TY + 52, tagH = 18;
  if (tags.length > 0) {
    ctx.font = "bold 9px Arial";
    const ms = tags.map(t => ({ t, w: Math.ceil(ctx.measureText(t).width) + 15 }));
    const tw = ms.reduce((s, m) => s + m.w + 5, -5);
    let tx = (W - Math.min(tw, W - 50)) / 2;
    ms.forEach(({ t, w }) => {
      if (tx + w > W - pm - 6) return; /* không tràn khung */
      const hot = t.includes("18+") || t === "B\u1ea1o l\u1ef1c";
      ctx.fillStyle = hot ? "rgba(239,68,68,0.20)" : "rgba(108,92,231,0.22)";
      rr(ctx, tx, tagY, w, tagH, 9); ctx.fill();
      ctx.strokeStyle = hot ? "rgba(239,68,68,0.55)" : "rgba(108,92,231,0.6)";
      ctx.lineWidth = 0.75; rr(ctx, tx, tagY, w, tagH, 9); ctx.stroke();
      ctx.fillStyle = hot ? "#f87171" : "#c4b5fd";
      ctx.textAlign = "center"; ctx.fillText(t, tx + w / 2, tagY + 12.5);
      tx += w + 5;
    });
  }

  /* ═══════════════════════════════════════════════════════════
     9. DIVIDER + PERSONALITY
  ═══════════════════════════════════════════════════════════ */
  const divY2 = tagY + (tags.length ? 28 : 8);
  {
    const dg = ctx.createLinearGradient(35, divY2, W - 35, divY2);
    dg.addColorStop(0, "transparent"); dg.addColorStop(0.35, "rgba(212,175,55,0.5)"); dg.addColorStop(0.65, "rgba(167,139,250,0.4)"); dg.addColorStop(1, "transparent");
    ctx.strokeStyle = dg; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(35, divY2); ctx.lineTo(W - 35, divY2); ctx.stroke();
    /* Glow dot tâm */
    const dpt = ctx.createRadialGradient(W / 2, divY2, 0, W / 2, divY2, 28);
    dpt.addColorStop(0, "rgba(212,175,55,0.30)"); dpt.addColorStop(1, "transparent");
    ctx.fillStyle = dpt; ctx.fillRect(W / 2 - 30, divY2 - 8, 60, 16);
  }

  /* Personality — 2 lines max để nhường chỗ QR */
  ctx.font = "10px Arial"; ctx.fillStyle = "rgba(255,255,255,0.44)"; ctx.textAlign = "left";
  const snip = char.personality.replace(/\n/g, " ").slice(0, 160);
  const snipWords = snip.split(" ");
  let sline = "", sly = divY2 + 14;
  let sLineCount = 0;
  for (const sw of snipWords) {
    const t = sline + (sline ? " " : "") + sw;
    if (ctx.measureText(t).width > W - 66) {
      ctx.fillText(sline, 33, sly); sline = sw; sly += 13; sLineCount++;
      if (sLineCount >= 2) { ctx.fillText(sline + "\u2026", 33, sly); sline = ""; break; }
    } else sline = t;
  }
  if (sline && sLineCount < 2) ctx.fillText(sline, 33, sly);

  /* ═══════════════════════════════════════════════════════════
     10. QR CODE — nền trắng · bo góc · hào quang · K badge
  ═══════════════════════════════════════════════════════════ */
  const QS = 98, QP = 10;                /* QR display size, padding */
  const QBW = QS + QP * 2, QBH = QS + QP * 2;  /* box 118×118 */
  const QBX = W / 2 - QBW / 2;
  const QBY = H - QBH - 22;             /* bottom-anchored, leave 22px for label */

  try {
    const qrDataUrl = await QRCode.toDataURL(code, {
      width: QS * 5,   /* 5× oversampling = 490px — rất sắc nét */
      margin: 2,        /* quiet zone rộng */
      color: { dark: "#000000ff", light: "#ffffffff" },
      errorCorrectionLevel: "H",
    });
    const qrImg = await loadImg(qrDataUrl);
    if (qrImg) {
      /* Hào quang vàng + tím phía sau box */
      const qg = ctx.createRadialGradient(W / 2, QBY + QBH / 2, 0, W / 2, QBY + QBH / 2, 80);
      qg.addColorStop(0, "rgba(212,175,55,0.22)"); qg.addColorStop(0.5, "rgba(108,92,231,0.14)"); qg.addColorStop(1, "transparent");
      ctx.fillStyle = qg; ctx.fillRect(QBX - 18, QBY - 18, QBW + 36, QBH + 36);

      /* Box trắng — tương phản tối đa để scanner đọc được */
      rr(ctx, QBX, QBY, QBW, QBH, 14);
      ctx.fillStyle = "#ffffff"; ctx.fill();

      /* Viền ngoài gradient vàng → tím */
      const qb = ctx.createLinearGradient(QBX, QBY, QBX + QBW, QBY + QBH);
      qb.addColorStop(0, "rgba(212,175,55,0.85)"); qb.addColorStop(0.5, "rgba(108,92,231,0.75)"); qb.addColorStop(1, "rgba(212,175,55,0.80)");
      rr(ctx, QBX, QBY, QBW, QBH, 14); ctx.strokeStyle = qb; ctx.lineWidth = 1.8; ctx.stroke();

      /* Vẽ QR KHÔNG clip, KHÔNG filter → scanner đọc 100% chắc chắn */
      ctx.drawImage(qrImg, QBX + QP, QBY + QP, QS, QS);

      /* K badge — góc trên phải bên ngoài box (không che data QR) */
      const KC = QBX + QBW + 1, KR_Y = QBY - 1, KR = 11;
      const kfill = ctx.createRadialGradient(KC - 1, KR_Y - 1, 0, KC, KR_Y, KR);
      kfill.addColorStop(0, "#fff8a0"); kfill.addColorStop(1, "#c8840a");
      /* Viền trắng tách biệt nền */
      ctx.fillStyle = "#0c0520"; ctx.beginPath(); ctx.arc(KC, KR_Y, KR + 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = kfill; ctx.beginPath(); ctx.arc(KC, KR_Y, KR, 0, Math.PI * 2); ctx.fill();
      ctx.font = "bold 11px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#1a0830"; ctx.fillText("K", KC, KR_Y);
      ctx.textBaseline = "alphabetic";
    }
  } catch { /* skip on error */ }

  /* ── Label dưới QR ── */
  ctx.font = "8.5px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(212,175,55,0.38)";
  ctx.fillText("Qu\u00e9t QR \u0111\u1ec3 tri\u1ec7u h\u1ed3i \u2022 KISMET", W / 2, H - 10);

  return canvas.toDataURL("image/png");
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
interface Props {
  character: Character;
  onClose: () => void;
  onChat: () => void;
  onEdit?: () => void;
  creatorName?: string;
  creatorRole?: UserRole;
  viewerEmail?: string;   /* email/uid của người đang xem — để tính quyền */
  onViewCreator?: () => void;
}

export default function CharacterProfile({ character, onClose, onChat, onEdit, creatorName = "KISMET", creatorRole, viewerEmail, onViewCreator }: Props) {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(() =>
    character.avatar?.startsWith("http") ? character.avatar : null
  );
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const code = encodeCharacter(character);

  /* Xác định quyền: chủ sở hữu = người tạo hoặc admin */
  /* viewerEmail có thể là uid hoặc email — so sánh cả hai */
  const isOwner = !!viewerEmail && (
    viewerEmail === character.createdBy ||
    viewerEmail === ADMIN_EMAIL
  );
  /* Note: viewerEmail được pass là uid (ưu tiên) hoặc email từ AllTab */

  const [shareMode, setShareMode] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const cardRef = useRef<HTMLImageElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/upload-avatar", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload thất bại");
      const data = await res.json() as { url: string };
      const url = data.url;
      setAvatarSrc(url);
      const { doc, updateDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      await updateDoc(doc(db, "characters", character.id), { avatar: url });
    } catch (err) {
      setAvatarError("Tải ảnh thất bại. Vui lòng thử lại.");
      console.error("Avatar upload error:", err);
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  const sections = parsePersonalitySections(character.personality);

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

          <div style={{ position: "relative", zIndex: 1, display: "inline-block" }}>
            <div style={{ width: 112, height: 112, borderRadius: "50%", background: avatarSrc ? "transparent" : "linear-gradient(135deg,#1a0a3e,#6c5ce7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 58, overflow: "hidden", border: "2.5px solid transparent", backgroundClip: "padding-box", boxShadow: "0 0 0 2.5px rgba(108,92,231,0.6), 0 0 0 5px rgba(212,175,55,0.25), 0 0 40px rgba(108,92,231,0.45), 0 0 80px rgba(108,92,231,0.15)" }}>
              {avatarUploading
                ? <Loader2 size={28} style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }} />
                : avatarSrc
                  ? <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : character.avatar}
            </div>
            {/* Camera icon — chỉ hiện với chủ sở hữu */}
            {isOwner && (
              <>
                <button
                  onClick={() => avatarFileRef.current?.click()}
                  title="Đổi ảnh đại diện"
                  disabled={avatarUploading}
                  style={{ position: "absolute", bottom: 4, right: 4, width: 30, height: 30, borderRadius: "50%", border: "2px solid #100d1a", background: "linear-gradient(135deg,#7c3aed,#6c5ce7)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: avatarUploading ? "not-allowed" : "pointer", padding: 0, boxShadow: "0 2px 8px rgba(108,92,231,0.5)", opacity: avatarUploading ? 0.5 : 1 }}>
                  <Camera size={14} />
                </button>
                <input ref={avatarFileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
              </>
            )}
          </div>

          {/* Upload Image button — visible call-to-action for owner */}
          {isOwner && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => { setAvatarError(null); avatarFileRef.current?.click(); }}
                disabled={avatarUploading}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 18px", borderRadius: 20, border: "1px solid rgba(108,92,231,0.5)", background: avatarUploading ? "rgba(108,92,231,0.08)" : "rgba(108,92,231,0.14)", color: "#c4b5fd", fontSize: 12, fontWeight: 700, cursor: avatarUploading ? "not-allowed" : "pointer", transition: "all 0.18s" }}>
                {avatarUploading
                  ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Đang tải lên...</>
                  : <><Camera size={13} /> Upload Image</>}
              </button>
              {avatarError && (
                <span style={{ fontSize: 11, color: "#f87171" }}>{avatarError}</span>
              )}
            </div>
          )}

          {/* ── Name + Tags: Smoke Glow Zone ── */}
          <div style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* Smoke blob A — golden */}
            <div style={{ position: "absolute", top: "-30%", left: "5%", width: "50%", height: "130%", background: "radial-gradient(ellipse, rgba(212,175,55,0.11) 0%, transparent 70%)", filter: "blur(22px)", animation: "smokeDriftA 7s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }} />
            {/* Smoke blob B — violet */}
            <div style={{ position: "absolute", top: "-20%", right: "5%", width: "50%", height: "120%", background: "radial-gradient(ellipse, rgba(108,92,231,0.14) 0%, transparent 70%)", filter: "blur(18px)", animation: "smokeDriftB 9s ease-in-out 2s infinite", pointerEvents: "none", zIndex: 0 }} />

          <h2 style={{ position: "relative", zIndex: 1, fontSize: 22, fontWeight: 900, color: "#fff", marginTop: isOwner ? 8 : 14, marginBottom: 3, textAlign: "center", textShadow: "0 0 24px rgba(108,92,231,0.6)" }}>
            {character.name}
          </h2>
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 10, justifyContent: "center" }}>
            <span style={{ fontSize: 11, color: "rgba(167,139,250,0.4)" }}>Tạo bởi</span>
            {onViewCreator ? (
              <button onClick={onViewCreator} style={{ all: "unset", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#a78bfa", textDecoration: "underline", textDecorationColor: "rgba(167,139,250,0.3)", textUnderlineOffset: "2px", transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#c4b5fd")}
                onMouseLeave={e => (e.currentTarget.style.color = "#a78bfa")}>
                {creatorName}
              </button>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(167,139,250,0.55)" }}>{creatorName}</span>
            )}
            <UserBadge role={creatorRole || "hanhkhach"} size="sm" />
            {isOwner && onEdit && (
              <button onClick={onEdit} style={{ all: "unset", cursor: "pointer", marginLeft: 4, fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 10, background: "rgba(108,92,231,0.15)", border: "1px solid rgba(108,92,231,0.35)", color: "#a78bfa", letterSpacing: "0.04em" }}>
                Chỉnh sửa
              </button>
            )}
          </div>

          <div style={{ position: "relative", zIndex: 1, padding: "7px 20px", borderRadius: 20, background: "rgba(108,92,231,0.1)", border: "1px solid rgba(108,92,231,0.28)", marginBottom: 16, maxWidth: "88%", textAlign: "center" }}>
            <p style={{ color: "#c4b5fd", fontSize: 13, fontStyle: "italic", lineHeight: 1.5 }}>"{character.slogan}"</p>
          </div>

          {character.tags && character.tags.length > 0 && (
            <div style={{ position: "relative", zIndex: 1, display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", marginBottom: 20 }}>
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
          </div>{/* ── end smoke wrapper ── */}

          {character.isPublic && (
            <span style={{ fontSize: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399", borderRadius: 20, padding: "3px 12px", fontWeight: 600, marginBottom: 16 }}>
              ✦ Nhân vật công khai
            </span>
          )}
        </div>

        {/* ══════════════════════════════════════════════
            CHỦ SỞ HỮU: badge + full sections
        ══════════════════════════════════════════════ */}
        {isOwner && (
          <div style={{ margin: "0 18px 14px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.22)", marginBottom: 14 }}>
              <Lock size={10} style={{ color: "#34d399" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#34d399", letterSpacing: "0.06em", textTransform: "uppercase" }}>Chế độ Sáng tạo — Toàn quyền truy cập</span>
            </div>

            {/* Background / Linh hồn — chỉ owner */}
            {sections.background.length > 0 && (
              <div style={{ position: "relative", marginBottom: 12 }}>
                <div style={{ position: "absolute", inset: -8, borderRadius: 22, background: "radial-gradient(ellipse at 50% 0%, rgba(52,211,153,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
                <div style={{ position: "relative", padding: "15px 16px", borderRadius: 16, background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.14)", backdropFilter: "blur(10px)" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(52,211,153,0.55)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                    <Lock size={9} /> Linh Hồn &amp; Thế Giới — Riêng tư
                  </p>
                  <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.72, whiteSpace: "pre-line" }}>{sections.background}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            NGOẠI HÌNH — hiện cho tất cả, glassmorphism vàng
        ══════════════════════════════════════════════ */}
        {sections.appearance.length > 0 && (
          <div style={{ margin: `${isOwner ? "0" : "4px"} 18px 14px`, position: "relative" }}>
            {/* Hào quang vàng lan rộng */}
            <div style={{ position: "absolute", inset: -14, borderRadius: 28, background: "radial-gradient(ellipse at 50% 50%, rgba(212,175,55,0.28) 0%, rgba(212,175,55,0.06) 50%, transparent 78%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "absolute", inset: -2, borderRadius: 22, background: "linear-gradient(135deg, rgba(212,175,55,0.60) 0%, rgba(196,181,253,0.25) 50%, rgba(212,175,55,0.60) 100%)", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, padding: "20px 20px", borderRadius: 20, background: "linear-gradient(155deg, rgba(28,20,54,0.96) 0%, rgba(14,9,28,0.98) 100%)", backdropFilter: "blur(18px)" }}>
              {/* Sparkle field — vàng rực */}
              <div style={{ position: "absolute", inset: 0, borderRadius: 20, overflow: "hidden", pointerEvents: "none" }}>
                {[
                  { t: "10%", l: "6%",  sz: 3.5, d: "0s",    c: "#f0d060" },
                  { t: "80%", l: "12%", sz: 2.5, d: "0.7s",  c: "#d4af37" },
                  { t: "20%", l: "90%", sz: 3,   d: "1.3s",  c: "#fff8a0" },
                  { t: "60%", l: "85%", sz: 2,   d: "0.4s",  c: "#f0d060" },
                  { t: "50%", l: "48%", sz: 2,   d: "1.8s",  c: "#fff8a0" },
                  { t: "90%", l: "58%", sz: 2.5, d: "2.2s",  c: "#d4af37" },
                  { t: "8%",  l: "42%", sz: 2,   d: "0.9s",  c: "#a78bfa" },
                  { t: "35%", l: "3%",  sz: 1.5, d: "1.6s",  c: "#f0d060" },
                  { t: "70%", l: "96%", sz: 1.5, d: "2.7s",  c: "#d4af37" },
                ].map((s, i) => (
                  <div key={i} style={{ position: "absolute", top: s.t, left: s.l, width: s.sz, height: s.sz, borderRadius: "50%", background: s.c, boxShadow: `0 0 ${s.sz * 4}px 1px ${s.c}`, animation: `profileSparkle 2.4s ease-in-out ${s.d} infinite` }} />
                ))}
              </div>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, rgba(212,175,55,0.3), rgba(212,175,55,0.08))", border: "1.5px solid rgba(212,175,55,0.55)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>✨</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 900, color: "#d4af37", letterSpacing: "0.1em", textTransform: "uppercase" }}>Ngoại Hình</p>
                  <p style={{ fontSize: 9.5, color: "rgba(212,175,55,0.38)", marginTop: 1 }}>Diện mạo &amp; hình thể</p>
                </div>
                <div style={{ height: 1, width: 60, background: "linear-gradient(90deg, rgba(212,175,55,0.5) 0%, transparent 100%)" }} />
              </div>

              {/* Text kiểu tiểu thuyết */}
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.88)", lineHeight: 1.85, whiteSpace: "pre-line", fontStyle: "italic", textShadow: "0 0 20px rgba(212,175,55,0.12)", letterSpacing: "0.01em" }}>
                {sections.appearance}
              </p>

              {/* Bottom accent */}
              <div style={{ marginTop: 14, height: 1, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.3) 40%, rgba(212,175,55,0.3) 60%, transparent)" }} />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TÍNH CÁCH — hiện cho tất cả, glassmorphism tím
        ══════════════════════════════════════════════ */}
        {sections.traits.length > 0 && (
          <div style={{ margin: "0 18px 14px", position: "relative" }}>
            {/* Hào quang tím lan rộng */}
            <div style={{ position: "absolute", inset: -14, borderRadius: 28, background: "radial-gradient(ellipse at 50% 50%, rgba(147,51,234,0.28) 0%, rgba(108,92,231,0.08) 50%, transparent 78%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "absolute", inset: -2, borderRadius: 22, background: "linear-gradient(135deg, rgba(167,139,250,0.55) 0%, rgba(212,175,55,0.22) 50%, rgba(147,51,234,0.55) 100%)", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, padding: "20px 20px", borderRadius: 20, background: "linear-gradient(155deg, rgba(22,12,50,0.97) 0%, rgba(10,6,26,0.99) 100%)", backdropFilter: "blur(18px)" }}>
              {/* Sparkle field — tím rực */}
              <div style={{ position: "absolute", inset: 0, borderRadius: 20, overflow: "hidden", pointerEvents: "none" }}>
                {[
                  { t: "14%", l: "92%", sz: 3,   d: "0.3s",  c: "#c4b5fd" },
                  { t: "72%", l: "5%",  sz: 2.5, d: "1.1s",  c: "#a78bfa" },
                  { t: "38%", l: "94%", sz: 2,   d: "2s",    c: "#d4af37" },
                  { t: "88%", l: "75%", sz: 2.5, d: "0.6s",  c: "#c4b5fd" },
                  { t: "6%",  l: "58%", sz: 2,   d: "1.5s",  c: "#a78bfa" },
                  { t: "52%", l: "18%", sz: 2,   d: "2.5s",  c: "#d4af37" },
                  { t: "25%", l: "2%",  sz: 1.5, d: "0.8s",  c: "#c4b5fd" },
                  { t: "95%", l: "30%", sz: 1.5, d: "3s",    c: "#a78bfa" },
                ].map((s, i) => (
                  <div key={i} style={{ position: "absolute", top: s.t, left: s.l, width: s.sz, height: s.sz, borderRadius: "50%", background: s.c, boxShadow: `0 0 ${s.sz * 4}px 1px ${s.c}`, animation: `profileSparkle 2.8s ease-in-out ${s.d} infinite` }} />
                ))}
              </div>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(108,92,231,0.08))", border: "1.5px solid rgba(167,139,250,0.55)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🔮</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 900, color: "#a78bfa", letterSpacing: "0.1em", textTransform: "uppercase" }}>Tính Cách</p>
                  <p style={{ fontSize: 9.5, color: "rgba(167,139,250,0.38)", marginTop: 1 }}>Bản ngã &amp; tâm hồn</p>
                </div>
                <div style={{ height: 1, width: 60, background: "linear-gradient(90deg, rgba(167,139,250,0.5) 0%, transparent 100%)" }} />
              </div>

              {/* Text kiểu tiểu thuyết */}
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.88)", lineHeight: 1.85, whiteSpace: "pre-line", fontStyle: "italic", textShadow: "0 0 20px rgba(108,92,231,0.12)", letterSpacing: "0.01em" }}>
                {sections.traits}
              </p>

              {/* Bottom accent */}
              <div style={{ marginTop: 14, height: 1, background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.3) 40%, rgba(167,139,250,0.3) 60%, transparent)" }} />
            </div>
          </div>
        )}

        {/* ══ PRIVACY NOTICE — viewer không phải owner, character công khai ══ */}
        {!isOwner && character.isPublic && (sections.appearance || sections.traits) && (
          <div style={{ margin: "0 18px 14px", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 12, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <Lock size={11} style={{ color: "rgba(167,139,250,0.35)", flexShrink: 0 }} />
            <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.25)", lineHeight: 1.5 }}>
              Thông tin vận hành bị ẩn bởi người tạo · Chỉ Ngoại hình &amp; Tính cách được chia sẻ
            </p>
          </div>
        )}

        {/* ══ FALLBACK — nhân vật cũ không có sections ══ */}
        {!sections.appearance && !sections.traits && !sections.background && (
          <div style={{ margin: "4px 18px 14px", padding: "16px", borderRadius: 16, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(108,92,231,0.12)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(167,139,250,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>⊹ Linh Hồn</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>Chưa có thông tin hồ sơ.</p>
          </div>
        )}

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

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        @keyframes profileSparkle {
          0%,100% { opacity: 0.15; transform: scale(0.7); }
          50%      { opacity: 1;    transform: scale(1.6); }
        }
        @keyframes smokeDriftA {
          0%,100% { transform:translate(0px,0px) scale(1); opacity:0.5; }
          50%      { transform:translate(16px,-6px) scale(1.12); opacity:0.88; }
        }
        @keyframes smokeDriftB {
          0%,100% { transform:translate(0px,0px) scale(1); opacity:0.4; }
          50%      { transform:translate(-13px,9px) scale(1.09); opacity:0.78; }
        }
      `}</style>
    </div>
  );
}
