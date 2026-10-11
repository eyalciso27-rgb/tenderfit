import { supabase } from "./supabase.js";
import { processTender } from "./pipeline.js";
import { findLatestCompletedTender } from "./tender-selection.js";
import { validateUploadFile } from "./upload-validation.js";
import { applyProcessingEvent, buildProcessingStatus } from "../lib/processing-status.js";

const fileInput = document.querySelector("#pdf-file");
const dropZone = document.querySelector("#drop-zone");
const fileCard = document.querySelector("#file-card");
const fileName = document.querySelector("#file-name");
const fileMeta = document.querySelector("#file-meta");
const startButton = document.querySelector("#start-button");
const continueButton = document.querySelector("#continue-button");
const statusBox = document.querySelector("#processing-status");
const progressBar = document.querySelector("#progress-bar");
const progressText = document.querySelector("#progress-text");
const processingStepNumber = document.querySelector("#processing-step-number");
const processingStateLabel = document.querySelector("#processing-state-label");
const processingSteps = document.querySelector("#processing-steps");
const processingProgress = document.querySelector("#processing-progress");
const metadataWarning = document.querySelector("#metadata-processing-warning");
const logoutButton = document.querySelector("#logout-button");
const completedTenderCard = document.querySelector("#completed-tender-card");
const completedTenderTitle = document.querySelector("#completed-tender-title");
const completedTenderNumber = document.querySelector("#completed-tender-number");
const openCompletedTender = document.querySelector("#open-completed-tender");
let selectedFile = null;
let currentProcessing = { steps: {}, regions: {} };
let pipelineRunning = false;
let lastProgressEvent = null;

const STATUS_META = Object.freeze({
  pending: { icon: "□", label: "עוד לא התחיל" },
  working: { icon: "◐", label: "בעבודה" },
  done: { icon: "✓", label: "הסתיים" },
  failed: { icon: "✕", label: "נכשל" },
});

function setStatus(state, text, percent = 0) {
  statusBox.hidden = false;
  statusBox.dataset.state = state;
  progressText.textContent = text;
  progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  processingProgress.setAttribute("aria-valuenow", String(Math.max(0, Math.min(100, percent))));
}

function renderProcessingStatus(headline = null) {
  const view = buildProcessingStatus(currentProcessing);
  const active = view.phases[view.currentStep - 1];
  const state = view.complete ? "done" : active?.status ?? "pending";
  const meta = STATUS_META[state] ?? STATUS_META.pending;
  statusBox.hidden = false;
  statusBox.dataset.state = state === "failed" ? "error" : state === "done" ? "success" : state === "working" ? "working" : "ready";
  processingStepNumber.textContent = String(view.currentStep);
  processingStateLabel.dataset.state = state;
  processingStateLabel.textContent = `${meta.icon} ${meta.label}`;
  progressText.textContent = headline ?? (view.complete
    ? "העיבוד הושלם."
    : `${active?.label ?? "מכין את העיבוד"}${active?.detail ? ` — ${active.detail}` : ""}`);
  progressBar.style.width = `${view.percent}%`;
  processingProgress.setAttribute("aria-valuenow", String(view.percent));
  metadataWarning.hidden = view.metadataStatus !== "failed";
  processingSteps.replaceChildren(...view.phases.map((phase) => {
    const item = document.createElement("li");
    item.dataset.state = phase.status;
    const phaseMeta = STATUS_META[phase.status] ?? STATUS_META.pending;
    const icon = document.createElement("span");
    icon.className = "processing-step-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = phaseMeta.icon;
    const copy = document.createElement("span");
    const label = document.createElement("strong");
    label.textContent = phase.label;
    const status = document.createElement("small");
    status.textContent = `${phaseMeta.label}${phase.detail ? ` · ${phase.detail}` : ""}`;
    copy.append(label, status);
    item.append(icon, copy);
    return item;
  }));
  return view;
}

function selectFile(file) {
  try {
    validateUploadFile(file);
    selectedFile = file;
    fileName.textContent = file.name;
    fileMeta.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB · PDF`;
    fileCard.hidden = false;
    startButton.disabled = false;
    currentProcessing = { steps: {}, regions: {} };
    renderProcessingStatus("הקובץ מוכן להעלאה.");
  } catch (error) {
    selectedFile = null;
    fileCard.hidden = true;
    startButton.disabled = true;
    setStatus("error", error.message, 0);
  }
}

async function sha256(file) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createTender(file) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("יש להתחבר מחדש.");
  setStatus("working", "מחשב טביעת קובץ…", 4);
  const hash = await sha256(file);
  const objectPath = `${user.id}/${crypto.randomUUID()}.pdf`;
  setStatus("working", "מעלה לאחסון המוגן…", 8);
  const { error: uploadError } = await supabase.storage.from("tender-pdfs").upload(objectPath, file, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new Error("העלאת הקובץ לאחסון נכשלה.");
  const title = file.name.replace(/\.pdf$/i, "");
  const { data, error } = await supabase.from("tenders").insert({
    user_id: user.id, title, pdf_path: objectPath, pdf_hash: hash,
    processing: { steps: {}, regions: {} }, regions: { regions: [] },
  }).select("id").single();
  if (error) throw new Error("יצירת רשומת המכרז נכשלה.");
  currentProcessing = { steps: {}, regions: {} };
  return data.id;
}

async function showLatestCompletedTender() {
  const { data, error } = await supabase
    .from("tenders")
    .select("id,title,tender_number,processing,updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) return;
  const tender = findLatestCompletedTender(data);
  if (!tender) return;
  completedTenderTitle.textContent = tender.title || "מכרז מעובד";
  completedTenderNumber.textContent = tender.tender_number ? `מספר מכרז ${tender.tender_number}` : "";
  openCompletedTender.href = `tender.html?id=${encodeURIComponent(tender.id)}`;
  completedTenderCard.hidden = false;
}

function progress(event) {
  lastProgressEvent = event;
  currentProcessing = applyProcessingEvent(currentProcessing, event);
  const view = renderProcessingStatus();
  if (event.step === "extract" && event.regionTitle && event.state !== "done") {
    progressText.textContent = `${view.phases[2].label} — ${view.phases[2].detail ?? ""}: ${event.regionTitle}`;
  }
}

async function run(tenderId) {
  startButton.disabled = true;
  continueButton.hidden = false;
  continueButton.disabled = true;
  pipelineRunning = true;
  lastProgressEvent = null;
  try {
    const { data: snapshot, error: snapshotError } = await supabase
      .from("tenders")
      .select("processing")
      .eq("id", tenderId)
      .single();
    if (snapshotError) throw new Error("לא הצלחנו לקרוא את מצב העיבוד.");
    currentProcessing = snapshot.processing ?? { steps: {}, regions: {} };
    renderProcessingStatus();
    const result = await processTender(tenderId, progress);
    sessionStorage.setItem(`tenderfit.duration.${tenderId}`, String(result.durationMs));
    renderProcessingStatus("העיבוד הסתיים. עוברים לניתוח…");
    window.location.assign(`tender.html?id=${encodeURIComponent(tenderId)}`);
  } catch (error) {
    if (lastProgressEvent?.step) {
      currentProcessing = applyProcessingEvent(currentProcessing, { ...lastProgressEvent, state: "failed" });
    }
    renderProcessingStatus(error.message || "העיבוד נעצר. אפשר להמשיך מאותה נקודה.");
    statusBox.dataset.state = "error";
    continueButton.hidden = false;
    continueButton.dataset.tenderId = tenderId;
  } finally {
    pipelineRunning = false;
    continueButton.disabled = false;
  }
}

fileInput.addEventListener("change", () => selectFile(fileInput.files[0]));
for (const type of ["dragenter", "dragover"]) dropZone.addEventListener(type, (event) => { event.preventDefault(); dropZone.classList.add("is-dragging"); });
for (const type of ["dragleave", "drop"]) dropZone.addEventListener(type, (event) => { event.preventDefault(); dropZone.classList.remove("is-dragging"); });
dropZone.addEventListener("drop", (event) => selectFile(event.dataTransfer.files[0]));
startButton.addEventListener("click", async () => {
  try { validateUploadFile(selectedFile); await run(await createTender(selectedFile)); }
  catch (error) { setStatus("error", error.message, 0); startButton.disabled = false; }
});
continueButton.addEventListener("click", () => {
  if (!pipelineRunning) run(continueButton.dataset.tenderId);
});
logoutButton.addEventListener("click", async () => { await supabase.auth.signOut(); window.location.replace("index.html"); });

const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  window.location.replace("index.html");
} else {
  await showLatestCompletedTender();
  const activeTender = localStorage.getItem("tenderfit.activeTender");
  if (activeTender) {
    const { data: active, error } = await supabase
      .from("tenders")
      .select("id,processing")
      .eq("id", activeTender)
      .maybeSingle();
    if (error || !active) {
      localStorage.removeItem("tenderfit.activeTender");
    } else {
      currentProcessing = active.processing ?? { steps: {}, regions: {} };
      const view = renderProcessingStatus("נמצא עיבוד קודם. אפשר להמשיך מאותה נקודה.");
      if (view.complete) {
        localStorage.removeItem("tenderfit.activeTender");
        statusBox.hidden = true;
      } else {
        continueButton.hidden = false;
        continueButton.disabled = false;
        continueButton.dataset.tenderId = activeTender;
      }
    }
  }
}
