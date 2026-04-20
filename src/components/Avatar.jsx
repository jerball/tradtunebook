export function Avatar({ profile, size = "md" }) {
  if (!profile) return null;
  const cls = `avatar ${size === "sm" ? "avatar-sm" : size === "lg" ? "avatar-lg" : ""}`;
  const initial = (profile.displayName || "?")[0].toUpperCase();
  return (
    <span
      className={cls}
      style={{ background: profile.color || "#7a7568" }}
      title={profile.displayName}
    >
      {initial}
    </span>
  );
}

export function AvatarStack({ profiles, max = 4 }) {
  if (!profiles || profiles.length === 0) return null;
  const shown = profiles.slice(0, max);
  const overflow = profiles.length - shown.length;
  return (
    <span className="avatars-row">
      {shown.map((p) => (
        <Avatar key={p.id ?? p.userId} profile={p} size="sm" />
      ))}
      {overflow > 0 && <span className="avatar-more">+{overflow}</span>}
    </span>
  );
}
