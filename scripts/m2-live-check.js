import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { CONFIG } from "../js/config.js";

const API_BASE = process.env.M2_API_BASE ?? "https://tenderfit-dun.vercel.app";
const EMAIL = process.env.M2_TEST_EMAIL;
const PASSWORD = process.env.M2_TEST_PASSWORD;
const PDF_PATH = process.argv[2];
const K = 5;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!EMAIL || !PASSWORD || !PDF_PATH) throw new Error("M2_TEST_EMAIL, M2_TEST_PASSWORD and a PDF path are required.");
const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey, {
  auth: { autoRefreshToken: true, persistSession: false },
});
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (authError) throw authError;

let tenderId = process.env.M2_TENDER_ID;
if (!tenderId) {
  const bytes = await readFile(PDF_PATH);
  const pdfHash = createHash("sha256").update(bytes).digest("hex");
  const objectPath = `${auth.user.id}/${randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage.from("tender-pdfs").upload(objectPath, bytes, { contentType: "application/pdf" });
  if (uploadError) throw uploadError;
  const { data: inserted, error: insertError } = await supabase.from("tenders").insert({
    user_id: auth.user.id,
    title: path.basename(PDF_PATH, path.extname(PDF_PATH)),
    pdf_path: objectPath,
    pdf_hash: pdfHash,
    processing: { steps: {}, regions: {} },
    regions: { regions: [] },
  }).select("id").single();
  if (insertError) throw insertError;
  tenderId = inserted.id;
}
const startedAt = Date.now();
process.stdout.write(`TENDER ${tenderId}\n`);

async function request(step, extra = {}) {
  const response = await fetch(`${API_BASE}/api/tenderfit?step=${step}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tender_id: tenderId, ...extra }),
  });
  const body = await response.json();
  if (!response.ok || !body.ok) {
    const error = new Error(`${step}: ${body.error?.code}: ${body.error?.message}`);
    error.status = response.status;
    error.code = body.error?.code;
    throw error;
  }
  return body;
}

async function untilDone(step, extra = {}) {
  while (true) {
    try {
      const result = await request(step, extra);
      process.stdout.write(`${new Date().toISOString()} ${step}${extra.region_id ? ` ${extra.region_id}` : ""} ${result.status}\n`);
      if (result.status === "done") return result;
      await sleep(10_000);
    } catch (error) {
      if (error.status === 409 && ["step_conflict", "step_already_running", "region_already_running"].includes(error.code)) {
        await sleep(1_500);
        continue;
      }
      throw error;
    }
  }
}

await untilDone("upload");
await request("map");
await request("metadata");
await Promise.all([untilDone("map"), untilDone("metadata").catch((error) => process.stdout.write(`METADATA_FAILED ${error.message}\n`))]);
const { data: mapped, error: mappedError } = await supabase.from("tenders").select("regions").eq("id", tenderId).single();
if (mappedError) throw mappedError;
const regions = mapped.regions?.regions ?? [];
let cursor = 0;
let submissionLock = Promise.resolve();
function startRegion(region) {
  const next = submissionLock.then(async () => {
    while (true) {
      try { return await request("extract", { region_id: region.region_id }); }
      catch (error) {
        if (error.status === 409 && error.code === "step_conflict") { await sleep(1_500); continue; }
        throw error;
      }
    }
  });
  submissionLock = next.catch(() => {});
  return next;
}
async function worker() {
  while (cursor < regions.length) {
    const region = regions[cursor++];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const initial = await startRegion(region);
        process.stdout.write(`${new Date().toISOString()} extract ${region.region_id} ${initial.status}\n`);
        if (initial.status !== "done") await untilDone("extract", { region_id: region.region_id });
        break;
      } catch (error) {
        if (attempt === 0 && ["extract_failed", "extract_timeout", "extract_schema_invalid", "invalid_model_json"].includes(error.code)) {
          process.stdout.write(`${new Date().toISOString()} extract ${region.region_id} retrying\n`);
          continue;
        }
        throw error;
      }
    }
  }
}
await Promise.all(Array.from({ length: Math.min(K, regions.length) }, () => worker()));
await untilDone("validate");

const { data: finalTender, error: finalError } = await supabase.from("tenders")
  .select("title,tender_number,requirements,dedup_log,ai_usage,processing,metadata")
  .eq("id", tenderId).single();
if (finalError) throw finalError;
const totalCost = (finalTender.ai_usage ?? []).reduce((sum, entry) => sum + Number(entry.estimated_cost_usd ?? 0), 0);
process.stdout.write(`${JSON.stringify({
  tender_id: tenderId,
  title: finalTender.title,
  tender_number: finalTender.tender_number,
  regions: regions.length,
  requirements: finalTender.requirements?.length ?? 0,
  dedup_events: finalTender.dedup_log?.length ?? 0,
  duration_ms: Date.now() - startedAt,
  estimated_cost_usd: totalCost,
  metadata_status: finalTender.processing?.steps?.metadata?.status,
})}\n`);
