import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import Ajv from "ajv";

import { loadExtractorBaseline, loadMapperBaseline, loadMetadataBaseline } from "../lib/baseline.js";
import { assertAiBudgetAvailable, BudgetExceededError } from "../lib/budget.js";
import { fillExtractorPrompt, getRegion, prefixRegionRequirementIds } from "../lib/extractor.js";
import { estimateGeminiCost } from "../lib/pricing.js";
import { conservativeDedup, prepareAjvSchema, validateRequirements } from "../lib/validate.js";

export const ALLOWED_STEPS = Object.freeze([
  "upload",
  "map",
  "metadata",
  "extract",
  "validate",
  "compare",
]);

const ALLOWED_STEP_SET = new Set(ALLOWED_STEPS);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const FILE_POLL_INTERVAL_MS = 2_000;
const FILE_PROCESSING_TIMEOUT_MS = 240_000;
const INTERACTION_TIMEOUT_MS = 15 * 60_000;
const PENDING_INTERACTION_STATUSES = new Set(["queued", "in_progress"]);

class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getHeader(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function setCorsHeaders(request, response) {
  const origin = getHeader(request, "origin");
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (origin && allowedOrigin && origin === allowedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }
}

function ensureAllowedOrigin(request) {
  const origin = getHeader(request, "origin");
  if (!origin) return;
  if (!process.env.ALLOWED_ORIGIN || origin !== process.env.ALLOWED_ORIGIN) {
    throw new ApiError(403, "origin_not_allowed", "מקור הבקשה אינו מורשה.");
  }
}

function sendSuccess(response, step, status, data, statusCode = 200) {
  return response.status(statusCode).json({ ok: true, step, status, data });
}

function sendError(response, step, statusCode, code, message) {
  return response.status(statusCode).json({
    ok: false,
    step: step ?? null,
    status: "failed",
    error: { code, message },
  });
}

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new ApiError(500, "server_not_configured", "השרת אינו מוגדר במלואו.");
  return value;
}

function readBearerToken(request) {
  const authorization = getHeader(request, "authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, "authentication_required", "נדרשת כניסה למערכת.");
  return match[1];
}

function createUserSupabaseClient(token) {
  return createClient(
    requireEnvironment("SUPABASE_URL"),
    requireEnvironment("SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
}

async function authenticate(request) {
  const token = readBearerToken(request);
  const supabase = createUserSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new ApiError(401, "invalid_token", "תוקף החיבור פג. יש להתחבר מחדש.");
  }
  return { supabase, user: data.user };
}

function requestBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      throw new ApiError(400, "invalid_json", "גוף הבקשה אינו JSON תקין.");
    }
  }
  return {};
}

function getTenderId(body) {
  const tenderId = body?.tender_id;
  if (!UUID_PATTERN.test(tenderId ?? "")) {
    throw new ApiError(400, "invalid_tender_id", "מזהה המכרז אינו תקין.");
  }
  return tenderId;
}

async function loadTender(supabase, tenderId) {
  const { data, error } = await supabase
    .from("tenders")
    .select("*")
    .eq("id", tenderId)
    .maybeSingle();

  if (error) throw new ApiError(500, "database_error", "לא הצלחנו לקרוא את נתוני המכרז.");
  if (!data) throw new ApiError(404, "tender_not_found", "המכרז לא נמצא.");
  return data;
}

function cloneProcessing(tender) {
  const processing = structuredClone(tender.processing ?? {});
  processing.steps ??= {};
  processing.regions ??= {};
  return processing;
}

function stepRecord(tender, step) {
  return tender.processing?.steps?.[step] ?? { status: "pending", attempts: 0, error: null };
}

function withStep(tender, step, changes) {
  const processing = cloneProcessing(tender);
  processing.steps[step] = { ...stepRecord(tender, step), ...changes };
  return processing;
}

function regionRecord(tender, regionId) {
  return tender.processing?.regions?.[regionId] ?? { status: "pending", attempts: 0, error: null };
}

function withRegion(tender, regionId, changes) {
  const processing = cloneProcessing(tender);
  processing.regions[regionId] = { ...regionRecord(tender, regionId), ...changes };
  return processing;
}

async function updateTender(supabase, tender, patch, conflictMessage = "השלב כבר עודכן בבקשה אחרת.") {
  const updatedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("tenders")
    .update({ ...patch, updated_at: updatedAt })
    .eq("id", tender.id)
    .eq("updated_at", tender.updated_at)
    .select("*")
    .maybeSingle();

  if (error) throw new ApiError(500, "database_error", "לא הצלחנו לשמור את סטטוס העיבוד.");
  if (!data) throw new ApiError(409, "step_conflict", conflictMessage);
  return data;
}

function createGeminiClient() {
  return new GoogleGenAI({ apiKey: requireEnvironment("GEMINI_API_KEY") });
}

function isUnexpiredActiveGeminiFile(tender) {
  const file = tender.gemini_file;
  if (!file || file.state !== "ACTIVE" || file.pdf_hash !== tender.pdf_hash) return false;
  const expiresAt = Date.parse(file.expires_at ?? "");
  return Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000;
}

async function waitForActiveFile(client, uploaded) {
  const startedAt = Date.now();
  let file = uploaded;
  while (file.state === "PROCESSING" || file.state === "STATE_UNSPECIFIED" || !file.state) {
    if (Date.now() - startedAt >= FILE_PROCESSING_TIMEOUT_MS) {
      throw new ApiError(502, "gemini_file_timeout", "הכנת המסמך ארכה מדי. אפשר לנסות שוב.");
    }
    await new Promise((resolve) => setTimeout(resolve, FILE_POLL_INTERVAL_MS));
    file = await client.files.get({ name: file.name });
  }
  if (file.state !== "ACTIVE") {
    throw new ApiError(502, "gemini_file_failed", "המסמך לא הוכן לעיבוד. אפשר לנסות שוב.");
  }
  return file;
}

async function markStepFailed(supabase, tender, step, code) {
  try {
    return await updateTender(supabase, tender, {
      processing: withStep(tender, step, {
        status: "failed",
        finished_at: new Date().toISOString(),
        error: code,
      }),
    });
  } catch {
    return tender;
  }
}

async function markRegionFailed(supabase, tender, regionId, code) {
  try {
    return await updateTender(supabase, tender, {
      processing: withRegion(tender, regionId, {
        status: "failed",
        finished_at: new Date().toISOString(),
        error: code,
      }),
    });
  } catch {
    return tender;
  }
}

async function downloadTenderPdf(supabase, tender) {
  const { data: sourceBlob, error } = await supabase.storage
    .from("tender-pdfs")
    .download(tender.pdf_path);
  if (error || !sourceBlob) {
    throw new ApiError(404, "pdf_not_found", "קובץ המכרז לא נמצא באחסון.");
  }
  if (sourceBlob.size > MAX_FILE_BYTES) {
    throw new ApiError(413, "pdf_too_large", "גודל הקובץ עולה על 50MB.");
  }

  const bytes = new Uint8Array(await sourceBlob.arrayBuffer());
  const signature = new TextDecoder("ascii").decode(bytes.subarray(0, 5));
  if (signature !== "%PDF-") {
    throw new ApiError(422, "invalid_pdf", "הקובץ אינו PDF תקין.");
  }

  return {
    bytes,
    fileSizeBytes: sourceBlob.size,
    pdfHash: createHash("sha256").update(bytes).digest("hex"),
  };
}

export function createInlinePdfDocument(bytes) {
  return {
    type: "document",
    data: Buffer.from(bytes).toString("base64"),
    mime_type: "application/pdf",
  };
}

async function runUpload(supabase, tender) {
  if (isUnexpiredActiveGeminiFile(tender)) {
    if (stepRecord(tender, "upload").status !== "done") {
      tender = await updateTender(supabase, tender, {
        processing: withStep(tender, "upload", {
          status: "done",
          finished_at: new Date().toISOString(),
          error: null,
        }),
      });
    }
    return {
      tender,
      data: {
        tender_id: tender.id,
        title: tender.title,
        pdf_hash: tender.pdf_hash,
        gemini_file: tender.gemini_file,
        reused: true,
      },
    };
  }

  const current = stepRecord(tender, "upload");
  if (current.status === "running") {
    throw new ApiError(409, "step_already_running", "העלאת המסמך כבר רצה.");
  }

  tender = await updateTender(supabase, tender, {
    processing: withStep(tender, "upload", {
      status: "running",
      started_at: new Date().toISOString(),
      finished_at: null,
      attempts: Number(current.attempts ?? 0) + 1,
      error: null,
    }),
  });

  try {
    const { bytes, fileSizeBytes, pdfHash } = await downloadTenderPdf(supabase, tender);
    const client = createGeminiClient();
    const uploaded = await client.files.upload({
      file: new Blob([bytes], { type: "application/pdf" }),
      config: { mimeType: "application/pdf", displayName: `${tender.id}.pdf` },
    });
    const activeFile = await waitForActiveFile(client, uploaded);
    const finishedAt = new Date().toISOString();
    const geminiFile = {
      uri: activeFile.uri,
      name: activeFile.name,
      mime_type: activeFile.mimeType ?? "application/pdf",
      state: activeFile.state,
      uploaded_at: activeFile.createTime ?? finishedAt,
      expires_at: activeFile.expirationTime,
      pdf_hash: pdfHash,
    };

    tender = await updateTender(supabase, tender, {
      pdf_hash: pdfHash,
      gemini_file: geminiFile,
      processing: withStep(tender, "upload", {
        status: "done",
        finished_at: finishedAt,
        error: null,
      }),
    });

    return {
      tender,
      data: {
        tender_id: tender.id,
        title: tender.title,
        pdf_hash: pdfHash,
        file_size_bytes: fileSizeBytes,
        gemini_file: geminiFile,
        reused: false,
      },
    };
  } catch (error) {
    await markStepFailed(supabase, tender, "upload", error.code ?? "upload_failed");
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "upload_failed", "העלאת המסמך לעיבוד נכשלה. אפשר לנסות שוב.");
  }
}

function appendUsage(tender, entry) {
  return [...(Array.isArray(tender.ai_usage) ? tender.ai_usage : []), entry];
}

function replaceUsage(tender, interactionId, replacement) {
  const usage = Array.isArray(tender.ai_usage) ? tender.ai_usage : [];
  let found = false;
  const next = usage.map((entry) => {
    if (entry?.interaction_id !== interactionId) return entry;
    found = true;
    return { ...entry, ...replacement };
  });
  return found ? next : [...next, replacement];
}

function buildRegionStatuses(regions) {
  return Object.fromEntries(
    regions.map((region) => [region.region_id, { status: "pending", attempts: 0, error: null }]),
  );
}

async function completeMap(supabase, tender, interaction, baseline) {
  let parsed;
  try {
    parsed = JSON.parse(interaction.output_text ?? "");
  } catch {
    throw new ApiError(502, "invalid_model_json", "פלט המיפוי לא היה JSON תקין.");
  }

  const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
  const validate = ajv.compile(prepareAjvSchema(baseline.schema));
  if (!validate(parsed)) {
    throw new ApiError(502, "mapper_schema_invalid", "פלט המיפוי לא תואם למבנה המאושר.");
  }

  const current = stepRecord(tender, "map");
  const sentAt = current.sent_at;
  const completedAt = new Date().toISOString();
  const usage = await estimateGeminiCost(interaction.usage);
  const usageEntry = {
    component: "mapper-v1.2",
    model: interaction.model ?? baseline.settings.model,
    interaction_id: interaction.id,
    status: "completed",
    sent_at: sentAt,
    completed_at: completedAt,
    duration_ms: Math.max(0, Date.now() - Date.parse(sentAt)),
    pdf_hash: tender.pdf_hash,
    ...usage,
  };
  const processing = cloneProcessing(tender);
  processing.steps.map = {
    ...current,
    status: "done",
    finished_at: completedAt,
    error: null,
  };
  processing.regions = buildRegionStatuses(parsed.regions);

  tender = await updateTender(supabase, tender, {
    regions: parsed,
    processing,
    ai_usage: replaceUsage(tender, interaction.id, usageEntry),
  });

  return {
    tender,
    data: {
      tender_id: tender.id,
      interaction_id: interaction.id,
      region_count: parsed.regions.length,
      duration_ms: usageEntry.duration_ms,
      usage,
      output: parsed,
    },
  };
}

async function failMapInteraction(supabase, tender, interaction, code, { invalidateGeminiFile = false } = {}) {
  const current = stepRecord(tender, "map");
  const completedAt = new Date().toISOString();
  const usageEntry = {
    component: "mapper-v1.2",
    model: interaction?.model ?? "gemini-3.1-pro-preview",
    interaction_id: interaction?.id ?? current.interaction_id,
    status: "failed",
    sent_at: current.sent_at,
    completed_at: completedAt,
    duration_ms: current.sent_at ? Math.max(0, Date.now() - Date.parse(current.sent_at)) : 0,
    estimated_cost_usd: 0,
    pdf_hash: tender.pdf_hash,
    error: code,
  };
  const interactionId = usageEntry.interaction_id;
  const patch = {
    processing: withStep(tender, "map", {
      status: "failed",
      finished_at: completedAt,
      error: code,
    }),
    ai_usage: replaceUsage(tender, interactionId, usageEntry),
  };
  if (invalidateGeminiFile) patch.gemini_file = {};
  return updateTender(supabase, tender, patch);
}

export function isGeminiBlobstoreFileError(error) {
  const message = [error?.message, error?.error?.message, error?.error?.error?.message]
    .filter(Boolean)
    .join(" ");
  return Number(error?.status) === 400 && /unsupported file uri:\s*blobstore:\/\//i.test(message);
}

async function pollMap(supabase, tender, baseline) {
  const current = stepRecord(tender, "map");
  if (!current.interaction_id || !current.sent_at) {
    throw new ApiError(500, "map_state_invalid", "סטטוס המיפוי אינו תקין.");
  }
  if (Date.now() - Date.parse(current.sent_at) >= INTERACTION_TIMEOUT_MS) {
    await failMapInteraction(supabase, tender, null, "mapper_timeout");
    throw new ApiError(502, "mapper_timeout", "המיפוי לא הסתיים בתוך 15 דקות. אפשר לנסות שוב.");
  }

  let interaction;
  try {
    interaction = await createGeminiClient().interactions.get(current.interaction_id);
  } catch (error) {
    if (!isGeminiBlobstoreFileError(error)) throw error;
    await failMapInteraction(supabase, tender, null, "gemini_file_reference_failed", {
      invalidateGeminiFile: true,
    });
    throw new ApiError(
      502,
      "gemini_file_reference_failed",
      "Gemini לא הצליח לקרוא את עותק המסמך. יש להעלות אותו שוב ולנסות מחדש.",
    );
  }
  if (PENDING_INTERACTION_STATUSES.has(interaction.status)) {
    return {
      tender,
      waiting: true,
      data: {
        tender_id: tender.id,
        interaction_id: interaction.id,
        interaction_status: interaction.status,
        sent_at: current.sent_at,
        elapsed_ms: Math.max(0, Date.now() - Date.parse(current.sent_at)),
      },
    };
  }
  if (interaction.status !== "completed") {
    await failMapInteraction(supabase, tender, interaction, `mapper_${interaction.status}`);
    throw new ApiError(502, "mapper_failed", "המיפוי נכשל. אפשר לנסות שוב.");
  }

  try {
    return await completeMap(supabase, tender, interaction, baseline);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 409) throw error;
    await failMapInteraction(supabase, tender, interaction, error.code ?? "mapper_output_failed");
    throw error;
  }
}

async function startMap(supabase, tender, baseline) {
  if (!isUnexpiredActiveGeminiFile(tender) || stepRecord(tender, "upload").status !== "done") {
    throw new ApiError(409, "upload_required", "יש להשלים את שלב העלאת המסמך לפני המיפוי.");
  }
  await assertAiBudgetAvailable(supabase, tender);

  const current = stepRecord(tender, "map");
  tender = await updateTender(supabase, tender, {
    processing: withStep(tender, "map", {
      status: "running",
      started_at: new Date().toISOString(),
      finished_at: null,
      attempts: Number(current.attempts ?? 0) + 1,
      error: null,
      interaction_id: null,
      sent_at: null,
    }),
  });

  try {
    const { bytes, pdfHash } = await downloadTenderPdf(supabase, tender);
    if (pdfHash !== tender.pdf_hash) {
      throw new ApiError(409, "pdf_changed", "קובץ המכרז השתנה. יש להריץ upload מחדש.");
    }
    const client = createGeminiClient();
    const interaction = await client.interactions.create({
      model: baseline.settings.model,
      system_instruction: baseline.systemInstruction,
      input: [
        createInlinePdfDocument(bytes),
        { type: "text", text: baseline.userPrompt },
      ],
      generation_config: {
        thinking_level: baseline.settings.thinking_level,
        temperature: baseline.settings.temperature,
      },
      response_format: [
        { type: "text", mime_type: "application/json", schema: baseline.schema },
      ],
      store: true,
      background: true,
    });
    const sentAt = new Date().toISOString();
    const usageEntry = {
      component: "mapper-v1.2",
      model: baseline.settings.model,
      interaction_id: interaction.id,
      status: "waiting",
      sent_at: sentAt,
      completed_at: null,
      duration_ms: null,
      estimated_cost_usd: 0,
      pdf_hash: tender.pdf_hash,
    };
    tender = await updateTender(supabase, tender, {
      processing: withStep(tender, "map", {
        status: "waiting",
        interaction_id: interaction.id,
        sent_at: sentAt,
        error: null,
      }),
      ai_usage: appendUsage(tender, usageEntry),
    });

    return {
      tender,
      waiting: true,
      data: {
        tender_id: tender.id,
        interaction_id: interaction.id,
        interaction_status: interaction.status,
        sent_at: sentAt,
        elapsed_ms: 0,
      },
    };
  } catch (error) {
    await markStepFailed(supabase, tender, "map", error.code ?? "mapper_submit_failed");
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "mapper_submit_failed", "שליחת המיפוי נכשלה. אפשר לנסות שוב.");
  }
}

async function runMap(supabase, tender) {
  const baseline = await loadMapperBaseline();
  const current = stepRecord(tender, "map");

  if (current.status === "done") {
    return {
      tender,
      data: {
        tender_id: tender.id,
        region_count: tender.regions?.regions?.length ?? 0,
        output: tender.regions,
        reused: true,
      },
    };
  }
  if (current.status === "waiting") return pollMap(supabase, tender, baseline);
  if (current.status === "running") {
    throw new ApiError(409, "step_already_running", "המיפוי כבר רץ.");
  }
  return startMap(supabase, tender, baseline);
}

function parseAndValidateModelJson(interaction, schema, errorCode, errorMessage) {
  let parsed;
  try {
    parsed = JSON.parse(interaction.output_text ?? "");
  } catch {
    throw new ApiError(502, "invalid_model_json", "פלט המודל לא היה JSON תקין.");
  }
  const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
  const validate = ajv.compile(prepareAjvSchema(schema));
  if (!validate(parsed)) {
    console.error("Model schema validation failed", {
      errorCode,
      errors: (validate.errors ?? []).map(({ instancePath, schemaPath, keyword, message }) => ({ instancePath, schemaPath, keyword, message })),
    });
    throw new ApiError(502, errorCode, errorMessage);
  }
  return parsed;
}

async function submitInteraction(supabase, tender, baseline, prompt) {
  const { bytes, pdfHash } = await downloadTenderPdf(supabase, tender);
  if (pdfHash !== tender.pdf_hash) {
    throw new ApiError(409, "pdf_changed", "קובץ המכרז השתנה. יש להריץ upload מחדש.");
  }
  return createGeminiClient().interactions.create({
    model: baseline.settings.model,
    system_instruction: baseline.systemInstruction,
    input: [createInlinePdfDocument(bytes), { type: "text", text: prompt }],
    generation_config: {
      thinking_level: baseline.settings.thinking_level,
      temperature: baseline.settings.temperature,
    },
    response_format: [{ type: "text", mime_type: "application/json", schema: baseline.schema }],
    store: true,
    background: true,
  });
}

function waitingData(tender, interaction, sentAt, extra = {}) {
  return {
    tender_id: tender.id,
    interaction_id: interaction.id,
    interaction_status: interaction.status,
    sent_at: sentAt,
    elapsed_ms: Math.max(0, Date.now() - Date.parse(sentAt)),
    ...extra,
  };
}

async function startMetadata(supabase, tender, baseline) {
  if (stepRecord(tender, "upload").status !== "done") {
    throw new ApiError(409, "upload_required", "יש להשלים את שלב העלאת המסמך לפני חילוץ הפרטים.");
  }
  await assertAiBudgetAvailable(supabase, tender);
  const current = stepRecord(tender, "metadata");
  tender = await updateTender(supabase, tender, {
    processing: withStep(tender, "metadata", {
      status: "running", started_at: new Date().toISOString(), finished_at: null,
      attempts: Number(current.attempts ?? 0) + 1, error: null, interaction_id: null, sent_at: null,
    }),
  });
  try {
    const interaction = await submitInteraction(supabase, tender, baseline, baseline.userPrompt);
    const sentAt = new Date().toISOString();
    tender = await updateTender(supabase, tender, {
      processing: withStep(tender, "metadata", { status: "waiting", interaction_id: interaction.id, sent_at: sentAt, error: null }),
      ai_usage: appendUsage(tender, {
        component: "metadata-f15-v1.0", model: baseline.settings.model, interaction_id: interaction.id,
        status: "waiting", sent_at: sentAt, completed_at: null, duration_ms: null,
        estimated_cost_usd: 0, pdf_hash: tender.pdf_hash,
      }),
    });
    return { tender, waiting: true, data: waitingData(tender, interaction, sentAt) };
  } catch (error) {
    await markStepFailed(supabase, tender, "metadata", error.code ?? "metadata_submit_failed");
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "metadata_submit_failed", "שליחת חילוץ פרטי המכרז נכשלה.");
  }
}

async function pollMetadata(supabase, tender, baseline) {
  const current = stepRecord(tender, "metadata");
  if (!current.interaction_id || !current.sent_at) throw new ApiError(500, "metadata_state_invalid", "סטטוס חילוץ הפרטים אינו תקין.");
  if (Date.now() - Date.parse(current.sent_at) >= INTERACTION_TIMEOUT_MS) {
    await markStepFailed(supabase, tender, "metadata", "metadata_timeout");
    throw new ApiError(502, "metadata_timeout", "חילוץ פרטי המכרז לא הסתיים בתוך 15 דקות.");
  }
  const interaction = await createGeminiClient().interactions.get(current.interaction_id);
  if (PENDING_INTERACTION_STATUSES.has(interaction.status)) {
    return { tender, waiting: true, data: waitingData(tender, interaction, current.sent_at) };
  }
  if (interaction.status !== "completed") {
    await markStepFailed(supabase, tender, "metadata", `metadata_${interaction.status}`);
    throw new ApiError(502, "metadata_failed", "חילוץ פרטי המכרז נכשל.");
  }
  try {
    const parsed = parseAndValidateModelJson(interaction, baseline.schema, "metadata_schema_invalid", "פרטי המכרז לא תאמו למבנה המאושר.");
    const completedAt = new Date().toISOString();
    const usage = await estimateGeminiCost(interaction.usage);
    const deadline = parsed.submission_deadline?.iso;
    const validDeadline = deadline && Number.isFinite(Date.parse(deadline)) ? new Date(deadline).toISOString() : null;
    const usageEntry = {
      component: "metadata-f15-v1.0", model: interaction.model ?? baseline.settings.model,
      interaction_id: interaction.id, status: "completed", sent_at: current.sent_at,
      completed_at: completedAt, duration_ms: Math.max(0, Date.now() - Date.parse(current.sent_at)),
      pdf_hash: tender.pdf_hash, ...usage,
    };
    tender = await updateTender(supabase, tender, {
      title: parsed.title || tender.title,
      tender_number: parsed.tender_number || tender.tender_number,
      publisher: parsed.publisher,
      submission_deadline: validDeadline,
      metadata: parsed,
      processing: withStep(tender, "metadata", { status: "done", finished_at: completedAt, error: null }),
      ai_usage: replaceUsage(tender, interaction.id, usageEntry),
    });
    return { tender, data: { tender_id: tender.id, duration_ms: usageEntry.duration_ms, usage, output: parsed } };
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 409) throw error;
    await markStepFailed(supabase, tender, "metadata", error.code ?? "metadata_output_failed");
    throw error;
  }
}

async function runMetadata(supabase, tender) {
  const baseline = await loadMetadataBaseline();
  const current = stepRecord(tender, "metadata");
  if (current.status === "done") return { tender, data: { tender_id: tender.id, output: tender.metadata, reused: true } };
  if (current.status === "waiting") return pollMetadata(supabase, tender, baseline);
  if (current.status === "running") throw new ApiError(409, "step_already_running", "חילוץ פרטי המכרז כבר רץ.");
  return startMetadata(supabase, tender, baseline);
}

function getRegionId(body) {
  const regionId = body?.region_id;
  if (typeof regionId !== "string" || regionId.length < 1 || regionId.length > 160 || !/^[\w.-]+$/u.test(regionId)) {
    throw new ApiError(400, "invalid_region_id", "מזהה האזור אינו תקין.");
  }
  return regionId;
}

async function startExtract(supabase, tender, region, baseline) {
  await assertAiBudgetAvailable(supabase, tender);
  const current = regionRecord(tender, region.region_id);
  if (!Number.isInteger(region.start_page) || !Number.isInteger(region.end_page)) {
    const completedAt = new Date().toISOString();
    const outputs = { ...(tender.region_outputs ?? {}), [region.region_id]: { requirements: [], skipped: true, review_reason: "אזור ללא גבולות עמודים." } };
    tender = await updateTender(supabase, tender, {
      region_outputs: outputs,
      processing: withRegion(tender, region.region_id, {
        status: "done", finished_at: completedAt, attempts: Number(current.attempts ?? 0) + 1,
        error: null, requires_manual_review: true,
      }),
    });
    return { tender, data: { tender_id: tender.id, region_id: region.region_id, skipped: true } };
  }
  tender = await updateTender(supabase, tender, {
    processing: withRegion(tender, region.region_id, {
      status: "running", started_at: new Date().toISOString(), finished_at: null,
      attempts: Number(current.attempts ?? 0) + 1, error: null, interaction_id: null, sent_at: null,
    }),
  });
  try {
    const prompt = fillExtractorPrompt(baseline.promptTemplate, region, baseline.regionContext);
    const interaction = await submitInteraction(supabase, tender, baseline, prompt);
    const sentAt = new Date().toISOString();
    tender = await updateTender(supabase, tender, {
      processing: withRegion(tender, region.region_id, { status: "waiting", interaction_id: interaction.id, sent_at: sentAt, error: null }),
      ai_usage: appendUsage(tender, {
        component: "extractor-v3.6", region_id: region.region_id, model: baseline.settings.model,
        interaction_id: interaction.id, status: "waiting", sent_at: sentAt, completed_at: null,
        duration_ms: null, estimated_cost_usd: 0, pdf_hash: tender.pdf_hash,
      }),
    });
    return { tender, waiting: true, data: waitingData(tender, interaction, sentAt, { region_id: region.region_id }) };
  } catch (error) {
    await markRegionFailed(supabase, tender, region.region_id, error.code ?? "extract_submit_failed");
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "extract_submit_failed", "שליחת חילוץ האזור נכשלה.");
  }
}

async function pollExtract(supabase, tender, region, baseline) {
  const current = regionRecord(tender, region.region_id);
  if (!current.interaction_id || !current.sent_at) throw new ApiError(500, "extract_state_invalid", "סטטוס חילוץ האזור אינו תקין.");
  if (Date.now() - Date.parse(current.sent_at) >= INTERACTION_TIMEOUT_MS) {
    await markRegionFailed(supabase, tender, region.region_id, "extract_timeout");
    throw new ApiError(502, "extract_timeout", "חילוץ האזור לא הסתיים בתוך 15 דקות.");
  }
  const interaction = await createGeminiClient().interactions.get(current.interaction_id);
  if (PENDING_INTERACTION_STATUSES.has(interaction.status)) {
    return { tender, waiting: true, data: waitingData(tender, interaction, current.sent_at, { region_id: region.region_id }) };
  }
  if (interaction.status !== "completed") {
    await markRegionFailed(supabase, tender, region.region_id, `extract_${interaction.status}`);
    throw new ApiError(502, "extract_failed", "חילוץ האזור נכשל.");
  }
  try {
    const parsed = parseAndValidateModelJson(interaction, baseline.schema, "extract_schema_invalid", "פלט חילוץ האזור לא תאם למבנה המאושר.");
    if (region.needs_manual_review || region.boundary_confidence === "low") {
      parsed.requirements = parsed.requirements.map((requirement) => ({
        ...requirement,
        requires_manual_review: true,
        review_reason: requirement.review_reason || region.review_reason || "גבולות האזור דורשים בדיקה ידנית.",
      }));
    }
    const completedAt = new Date().toISOString();
    const usage = await estimateGeminiCost(interaction.usage);
    const usageEntry = {
      component: "extractor-v3.6", region_id: region.region_id,
      model: interaction.model ?? baseline.settings.model, interaction_id: interaction.id,
      status: "completed", sent_at: current.sent_at, completed_at: completedAt,
      duration_ms: Math.max(0, Date.now() - Date.parse(current.sent_at)), pdf_hash: tender.pdf_hash, ...usage,
    };
    tender = await updateTender(supabase, tender, {
      region_outputs: { ...(tender.region_outputs ?? {}), [region.region_id]: parsed },
      processing: withRegion(tender, region.region_id, { status: "done", finished_at: completedAt, error: null }),
      ai_usage: replaceUsage(tender, interaction.id, usageEntry),
    });
    return { tender, data: { tender_id: tender.id, region_id: region.region_id, requirement_count: parsed.requirements.length, duration_ms: usageEntry.duration_ms, usage } };
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 409) throw error;
    await markRegionFailed(supabase, tender, region.region_id, error.code ?? "extract_output_failed");
    throw error;
  }
}

async function runExtract(supabase, tender, body) {
  if (stepRecord(tender, "map").status !== "done") throw new ApiError(409, "map_required", "יש להשלים מיפוי לפני חילוץ אזורים.");
  const regionId = getRegionId(body);
  const region = getRegion(tender.regions, regionId);
  if (!region) throw new ApiError(404, "region_not_found", "האזור לא נמצא במפת המכרז.");
  const current = regionRecord(tender, regionId);
  if (current.status === "done") return { tender, data: { tender_id: tender.id, region_id: regionId, output: tender.region_outputs?.[regionId], reused: true } };
  if (current.status === "waiting") return pollExtract(supabase, tender, region, await loadExtractorBaseline());
  if (current.status === "running") throw new ApiError(409, "region_already_running", "חילוץ האזור כבר רץ.");
  return startExtract(supabase, tender, region, await loadExtractorBaseline());
}

async function runValidate(supabase, tender) {
  const current = stepRecord(tender, "validate");
  if (current.status === "done") return { tender, data: { tender_id: tender.id, requirement_count: tender.requirements?.length ?? 0, reused: true } };
  const regions = tender.regions?.regions ?? [];
  const unfinished = regions.filter((region) => regionRecord(tender, region.region_id).status !== "done");
  if (unfinished.length) throw new ApiError(409, "regions_incomplete", `נותרו ${unfinished.length} אזורים שלא הסתיימו.`);
  tender = await updateTender(supabase, tender, {
    processing: withStep(tender, "validate", {
      status: "running", started_at: new Date().toISOString(), finished_at: null,
      attempts: Number(current.attempts ?? 0) + 1, error: null,
    }),
  });
  try {
    const baseline = await loadExtractorBaseline();
    const merged = regions.flatMap((region) => prefixRegionRequirementIds(
      region.region_id,
      tender.region_outputs?.[region.region_id]?.requirements ?? [],
    ));
    const validation = validateRequirements(merged, baseline.schema);
    if (!validation.ok) {
      console.error("Requirements semantic validation failed", {
        schemaErrors: validation.schemaErrors.map(({ index, errors }) => ({ index, errors })),
        semanticErrors: validation.semanticErrors,
      });
      throw new ApiError(422, "requirements_validation_failed", `ולידציית הדרישות נכשלה (${validation.schemaErrors.length + validation.semanticErrors.length} שגיאות).`);
    }
    const deduped = conservativeDedup(merged);
    const completedAt = new Date().toISOString();
    tender = await updateTender(supabase, tender, {
      requirements: deduped.requirements,
      dedup_log: deduped.log,
      processing: withStep(tender, "validate", { status: "done", finished_at: completedAt, error: null, warnings: validation.warnings }),
    });
    return { tender, data: { tender_id: tender.id, requirement_count: deduped.requirements.length, duplicate_count: deduped.log.filter((entry) => entry.action === "removed_exact").length, warnings: validation.warnings } };
  } catch (error) {
    await markStepFailed(supabase, tender, "validate", error.code ?? "validation_failed");
    throw error;
  }
}

export default async function handler(request, response) {
  const step = typeof request.query?.step === "string" ? request.query.step : null;
  setCorsHeaders(request, response);

  try {
    ensureAllowedOrigin(request);
    if (request.method === "OPTIONS") return response.status(204).end();
    if (request.method !== "POST") {
      throw new ApiError(405, "method_not_allowed", "שיטת הבקשה אינה נתמכת.");
    }

    const { supabase } = await authenticate(request);
    if (!step || !ALLOWED_STEP_SET.has(step)) {
      throw new ApiError(400, "unknown_step", "שלב העיבוד אינו מוכר.");
    }

    const body = requestBody(request);
    const tenderId = getTenderId(body);
    const tender = await loadTender(supabase, tenderId);

    if (step === "upload") {
      const result = await runUpload(supabase, tender);
      return sendSuccess(response, step, "done", result.data);
    }
    if (step === "map") {
      const result = await runMap(supabase, tender);
      return sendSuccess(response, step, result.waiting ? "waiting" : "done", result.data);
    }

    if (step === "metadata") {
      const result = await runMetadata(supabase, tender);
      return sendSuccess(response, step, result.waiting ? "waiting" : "done", result.data);
    }
    if (step === "extract") {
      const result = await runExtract(supabase, tender, body);
      return sendSuccess(response, step, result.waiting ? "waiting" : "done", result.data);
    }
    if (step === "validate") {
      const result = await runValidate(supabase, tender);
      return sendSuccess(response, step, "done", result.data);
    }

    throw new ApiError(501, "step_not_implemented_in_m2", "השלב מוגדר, אך ימומש בשלב מאוחר יותר.");
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      return sendError(response, step, 402, error.code, "הגעת לתקרת העלות של ה־AI.");
    }
    if (error instanceof ApiError) {
      return sendError(response, step, error.statusCode, error.code, error.message);
    }
    if (error?.code === "baseline_integrity_failed") {
      return sendError(response, step, 500, error.code, "בדיקת תקינות קבצי ה־AI נכשלה.");
    }

    console.error("TenderFit API failure", { step, code: error?.code ?? error?.name ?? "unknown" });
    return sendError(response, step, 500, "internal_error", "אירעה שגיאה בשרת. אפשר לנסות שוב.");
  }
}
