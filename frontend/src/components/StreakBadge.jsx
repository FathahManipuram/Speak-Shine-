export default function StreakBadge({ badge, compact = false, locked = false }) {
  if (!badge) return null;
  return (
    <span title={`${badge.name} · ${badge.days} day streak`} style={{
      display: "inline-flex", alignItems: "center", gap: "0.25rem",
      padding: compact ? "0.12rem 0.4rem" : "0.3rem 0.55rem",
      borderRadius: 999, fontSize: compact ? "0.68rem" : "0.75rem", fontWeight: 700,
      color: locked ? "var(--muted)" : badge.color, background: locked ? "rgba(148,163,184,0.08)" : `${badge.color}18`, border: `1px solid ${locked ? "rgba(148,163,184,0.25)" : `${badge.color}55`}`,
      whiteSpace: "nowrap", ...(badge.animated ? { animation: "badge-rainbow 2.5s linear infinite" } : {}),
    }}>
      {locked ? "🔒" : badge.icon} {compact ? badge.name : `${badge.name} · ${badge.days}d`}
    </span>
  );
}
