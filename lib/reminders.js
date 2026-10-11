function dateOnlyInTimeZone(now, timeZone) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function dayDifference(dateOnly, today) {
  const first = Date.parse(`${dateOnly}T00:00:00.000Z`);
  const second = Date.parse(`${today}T00:00:00.000Z`);
  return Number.isFinite(first) && Number.isFinite(second) ? Math.round((first - second) / 86_400_000) : null;
}

export function buildDueReminderEmails(
  tenders,
  { now = new Date(), timeZone = "Asia/Jerusalem", appUrl = "" } = {},
) {
  const today = dateOnlyInTimeZone(now, timeZone);
  const sentAt = now.toISOString();
  const emails = [];

  for (const tender of tenders ?? []) {
    const results = tender?.results && typeof tender.results === "object" ? tender.results : {};
    const responses = results.responses && typeof results.responses === "object" ? results.responses : {};
    const requirements = new Map((tender?.requirements ?? []).map((item) => [item.requirement_id, item]));
    const dueRequirementIds = Object.entries(responses)
      .filter(([, response]) => response?.response_status === "review"
        && typeof response.reminder_on === "string"
        && response.reminder_on <= today
        && !response.reminder_sent_at)
      .map(([requirementId]) => requirementId);

    const deadlineDate = typeof tender?.submission_deadline === "string"
      ? tender.submission_deadline.slice(0, 10)
      : null;
    const daysToDeadline = deadlineDate ? dayDifference(deadlineDate, today) : null;
    const deadlineDue = tender?.decision === "go"
      && daysToDeadline !== null
      && daysToDeadline >= 0
      && daysToDeadline <= 7;
    if (!deadlineDue && !dueRequirementIds.length) continue;

    const lines = [`מכרז: ${tender.title || "ללא שם"}`];
    if (deadlineDue) lines.push(`מועד ההגשה בעוד ${daysToDeadline} ימים: ${deadlineDate}`);
    if (dueRequirementIds.length) {
      lines.push("", "דרישות שהגיע מועד הבדיקה שלהן:");
      for (const requirementId of dueRequirementIds) {
        const requirement = requirements.get(requirementId);
        const response = responses[requirementId];
        lines.push(`• ${requirement?.requirement_text || requirementId}`);
        if (response.note) lines.push(`  הערה: ${response.note}`);
      }
    }
    if (appUrl) lines.push("", `${appUrl.replace(/\/$/, "")}/tender.html?id=${encodeURIComponent(tender.id)}`);

    const nextResults = structuredClone(results);
    nextResults.responses ??= {};
    for (const requirementId of dueRequirementIds) {
      nextResults.responses[requirementId] = {
        ...nextResults.responses[requirementId],
        reminder_sent_at: sentAt,
      };
    }

    emails.push({
      tender_id: tender.id,
      subject: `TenderFit — תזכורת: ${tender.title || "מכרז"}`,
      message: lines.join("\n"),
      needs_results_update: dueRequirementIds.length > 0,
      results: nextResults,
      updated_at: sentAt,
      due_requirement_ids: dueRequirementIds,
      deadline_due: deadlineDue,
    });
  }

  return emails;
}
