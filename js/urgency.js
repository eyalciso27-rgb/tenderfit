const DAY_MS = 24 * 60 * 60 * 1000;

export function calculateUrgency(deadline, now = new Date()) {
  if (!deadline || !Number.isFinite(Date.parse(deadline))) {
    return { level: "unknown", label: "מועד הגשה לא ידוע", days: null };
  }
  const due = new Date(deadline);
  const days = Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
  if (days < 0) return { level: "ended", label: "מועד ההגשה עבר", days };
  if (days <= 3) return { level: "high", label: "דחוף", days };
  if (days <= 7) return { level: "medium", label: "מתקרב", days };
  return { level: "low", label: "יש זמן", days };
}

export function formatDeadline(deadline) {
  if (!deadline || !Number.isFinite(Date.parse(deadline))) return "לא אותר";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(deadline));
}
