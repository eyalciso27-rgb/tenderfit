import { supabase } from "./supabase.js";
import { processTender } from "./pipeline.js";
import { validateUploadFile } from "./upload-validation.js";

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
const logoutButton = document.querySelector("#logout-button");
let selectedFile = null;
let completedRegions = new Set();
let totalRegions = 0;

function setStatus(state, text, percent = 0) {
  statusBox.hidden = false;
  statusBox.dataset.state = state;
  progressText.textContent = text;
  progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function selectFile(file) {
  try {
    validateUploadFile(file);
    selectedFile = file;
    fileName.textContent = file.name;
    fileMeta.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB · PDF`;
    fileCard.hidden = false;
    startButton.disabled = false;
    setStatus("ready", "הקובץ מוכן להעלאה.", 0);
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
  return data.id;
}

function progress(event) {
  const labels = { upload: "מכין את המסמך", map: "ממפה את המכרז", metadata: "מחלץ פרטי מכרז", extract: "מחלץ דרישות", validate: "בודק ומאחד דרישות" };
  const bases = { upload: 10, map: 22, metadata: 22, extract: 38, validate: 92 };
  if (event.step === "extract" && event.state === "starting") {
    completedRegions = new Set();
    totalRegions = Number(event.total) || 0;
  }
  if (event.step === "extract" && event.state === "done" && event.regionId) completedRegions.add(event.regionId);
  const extractPercent = event.step === "extract" && totalRegions > 0
    ? Math.round((completedRegions.size / totalRegions) * 50)
    : 0;
  const percent = Math.min(98, (bases[event.step] ?? 5) + extractPercent);
  const regionProgress = event.step === "extract" && totalRegions > 0
    ? ` — אזור ${completedRegions.size} מתוך ${totalRegions}`
    : "";
  const suffix = event.regionTitle ? `${regionProgress}: ${event.regionTitle}` : regionProgress;
  setStatus(event.state === "failed" ? "error" : "working", `${labels[event.step] ?? "מעבד"}${suffix}…`, percent);
}

async function run(tenderId) {
  startButton.disabled = true;
  continueButton.hidden = true;
  try {
    const result = await processTender(tenderId, progress);
    sessionStorage.setItem(`tenderfit.duration.${tenderId}`, String(result.durationMs));
    setStatus("success", "העיבוד הסתיים. עוברים לדרישות…", 100);
    window.location.assign(`tender.html?id=${encodeURIComponent(tenderId)}`);
  } catch (error) {
    setStatus("error", error.message || "העיבוד נכשל. אפשר להמשיך מאותה נקודה.", Number.parseFloat(progressBar.style.width) || 0);
    continueButton.hidden = false;
    continueButton.dataset.tenderId = tenderId;
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
continueButton.addEventListener("click", () => run(continueButton.dataset.tenderId));
logoutButton.addEventListener("click", async () => { await supabase.auth.signOut(); window.location.replace("index.html"); });

const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) window.location.replace("index.html");
const activeTender = localStorage.getItem("tenderfit.activeTender");
if (activeTender) {
  continueButton.hidden = false;
  continueButton.dataset.tenderId = activeTender;
  setStatus("ready", "נמצא עיבוד קודם. אפשר להמשיך מאותה נקודה.", 0);
}
