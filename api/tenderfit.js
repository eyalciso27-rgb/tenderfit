import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import Ajv from "ajv";

import { loadMapperBaseline } from "../lib/baseline.js";
import { assertAiBudgetAvailable, BudgetExceededError } from "../lib/budget.js";
import { estimateGeminiCost } from "../lib/pricing.js";

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

    const pdfHash = createHash("sha256").update(bytes).digest("hex");
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
        file_size_bytes: sourceBlob.size,
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
  const validate = ajv.compile(baseline.schema);
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

async function failMapInteraction(supabase, tender, interaction, code) {
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
  return updateTender(supabase, tender, {
    processing: withStep(tender, "map", {
      status: "failed",
      finished_at: completedAt,
      error: code,
    }),
    ai_usage: replaceUsage(tender, interactionId, usageEntry),
  });
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

  const interaction = await createGeminiClient().interactions.get(current.interaction_id);
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
    const client = createGeminiClient();
    const interaction = await client.interactions.create({
      model: baseline.settings.model,
      system_instruction: baseline.systemInstruction,
      input: [
        {
          type: "document",
          uri: tender.gemini_file.uri,
          mime_type: tender.gemini_file.mime_type,
        },
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

    const tenderId = getTenderId(requestBody(request));
    const tender = await loadTender(supabase, tenderId);

    if (step === "upload") {
      const result = await runUpload(supabase, tender);
      return sendSuccess(response, step, "done", result.data);
    }
    if (step === "map") {
      const result = await runMap(supabase, tender);
      return sendSuccess(response, step, result.waiting ? "waiting" : "done", result.data);
    }

    throw new ApiError(501, "step_not_implemented_in_m1", "השלב מוגדר, אך ימומש בשלב מאוחר יותר.");
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
