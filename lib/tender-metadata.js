function cleanText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sourceOf(item) {
  const page = Number(item?.source_page);
  return {
    page: Number.isInteger(page) && page > 0 ? page : null,
    section: cleanText(item?.source_section),
    quote: cleanText(item?.source_quote),
  };
}

function normalizeDate(item, fallbackLabel = "מועד") {
  return {
    label: cleanText(item?.label) ?? fallbackLabel,
    iso: cleanText(item?.iso),
    source: sourceOf(item),
  };
}

export function normalizeTenderMetadata(metadata, fallbackDeadline = null) {
  const input = metadata && typeof metadata === "object" ? metadata : {};
  const dates = [];
  const submission = input.submission_deadline && typeof input.submission_deadline === "object"
    ? normalizeDate(input.submission_deadline, "מועד אחרון להגשה")
    : { label: "מועד אחרון להגשה", iso: cleanText(fallbackDeadline), source: { page: null, section: null, quote: null } };
  if (submission.iso || submission.source.page || submission.source.section || submission.source.quote) dates.push(submission);
  for (const item of Array.isArray(input.critical_dates) ? input.critical_dates : []) {
    const date = normalizeDate(item, "מועד קריטי");
    const duplicate = dates.some((existing) => existing.label === date.label && existing.iso === date.iso && existing.source.page === date.source.page);
    if (!duplicate) dates.push(date);
  }
  const guarantees = (Array.isArray(input.guarantees) ? input.guarantees : []).map((item) => ({
    type: cleanText(item?.type) ?? "ערבות",
    amount: cleanText(item?.amount),
    currency: cleanText(item?.currency),
    validUntil: cleanText(item?.valid_until),
    source: sourceOf(item),
  }));
  return {
    executiveSummary: cleanText(input.executive_summary),
    dates,
    guarantees,
    notes: (Array.isArray(input.notes) ? input.notes : []).map(cleanText).filter(Boolean),
  };
}
