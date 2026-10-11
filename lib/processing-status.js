export const PROCESSING_PHASES = Object.freeze([
  { id: "upload", label: "מעלה את המסמך" },
  { id: "map", label: "ממפה אזורי דרישות" },
  { id: "extract", label: "מחלץ דרישות" },
  { id: "validate", label: "מאמת שלמות ומקור" },
  { id: "facts", label: "בודק נתונים חסרים" },
  { id: "compare", label: "מחשב התאמה" },
]);

const WORKING_STATUSES = new Set(["starting", "running", "waiting", "retrying"]);

function normalizedStatus(record) {
  const status = typeof record === "string" ? record : record?.status;
  if (status === "done") return "done";
  if (status === "failed") return "failed";
  if (WORKING_STATUSES.has(status)) return "working";
  return "pending";
}

function aggregateExtract(processing, validateStatus) {
  const regions = Object.values(processing?.regions ?? {});
  const total = regions.length;
  const completed = regions.filter((region) => normalizedStatus(region) === "done").length;
  const failed = regions.filter((region) => normalizedStatus(region) === "failed").length;
  const working = regions.filter((region) => normalizedStatus(region) === "working").length;
  let status = "pending";
  if (failed) status = "failed";
  else if (total && completed === total) status = "done";
  else if (working || completed) status = "working";
  else if (!total && validateStatus === "done") status = "done";
  return {
    status,
    completed,
    total,
    detail: total ? `אזור ${Math.min(total, completed + (working || failed ? 1 : 0))} מתוך ${total}` : null,
  };
}

function aggregateMapping(processing) {
  const steps = processing?.steps ?? {};
  const map = normalizedStatus(steps.map);
  const metadata = normalizedStatus(steps.metadata);
  if (map === "failed") return { status: "failed", metadataStatus: metadata };
  if (map === "working" || metadata === "working") return { status: "working", metadataStatus: metadata };
  if (map === "done") {
    const downstreamStarted = Object.keys(processing?.regions ?? {}).length > 0
      || normalizedStatus(steps.validate) !== "pending"
      || normalizedStatus(steps.compare) !== "pending";
    return { status: metadata === "pending" && !downstreamStarted ? "working" : "done", metadataStatus: metadata };
  }
  return { status: "pending", metadataStatus: metadata };
}

function factsStatus(compareRecord) {
  const compare = normalizedStatus(compareRecord);
  if (compare === "done" || compareRecord?.code_finished_at) return "done";
  if (compare === "working") return "working";
  if (compare === "failed") return "failed";
  return "pending";
}

export function buildProcessingStatus(processing = {}) {
  const steps = processing.steps ?? {};
  const mapping = aggregateMapping(processing);
  const validate = normalizedStatus(steps.validate);
  const extract = aggregateExtract(processing, validate);
  const statuses = {
    upload: normalizedStatus(steps.upload),
    map: mapping.status,
    extract: extract.status,
    validate,
    facts: factsStatus(steps.compare),
    compare: normalizedStatus(steps.compare),
  };
  const phases = PROCESSING_PHASES.map((phase) => ({
    ...phase,
    status: statuses[phase.id],
    detail: phase.id === "extract" ? extract.detail : null,
  }));
  const completed = phases.filter((phase) => phase.status === "done").length;
  const failedIndex = phases.findIndex((phase) => phase.status === "failed");
  const openIndex = phases.findIndex((phase) => phase.status !== "done");
  const activeIndex = failedIndex >= 0 ? failedIndex : openIndex >= 0 ? openIndex : phases.length - 1;
  const working = phases.some((phase) => phase.status === "working");
  return {
    phases,
    completed,
    total: phases.length,
    currentStep: phases.every((phase) => phase.status === "done") ? phases.length : activeIndex + 1,
    percent: Math.round((completed / phases.length) * 100),
    complete: phases.every((phase) => phase.status === "done"),
    incomplete: phases.some((phase) => phase.status !== "done"),
    working,
    regionProgress: { completed: extract.completed, total: extract.total },
    metadataStatus: mapping.metadataStatus,
  };
}

export function applyProcessingEvent(processing = {}, event = {}) {
  const next = structuredClone(processing ?? {});
  next.steps ??= {};
  next.regions ??= {};
  const eventStatus = event.state === "starting" || event.state === "retrying" ? "running" : event.state;
  if (event.step === "extract") {
    if (event.regionId) {
      if (!next.regions[event.regionId]) {
        const placeholder = Object.keys(next.regions).find((key) => /^region-\d+$/.test(key) && next.regions[key]?.status === "pending");
        if (placeholder) delete next.regions[placeholder];
      }
      next.regions[event.regionId] = { ...(next.regions[event.regionId] ?? {}), status: eventStatus };
    } else if (event.state === "starting" && Number(event.total) > 0 && !Object.keys(next.regions).length) {
      for (let index = 0; index < Number(event.total); index += 1) {
        next.regions[`region-${index + 1}`] = { status: "pending" };
      }
    }
  } else if (event.step === "facts") {
    next.steps.compare = { ...(next.steps.compare ?? {}), status: "running", phase: "code_comparison" };
  } else if (PROCESSING_PHASES.some((phase) => phase.id === event.step)) {
    next.steps[event.step] = { ...(next.steps[event.step] ?? {}), status: eventStatus };
  } else if (event.step === "metadata") {
    next.steps.metadata = { ...(next.steps.metadata ?? {}), status: eventStatus };
  }
  if (event.step === "compare" && event.data?.phase) next.steps.compare.phase = event.data.phase;
  if (event.step === "compare" && ["waiting", "done"].includes(eventStatus)) {
    next.steps.compare.code_finished_at ??= new Date().toISOString();
  }
  return next;
}
