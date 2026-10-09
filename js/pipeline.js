import { CONFIG } from "./config.js";
import { supabase } from "./supabase.js";

const POLL_INTERVAL_MS = 10_000;
const CONFLICT_RETRY_MS = 1_200;
const MAX_WAIT_MS = 15 * 60_000;
export const EXTRACT_CONCURRENCY = 5;
const RETRYABLE_REGION_ERRORS = new Set(["extract_failed", "extract_timeout", "extract_schema_invalid", "invalid_model_json"]);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function accessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("תוקף החיבור פג. יש להתחבר מחדש.");
  return data.session.access_token;
}

export async function callPipelineStep(step, tenderId, extra = {}) {
  const token = await accessToken();
  const response = await fetch(`${CONFIG.apiBaseUrl}/api/tenderfit?step=${encodeURIComponent(step)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tender_id: tenderId, ...extra }),
  });
  const payload = await response.json().catch(() => ({
    ok: false,
    error: { code: "invalid_server_response", message: "השרת לא החזיר תשובה תקינה." },
  }));
  if (!response.ok || !payload.ok) {
    const error = new Error(payload.error?.message || "הבקשה נכשלה.");
    error.code = payload.error?.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function runUntilDone(step, tenderId, extra, onProgress) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_WAIT_MS) {
    try {
      const result = await callPipelineStep(step, tenderId, extra);
      onProgress?.({ step, state: result.status, data: result.data, elapsedMs: Date.now() - startedAt });
      if (result.status === "done") return result;
      await sleep(POLL_INTERVAL_MS);
    } catch (error) {
      if (error.status === 409 && ["step_conflict", "step_already_running", "region_already_running"].includes(error.code)) {
        await sleep(CONFLICT_RETRY_MS);
        continue;
      }
      throw error;
    }
  }
  throw new Error("העיבוד לא הסתיים בתוך 15 דקות.");
}

async function startUntilAccepted(step, tenderId, extra, onProgress) {
  while (true) {
    try {
      const result = await callPipelineStep(step, tenderId, extra);
      onProgress?.({ step, state: result.status, data: result.data, elapsedMs: 0, ...extra });
      return result;
    } catch (error) {
      if (error.status === 409 && ["step_conflict", "step_already_running", "region_already_running"].includes(error.code)) {
        await sleep(CONFLICT_RETRY_MS);
        continue;
      }
      throw error;
    }
  }
}

async function fetchTender(tenderId) {
  const { data, error } = await supabase.from("tenders").select("*").eq("id", tenderId).single();
  if (error) throw new Error("לא הצלחנו לקרוא את מצב המכרז.");
  return data;
}

async function runRegionQueue(tenderId, regions, onProgress) {
  let cursor = 0;
  let submissionLock = Promise.resolve();
  const lockedStart = (region) => {
    const next = submissionLock.then(() => startUntilAccepted("extract", tenderId, { region_id: region.region_id }, onProgress));
    submissionLock = next.catch(() => {});
    return next;
  };
  async function worker() {
    while (cursor < regions.length) {
      const region = regions[cursor++];
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const initial = await lockedStart(region);
          if (initial.status === "done") {
            onProgress?.({ step: "extract", state: "done", regionId: region.region_id, regionTitle: region.title, data: initial.data });
          } else {
            await runUntilDone("extract", tenderId, { region_id: region.region_id }, (event) => {
              onProgress?.({ ...event, regionId: region.region_id, regionTitle: region.title });
            });
          }
          break;
        } catch (error) {
          if (attempt === 0 && RETRYABLE_REGION_ERRORS.has(error.code)) {
            onProgress?.({ step: "extract", state: "retrying", regionId: region.region_id, regionTitle: region.title });
            continue;
          }
          throw error;
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(EXTRACT_CONCURRENCY, regions.length) }, () => worker()));
}

export async function processTender(tenderId, onProgress) {
  localStorage.setItem("tenderfit.activeTender", tenderId);
  const startedAt = Date.now();
  onProgress?.({ step: "upload", state: "starting" });
  await runUntilDone("upload", tenderId, {}, onProgress);

  onProgress?.({ step: "map", state: "starting" });
  onProgress?.({ step: "metadata", state: "starting" });
  const mapInitial = await startUntilAccepted("map", tenderId, {}, onProgress);
  const metadataInitial = await startUntilAccepted("metadata", tenderId, {}, onProgress).catch((error) => ({ error }));
  const [mapResult, metadataResult] = await Promise.allSettled([
    mapInitial.status === "done" ? mapInitial : runUntilDone("map", tenderId, {}, onProgress),
    metadataInitial.error ? Promise.reject(metadataInitial.error) : metadataInitial.status === "done" ? metadataInitial : runUntilDone("metadata", tenderId, {}, onProgress),
  ]);
  if (mapResult.status === "rejected") throw mapResult.reason;
  if (metadataResult.status === "rejected") {
    onProgress?.({ step: "metadata", state: "failed", error: metadataResult.reason });
  }

  const tender = await fetchTender(tenderId);
  const regions = tender.regions?.regions ?? [];
  onProgress?.({ step: "extract", state: "starting", total: regions.length });
  await runRegionQueue(tenderId, regions, onProgress);
  onProgress?.({ step: "validate", state: "starting" });
  const validation = await runUntilDone("validate", tenderId, {}, onProgress);
  localStorage.removeItem("tenderfit.activeTender");
  return { tenderId, durationMs: Date.now() - startedAt, validation: validation.data };
}
