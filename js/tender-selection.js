export function findLatestCompletedTender(tenders) {
  if (!Array.isArray(tenders)) return null;
  return tenders.find((tender) => tender.processing?.steps?.compare?.status === "done") ?? null;
}
