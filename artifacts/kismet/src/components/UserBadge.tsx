export type UserRole = "admin" | "writer" | "vip" | "mod";

interface BadgeConfig {
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
}

const BADGE_CONFIG: Record<UserRole, BadgeConfig> = {
  admin: {
    label: "ADMIN",
    icon: "👑",
    color: "#d4af37",
    bg: "rgba(212,175,55,0.13)",
    border: "rgba(212,175,55,0.55)",
    glow: "0 0 6px rgba(212,175,55,0.65), 0 0 14px rgba(212,175,55,0.35)",
  },
  writer: {
    label: "WRITER",
    icon: "✍️",
    color: "#c4b5fd",
    bg: "rgba(109,40,217,0.18)",
    border: "rgba(139,92,246,0.55)",
    glow: "0 0 6px rgba(139,92,246,0.65), 0 0 14px rgba(109,40,217,0.35)",
  },
  vip: {
    label: "VIP",
    icon: "💎",
    color: "#93c5fd",
    bg: "rgba(37,99,235,0.14)",
    border: "rgba(96,165,250,0.55)",
    glow: "0 0 6px rgba(96,165,250,0.65), 0 0 14px rgba(37,99,235,0.35)",
  },
  mod: {
    label: "MOD",
    icon: "🛡️",
    color: "#6ee7b7",
    bg: "rgba(5,150,105,0.14)",
    border: "rgba(52,211,153,0.55)",
    glow: "0 0 6px rgba(52,211,153,0.65), 0 0 14px rgba(5,150,105,0.35)",
  },
};

export function UserBadge({ role, size = "sm" }: { role: UserRole; size?: "sm" | "md" }) {
  const cfg = BADGE_CONFIG[role];
  const md = size === "md";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: md ? 4 : 3,
      padding: md ? "3px 10px 3px 8px" : "1px 7px 1px 5px",
      borderRadius: 20,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.color,
      fontSize: md ? 11 : 9,
      fontWeight: 800,
      letterSpacing: "0.07em",
      boxShadow: cfg.glow,
      whiteSpace: "nowrap",
      flexShrink: 0,
      textTransform: "uppercase",
      userSelect: "none",
    }}>
      <span style={{ fontSize: md ? 13 : 10, lineHeight: 1 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
