export const TENDER_RESPONSE_STATUS = Object.freeze({
  MET: "met",
  GAP: "gap",
  PARTIAL: "partial",
  CONDITIONAL: "conditional",
  REVIEW: "review",
  NOT_APPLICABLE: "not_applicable",
});

export const TENDER_RESPONSE_BASIS = Object.freeze({
  BUSINESS_FACT: "business_fact",
  USER_STATEMENT: "user_statement",
  DOCUMENT: "document",
  FUTURE_COMMITMENT: "future_commitment",
});

const STATUS_SET = new Set(Object.values(TENDER_RESPONSE_STATUS));
const BASIS_SET = new Set(Object.values(TENDER_RESPONSE_BASIS));
const MAX_NOTE_LENGTH = 500;

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function validDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    ? value
    : null;
}

function legacyStatus(response) {
  if (response?.decision === "met" || response?.decision === "gap") return response.decision;
  return null;
}

export function normalizeTenderResponse(response) {
  if (!response || typeof response !== "object") return null;
  const responseStatus = STATUS_SET.has(response.response_status)
    ? response.response_status
    : legacyStatus(response);
  if (!responseStatus) return null;

  const responseBasis = BASIS_SET.has(response.response_basis)
    ? response.response_basis
    : response.decision
      ? TENDER_RESPONSE_BASIS.USER_STATEMENT
      : null;
  const reminderOn = responseStatus === TENDER_RESPONSE_STATUS.REVIEW
    ? validDateOnly(response.reminder_on ?? response.reminder_at)
    : null;

  return {
    response_status: responseStatus,
    response_basis: responseBasis,
    note: String(response.note ?? "").trim().slice(0, MAX_NOTE_LENGTH),
    reminder_on: reminderOn,
    reminder_sent_at: reminderOn ? validTimestamp(response.reminder_sent_at) : null,
    updated_at: validTimestamp(response.updated_at ?? response.reviewed_at),
    source: "user",
  };
}

export function reminderSentAtAfterDateChange(previousResponse, nextReminderOn) {
  return previousResponse?.reminder_on === nextReminderOn
    ? previousResponse?.reminder_sent_at ?? null
    : null;
}

export function normalizeTenderResponses(requirements, responses = {}, legacyManualReviews = {}) {
  const parentIds = new Set(
    (requirements ?? [])
      .map((requirement) => requirement.parent_requirement_id)
      .filter(Boolean),
  );
  const atomicIds = new Set(
    (requirements ?? [])
      .map((requirement) => requirement.requirement_id)
      .filter((id) => id && !parentIds.has(id)),
  );
  const normalized = {};

  for (const id of atomicIds) {
    const response = normalizeTenderResponse(responses?.[id] ?? legacyManualReviews?.[id]);
    if (response) normalized[id] = response;
  }

  return normalized;
}
