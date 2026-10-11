import {
  CHECKLIST_STATUS,
  checklistForGo,
  checklistProgress,
  normalizeChecklist,
  updateChecklistItem,
} from "../lib/checklist.js";
import { supabase } from "./supabase.js";
import { calculateUrgency, formatDeadline } from "./urgency.js";

const params = new URLSearchParams(location.search);
const tenderId = params.get("id");
const pageMessage = document.querySelector("#page-message");
const content = document.querySelector("#checklist-content");
const feedback = document.querySelector("#checklist-feedback");
const mobileList = document.querySelector("#checklist-mobile-list");
const tableBody = document.querySelector("#checklist-table-body");
let tender = null;
let saving = false;

const STATUS_META = Object.freeze({
  [CHECKLIST_STATUS.OPEN]: { icon: "○", label: "לא התחיל" },
  [CHECKLIST_STATUS.IN_PROGRESS]: { icon: "◐", label: "בתהליך" },
  [CHECKLIST_STATUS.DONE]: { icon: "✓", label: "הושלם" },
});

function text(selector, value) {
  document.querySelector(selector).textContent = value ?? "—";
}

function sourceText(item) {
  const parts = [];
  if (item.source?.page !== null && item.source?.page !== undefined) parts.push(`עמוד ${item.source.page}`);
  if (item.source?.section) parts.push(`סעיף ${item.source.section}`);
  return parts.join(" · ") || "מקור לא צוין";
}

function createCheckbox(item, suffix) {
  const label = document.createElement("label");
  label.className = "checklist-checkbox-label";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = item.done;
  checkbox.dataset.itemId = item.item_id;
  checkbox.id = `done-${suffix}-${item.item_id}`;
  checkbox.setAttribute("aria-label", `סימון ${item.name} כהושלם`);
  checkbox.addEventListener("change", () => saveItem(item.item_id, { done: checkbox.checked }));
  const copy = document.createElement("span");
  copy.textContent = item.done ? "הושלם" : "סמן כהושלם";
  label.append(checkbox, copy);
  return label;
}

function createStatusSelect(item, suffix) {
  const wrapper = document.createElement("label");
  wrapper.className = "checklist-status-label";
  const hiddenLabel = document.createElement("span");
  hiddenLabel.className = "visually-hidden";
  hiddenLabel.textContent = `סטטוס עבור ${item.name}`;
  const select = document.createElement("select");
  select.id = `status-${suffix}-${item.item_id}`;
  select.dataset.itemId = item.item_id;
  select.setAttribute("aria-label", `סטטוס עבור ${item.name}`);
  for (const [value, meta] of Object.entries(STATUS_META)) select.append(new Option(`${meta.icon} ${meta.label}`, value));
  select.value = item.status;
  select.addEventListener("change", () => saveItem(item.item_id, { status: select.value }));
  wrapper.append(hiddenLabel, select);
  return wrapper;
}

function createSource(item) {
  const source = document.createElement("bdi");
  source.className = "checklist-source";
  source.textContent = sourceText(item);
  return source;
}

function renderMobileItem(item) {
  const card = document.createElement("article");
  card.className = "card checklist-item-card";
  card.dataset.status = item.status;
  const heading = document.createElement("h3");
  heading.textContent = item.name;
  const state = document.createElement("span");
  state.className = "checklist-item-state";
  state.textContent = `${STATUS_META[item.status].icon} ${STATUS_META[item.status].label}`;
  const sourceLabel = document.createElement("span");
  sourceLabel.className = "muted";
  sourceLabel.textContent = "מקור: ";
  sourceLabel.append(createSource(item));
  const controls = document.createElement("div");
  controls.className = "checklist-item-controls";
  controls.append(createCheckbox(item, "mobile"), createStatusSelect(item, "mobile"));
  card.append(state, heading, sourceLabel, controls);
  return card;
}

function renderTableRow(item) {
  const row = document.createElement("tr");
  row.dataset.status = item.status;
  const doneCell = document.createElement("td");
  doneCell.append(createCheckbox(item, "table"));
  const nameCell = document.createElement("th");
  nameCell.scope = "row";
  nameCell.textContent = item.name;
  const statusCell = document.createElement("td");
  statusCell.append(createStatusSelect(item, "table"));
  const sourceCell = document.createElement("td");
  sourceCell.append(createSource(item));
  row.append(doneCell, nameCell, statusCell, sourceCell);
  return row;
}

function setControlsDisabled(disabled) {
  for (const control of document.querySelectorAll("#checklist-content input, #checklist-content select")) control.disabled = disabled;
}

function render() {
  tender.checklist = normalizeChecklist(tender.checklist);
  mobileList.replaceChildren(...tender.checklist.map(renderMobileItem));
  tableBody.replaceChildren(...tender.checklist.map(renderTableRow));
  const empty = tender.checklist.length === 0;
  document.querySelector("#checklist-empty").hidden = !empty;
  document.querySelector("#checklist-table-wrap").hidden = empty;
  mobileList.hidden = empty;

  const progress = checklistProgress(tender.checklist);
  text("#progress-percent", `${progress.percent}%`);
  document.querySelector("#progress-count").replaceChildren();
  const count = document.createElement("bdi");
  count.textContent = `${progress.completed} מתוך ${progress.total}`;
  document.querySelector("#progress-count").append(count, " פריטים הושלמו");
  const bar = document.querySelector("#checklist-progress");
  bar.setAttribute("aria-valuenow", String(progress.percent));
  bar.firstElementChild.style.width = `${progress.percent}%`;
}

async function saveItem(itemId, changes) {
  if (saving) return;
  const previous = tender.checklist;
  const next = updateChecklistItem(previous, itemId, changes);
  saving = true;
  tender.checklist = next;
  render();
  setControlsDisabled(true);
  feedback.dataset.state = "working";
  feedback.textContent = "שומר את העדכון…";
  try {
    const { data, error } = await supabase
      .from("tenders")
      .update({ checklist: next, updated_at: new Date().toISOString() })
      .eq("id", tender.id)
      .select("checklist, updated_at")
      .single();
    if (error) throw new Error("שמירת ה-Checklist נכשלה.");
    tender.checklist = normalizeChecklist(data.checklist);
    tender.updated_at = data.updated_at;
    render();
    feedback.dataset.state = "success";
    feedback.textContent = "✓ העדכון נשמר.";
  } catch (error) {
    tender.checklist = previous;
    render();
    feedback.dataset.state = "error";
    feedback.textContent = error.message || "שמירת ה-Checklist נכשלה.";
  } finally {
    saving = false;
    setControlsDisabled(false);
  }
}

async function load() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) { location.replace("index.html"); return; }
  if (!tenderId) throw new Error("לא נבחר מכרז.");
  const { data, error } = await supabase
    .from("tenders")
    .select("id, title, tender_number, submission_deadline, decision, decision_updated_at, requirements, checklist, updated_at")
    .eq("id", tenderId)
    .single();
  if (error) throw new Error("לא הצלחנו לקרוא את המכרז.");
  tender = data;
  if (tender.decision !== "go") throw new Error("ה-Checklist זמין רק לאחר בחירת Go במכרז.");

  if (!Array.isArray(tender.checklist)) {
    const checklist = checklistForGo(tender.checklist, tender.requirements);
    const { data: saved, error: saveError } = await supabase
      .from("tenders")
      .update({ checklist, updated_at: new Date().toISOString() })
      .eq("id", tender.id)
      .select("checklist, updated_at")
      .single();
    if (saveError) throw new Error("יצירת ה-Checklist נכשלה.");
    tender.checklist = saved.checklist;
    tender.updated_at = saved.updated_at;
  }

  const backUrl = `tender.html?id=${encodeURIComponent(tender.id)}`;
  document.querySelector("#back-to-tender").href = backUrl;
  document.querySelector("#bottom-back-to-tender").href = backUrl;
  text("#checklist-tender-title", tender.title || `מכרז ${tender.tender_number || ""}`.trim());
  text("#checklist-deadline", formatDeadline(tender.submission_deadline));
  const urgency = calculateUrgency(tender.submission_deadline);
  const urgencyBadge = document.querySelector("#checklist-urgency");
  urgencyBadge.dataset.level = urgency.level;
  urgencyBadge.textContent = urgency.label;
  render();
  pageMessage.hidden = true;
  content.hidden = false;
}

document.querySelector("#logout-button").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.replace("index.html");
});

try {
  await load();
} catch (error) {
  pageMessage.dataset.state = "error";
  pageMessage.lastElementChild.textContent = error.message || "טעינת ה-Checklist נכשלה.";
}
