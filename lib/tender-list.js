import { checklistProgress } from "./checklist.js";
import { buildProcessingStatus } from "./processing-status.js";

const RESULT_KEYS = Object.freeze(["met", "gap", "review", "missing"]);

function finiteCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function deadlineTime(deadline) {
  const time = Date.parse(deadline);
  return Number.isFinite(time) ? time : null;
}

export function tenderListItem(tender, now = new Date()) {
  const deadline = deadlineTime(tender?.submission_deadline);
  const ended = deadline !== null && deadline < now.getTime();
  const results = tender?.results && typeof tender.results === "object" ? tender.results : {};
  const counts = Object.fromEntries(RESULT_KEYS.map((key) => [key, finiteCount(results.counts?.[key])]));
  const complianceValue = Number(results.compliance_percent);
  const compliancePercent = Number.isFinite(complianceValue)
    ? Math.max(0, Math.min(100, Math.round(complianceValue)))
    : null;
  const processing = buildProcessingStatus(tender?.processing);
  const hasResults = RESULT_KEYS.some((key) => counts[key] > 0) || compliancePercent !== null;
  let fitState = { level: "pending", icon: "…", label: "הניתוח בתהליך" };
  if (results.stale === true) fitState = { level: "stale", icon: "!", label: "נדרשת בדיקה מחדש" };
  else if (processing.complete && hasResults) fitState = { level: "ready", icon: "✓", label: "בדיקת ההתאמה הושלמה" };
  else if (!processing.working && hasResults) fitState = { level: "ready", icon: "✓", label: "תוצאות זמינות" };

  return {
    ...tender,
    ended,
    deadlineTime: deadline,
    counts,
    compliancePercent,
    fitState,
    checklistProgress: tender?.decision === "go" ? checklistProgress(tender?.checklist) : null,
  };
}

export function splitTenderList(tenders, now = new Date()) {
  const items = (Array.isArray(tenders) ? tenders : []).map((tender) => tenderListItem(tender, now));
  const byDeadline = (first, second) => {
    if (first.deadlineTime === null && second.deadlineTime === null) {
      return Date.parse(second.updated_at || 0) - Date.parse(first.updated_at || 0);
    }
    if (first.deadlineTime === null) return 1;
    if (second.deadlineTime === null) return -1;
    return first.deadlineTime - second.deadlineTime;
  };
  const active = items.filter((item) => !item.ended).sort(byDeadline);
  const ended = items.filter((item) => item.ended).sort((first, second) => byDeadline(second, first));
  return { active, ended };
}

export function landingPageForProfile(profile) {
  return typeof profile?.legal_name === "string" && profile.legal_name.trim()
    ? "tenders.html"
    : "profile.html";
}
