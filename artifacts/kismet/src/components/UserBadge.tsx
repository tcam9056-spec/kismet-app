export type UserRole = "admin" | "writer" | "hanhkhach" | "vip" | "mod";

interface BadgeConfig {
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  smokeColor: string;
}

const BADGE_CONFIG: Record<UserRole, BadgeConfig> = {
  admin: {
    label: "Admin",
    icon: "👑",
    color: "#ffe066",
    bg: "rgba(212,175,55,0.15)",
    border: "rgba(255,215,0,0.7)",
    glow: "0 0 6px rgba(255,215,0,0.9), 0 0 14px rgba(212,175,55,0.6), 0 0 28px rgba(212,175,55,0.35), 0 0 50px rgba(180,130,0,0.2)",
    smokeColor: "rgba(212,175,55,",
  },
  writer: {
    label: "Writer",
    icon: "✍️",
    color: "#d8b4fe",
    bg: "rgba(88,28,135,0.22)",
    border: "rgba(139,92,246,0.6)",
    glow: "0 0 5px rgba(139,92,246,0.7), 0 0 12px rgba(109,40,217,0.45), 0 0 24px rgba(88,28,135,0.25), 0 0 44px rgba(80,20,120,0.15)",
    smokeColor: "rgba(120,120,140,",
  },
  hanhkhach: {
    label: "Hành Khách",
    icon: "🌙",
    color: "#d1d5db",
    bg: "rgba(156,163,175,0.12)",
    border: "rgba(209,213,219,0.45)",
    glow: "0 0 5px rgba(209,213,219,0.5), 0 0 12px rgba(156,163,175,0.3), 0 0 24px rgba(120,120,130,0.18)",
    smokeColor: "rgba(150,150,160,",
  },
  vip: {
    label: "VIP",
    icon: "💎",
    color: "#93c5fd",
    bg: "rgba(37,99,235,0.13)",
    border: "rgba(96,165,250,0.5)",
    glow: "0 0 5px rgba(96,165,250,0.6), 0 0 12px rgba(37,99,235,0.3)",
    smokeColor: "rgba(96,165,250,",
  },
  mod: {
    label: "Mod",
    icon: "🛡️",
    color: "#6ee7b7",
    bg: "rgba(5,150,105,0.13)",
    border: "rgba(52,211,153,0.5)",
    glow: "0 0 5px rgba(52,211,153,0.6), 0 0 12px rgba(5,150,105,0.3)",
    smokeColor: "rgba(52,211,153,",
  },
};

export function UserBadge({ role, size = "sm" }: { role: UserRole; size?: "sm" | "md" }) {
  const cfg = BADGE_CONFIG[role];
  const md = size === "md";
  const smoke = cfg.smokeColor;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: md ? 4 : 3,
      padding: md ? "4px 12px 4px 8px" : "2px 8px 2px 6px",
      borderRadius: 20,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.color,
      fontSize: md ? 10.5 : 9,
      fontWeight: 700,
      letterSpacing: "0.04em",
      boxShadow: `${cfg.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
      whiteSpace: "nowrap",
      flexShrink: 0,
      userSelect: "none",
      position: "relative",
      textShadow: `0 0 8px ${smoke}0.7)`,
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      animation: "badgePulse 3s ease-in-out infinite",
    }}>
      <span style={{ fontSize: md ? 12 : 10, lineHeight: 1, filter: `drop-shadow(0 0 4px ${smoke}0.8))` }}>{cfg.icon}</span>
      {cfg.label}
      <style>{`
        @keyframes badgePulse {
          0%,100% { opacity:1; }
          50% { opacity:0.85; }
        }
      `}</style>
    </span>
  );
}
