export const STREAK_BADGES = [
  { id: "first-steps", days: 3, icon: "🌱", name: "First Steps", tier: "Green", color: "#4ade80" },
  { id: "consistent-speaker", days: 7, icon: "🔥", name: "Consistent Speaker", tier: "Bronze", color: "#cd7f32" },
  { id: "rising-communicator", days: 14, icon: "⭐", name: "Rising Communicator", tier: "Silver", color: "#cbd5e1" },
  { id: "dedicated-speaker", days: 30, icon: "💎", name: "Dedicated Speaker", tier: "Gold", color: "#facc15" },
  { id: "elite-communicator", days: 60, icon: "🚀", name: "Elite Communicator", tier: "Platinum", color: "#67e8f9" },
  { id: "speech-legend", days: 100, icon: "👑", name: "Speech Legend", tier: "Diamond", color: "#a78bfa" },
  { id: "hall-of-fame", days: 180, icon: "🏆", name: "Hall of Fame", tier: "Ruby", color: "#fb7185" },
  { id: "master-orator", days: 365, icon: "🌍", name: "Master Orator", tier: "Rainbow", color: "#f472b6", animated: true },
];

export function getStreakBadges(user = {}) {
  const earnedIds = new Set(user.earnedBadges || []);
  return STREAK_BADGES.filter(badge => earnedIds.has(badge.id) || (user.streak || 0) >= badge.days);
}

export function getCurrentStreakBadge(user = {}) {
  const earned = getStreakBadges(user);
  return earned[earned.length - 1] || null;
}

export function getNewStreakBadgeIds(streak, earnedBadges = []) {
  const earnedIds = new Set(earnedBadges);
  return STREAK_BADGES.filter(badge => streak >= badge.days && !earnedIds.has(badge.id)).map(badge => badge.id);
}

export function serializeStreakBadges(user = {}) {
  const currentBadge = getCurrentStreakBadge(user);
  const nextBadge = STREAK_BADGES.find(badge => (user.streak || 0) < badge.days);
  const startDays = currentBadge?.days || 0;
  const nextDays = nextBadge?.days || startDays;
  const streak = user.streak || 0;
  const span = nextDays - startDays;
  return {
    currentBadge,
    earnedBadges: getStreakBadges(user),
    nextBadge,
    badgeProgress: nextBadge
      ? {
          currentDays: streak,
          remainingDays: Math.max(0, nextDays - streak),
          percent: span > 0 ? Math.min(100, Math.max(0, ((streak - startDays) / span) * 100)) : 0,
        }
      : { currentDays: streak, remainingDays: 0, percent: 100 },
  };
}
