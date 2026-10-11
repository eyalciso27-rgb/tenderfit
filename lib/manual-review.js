import { RESULT_STATUS } from "./comparison.js";

export const MANUAL_REVIEW_DECISION = Object.freeze({
  MET: RESULT_STATUS.MET,
  GAP: RESULT_STATUS.GAP,
});

const ALLOWED_DECISIONS = new Set(Object.values(MANUAL_REVIEW_DECISION));
const MAX_NOTE_LENGTH = 500;

function normalizeReview(review) {
  if (!review || !ALLOWED_DECISIONS.has(review.decision)) return null;
  const note = String(review.note ?? "").trim().slice(0, MAX_NOTE_LENGTH);
  const reviewedAt = Number.isFinite(Date.parse(review.reviewed_at)) ? review.reviewed_at : null;
  return {
    decision: review.decision,
    note,
    reviewed_at: reviewedAt,
    source: "user",
  };
}

function manualExplanation(decision) {
  return decision === MANUAL_REVIEW_DECISION.MET
    ? "המשתמש אישר ידנית שהעסק עומד בדרישה."
    : "המשתמש קבע ידנית שהעסק אינו עומד בדרישה.";
}

export function applyManualReviews(requirements, automaticResults, reviews = {}) {
  const parentIds = new Set(
    (requirements ?? [])
      .map((requirement) => requirement.parent_requirement_id)
      .filter(Boolean),
  );
  const results = { ...automaticResults };
  const acceptedReviews = {};

  for (const requirement of requirements ?? []) {
    const id = requirement.requirement_id;
    const automatic = automaticResults?.[id];
    const review = normalizeReview(reviews?.[id]);
    const eligible = requirement.requirement_target === "business_fact"
      && !parentIds.has(id)
      && automatic?.status === RESULT_STATUS.REVIEW;
    if (!eligible || !review) continue;

    acceptedReviews[id] = review;
    results[id] = {
      ...automatic,
      status: review.decision,
      explanation: manualExplanation(review.decision),
      automatic_status: automatic.status,
      automatic_explanation: automatic.explanation,
      manual_review: review,
    };
  }

  return { results, manualReviews: acceptedReviews };
}
