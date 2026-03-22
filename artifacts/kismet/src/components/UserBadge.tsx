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
    label: "Admin",
    icon: "👑",
    color: "#f0cc6e",
    bg: "rgba(212,175,55,0.12)",
    border: "rgba(212,175,55,0.52)",
    glow: "0 0 5px rgba(212,175,55,0.7), 0 0 12px rgba(212,175,55,0.38), 0 0 22px rgba(212,175,55,0.18)",
  },
  writer: {
    label: "Writer",
    icon: "✍️",
    color: "#c4b5fd",
    bg: "rgba(109,40,217,0.16)",
    border: "rgba(139,92,246,0.5)",
    glow: "0 0 5px rgba(139,92,246,0.6), 0 0 12px rgba(109,40,217,0.3)",
  },
  vip: {
    label: "VIP",
    icon: "💎",
    color: "#93c5fd",
    bg: "rgba(37,99,235,0.13)",
    border: "rgba(96,165,250,0.5)",
    glow: "0 0 5px rgba(96,165,250,0.6), 0 0 12px rgba(37,99,235,0.3)",
  },
  mod: {
    label: "Mod",
    icon: "🛡️",
    color: "#6ee7b7",
    bg: "rgba(5,150,105,0.13)",
    border: "rgba(52,211,153,0.5)",
    glow: "0 0 5px rgba(52,211,153,0.6), 0 0 12px rgba(5,150,105,0.3)",
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
      padding: md ? "3px 10px 3px 7px" : "1px 7px 1px 5px",
      borderRadius: 20,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.color,
      fontSize: md ? 10.5 : 9,
      fontWeight: 700,
      letterSpacing: "0.04em",
      boxShadow: cfg.glow,
      whiteSpace: "nowrap",
      flexShrink: 0,
      userSelect: "none",
    }}>
      <span style={{ fontSize: md ? 12 : 10, lineHeight: 1 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
