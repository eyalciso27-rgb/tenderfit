import { splitTenderList } from "../lib/tender-list.js";
import { supabase } from "./supabase.js";
import { calculateUrgency, formatDeadline } from "./urgency.js";

const message = document.querySelector("#tenders-message");
const content = document.querySelector("#tenders-content");
const cards = document.querySelector("#tender-cards");
const tableBody = document.querySelector("#tender-table-body");
const empty = document.querySelector("#tenders-empty");
const tableWrap = document.querySelector("#tender-table-wrap");
let groups = { active: [], ended: [] };
let currentView = "active";

const RESULT_META = Object.freeze({
  met: { icon: "✓", label: "עומד" },
  gap: { icon: "✕", label: "פער" },
  review: { icon: "!", label: "בדיקה" },
  missing: { icon: "?", label: "חסר" },
});

function decisionMeta(decision) {
  if (decision === "go") return { level: "go", icon: "✓", label: "Go" };
  if (decision === "no_go") return { level: "no_go", icon: "✕", label: "No-Go" };
  return { level: "none", icon: "○", label: "טרם נבחרה" };
}

function badge(className, level, icon, label) {
  const value = document.createElement("span");
  value.className = className;
  value.dataset.level = level;
  value.textContent = `${icon} ${label}`;
  return value;
}

function progressView(item, compact = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "list-progress";
  if (item.decision !== "go") {
    wrapper.classList.add("is-empty");
    wrapper.textContent = "—";
    return wrapper;
  }
  const progress = item.checklistProgress ?? { completed: 0, total: 0, percent: 0 };
  const label = document.createElement(compact ? "span" : "strong");
  label.textContent = progress.total ? `${progress.completed} מתוך ${progress.total} · ${progress.percent}%` : "Checklist טרם נוצר";
  const track = document.createElement("span");
  track.className = "list-progress-track";
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", "התקדמות Checklist");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", String(progress.percent));
  const fill = document.createElement("span");
  fill.style.width = `${progress.percent}%`;
  track.append(fill);
  wrapper.append(label, track);
  return wrapper;
}

function resultCounters(item) {
  const list = document.createElement("div");
  list.className = "list-result-counters";
  for (const [key, meta] of Object.entries(RESULT_META)) {
    const counter = document.createElement("span");
    counter.dataset.status = key;
    counter.title = meta.label;
    counter.textContent = `${meta.icon} ${item.counts[key]}`;
    list.append(counter);
  }
  return list;
}

function tenderHref(item) {
  return `tender.html?id=${encodeURIComponent(item.id)}`;
}

function tenderTitle(item) {
  return item.title || (item.tender_number ? `מכרז ${item.tender_number}` : "מכרז ללא שם");
}

function createCard(item) {
  const link = document.createElement("a");
  link.className = "card tender-list-card";
  link.href = tenderHref(item);
  link.setAttribute("aria-label", `פתיחת ${tenderTitle(item)}`);
  const heading = document.createElement("header");
  const titleWrap = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = item.tender_number ? `מכרז ${item.tender_number}` : "מכרז";
  const title = document.createElement("h2");
  title.textContent = tenderTitle(item);
  const publisher = document.createElement("p");
  publisher.className = "muted";
  publisher.textContent = item.publisher || "גוף מפרסם לא אותר";
  titleWrap.append(eyebrow, title, publisher);
  const arrow = document.createElement("span");
  arrow.className = "tender-card-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "←";
  heading.append(titleWrap, arrow);

  const urgency = calculateUrgency(item.submission_deadline);
  const decision = decisionMeta(item.decision);
  const metadata = document.createElement("div");
  metadata.className = "tender-list-card-meta";
  const deadline = document.createElement("div");
  deadline.innerHTML = `<small>מועד הגשה</small><strong><bdi>${formatDeadline(item.submission_deadline)}</bdi></strong>`;
  const badges = document.createElement("div");
  badges.className = "tender-list-badges";
  badges.append(
    badge("urgency-badge", urgency.level, urgency.level === "high" || urgency.level === "ended" ? "!" : "◷", urgency.label),
    badge("list-decision-badge", decision.level, decision.icon, decision.label),
  );
  metadata.append(deadline, badges);

  const fit = document.createElement("section");
  fit.className = "tender-list-fit";
  const fitHeader = document.createElement("div");
  const fitStatus = badge("list-fit-badge", item.fitState.level, item.fitState.icon, item.fitState.label);
  const compliance = document.createElement("strong");
  compliance.textContent = item.compliancePercent === null ? "—" : `${item.compliancePercent}%`;
  compliance.title = "אחוז עמידה";
  fitHeader.append(fitStatus, compliance);
  fit.append(fitHeader, resultCounters(item));
  if (item.decision === "go") fit.append(progressView(item));
  link.append(heading, metadata, fit);
  return link;
}

function tableCell(content) {
  const cell = document.createElement("td");
  if (content instanceof Node) cell.append(content);
  else cell.textContent = content;
  return cell;
}

function createRow(item) {
  const row = document.createElement("tr");
  const titleCell = document.createElement("th");
  titleCell.scope = "row";
  const link = document.createElement("a");
  link.href = tenderHref(item);
  link.textContent = tenderTitle(item);
  const number = document.createElement("small");
  number.textContent = item.tender_number ? `מכרז ${item.tender_number}` : "";
  titleCell.append(link, number);
  const urgency = calculateUrgency(item.submission_deadline);
  const decision = decisionMeta(item.decision);
  const fit = document.createElement("div");
  fit.className = "table-fit-state";
  fit.append(badge("list-fit-badge", item.fitState.level, item.fitState.icon, item.fitState.label), resultCounters(item));
  const progress = progressView(item, true);
  if (item.compliancePercent !== null) {
    const compliance = document.createElement("strong");
    compliance.textContent = `${item.compliancePercent}% עמידה`;
    progress.prepend(compliance);
  }
  row.append(
    titleCell,
    tableCell(item.publisher || "לא אותר"),
    tableCell(formatDeadline(item.submission_deadline)),
    tableCell(badge("urgency-badge", urgency.level, urgency.level === "high" || urgency.level === "ended" ? "!" : "◷", urgency.label)),
    tableCell(badge("list-decision-badge", decision.level, decision.icon, decision.label)),
    tableCell(fit),
    tableCell(progress),
  );
  row.addEventListener("click", (event) => {
    if (!event.target.closest("a")) location.href = tenderHref(item);
  });
  row.tabIndex = 0;
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter") location.href = tenderHref(item);
  });
  return row;
}

function render() {
  const items = groups[currentView];
  document.querySelector("#active-tenders-count").textContent = groups.active.length;
  document.querySelector("#ended-tenders-count").textContent = groups.ended.length;
  for (const tab of document.querySelectorAll("[data-list-view]")) {
    const selected = tab.dataset.listView === currentView;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  }
  empty.hidden = items.length > 0;
  cards.hidden = items.length === 0;
  tableWrap.hidden = items.length === 0;
  if (!items.length) {
    document.querySelector("#tenders-empty-title").textContent = currentView === "active" ? "אין מכרזים פעילים" : "אין מכרזים שהסתיימו";
    document.querySelector("#tenders-empty-copy").textContent = currentView === "active"
      ? "אפשר לעבור למכרזים שהסתיימו או להעלות מכרז חדש."
      : "מכרזים שמועד ההגשה שלהם עבר יופיעו כאן.";
  }
  cards.replaceChildren(...items.map(createCard));
  tableBody.replaceChildren(...items.map(createRow));
}

async function load() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) { location.replace("index.html"); return; }
  const { data, error } = await supabase
    .from("tenders")
    .select("id,title,tender_number,publisher,submission_deadline,decision,processing,results,checklist,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("לא הצלחנו לקרוא את רשימת המכרזים.");
  groups = splitTenderList(data);
  if (!groups.active.length && groups.ended.length) currentView = "ended";
  render();
  message.hidden = true;
  content.hidden = false;
}

for (const tab of document.querySelectorAll("[data-list-view]")) {
  tab.addEventListener("click", () => { currentView = tab.dataset.listView; render(); });
}
document.querySelector("#logout-button").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.replace("index.html");
});

try {
  await load();
} catch (error) {
  message.dataset.state = "error";
  message.lastElementChild.textContent = error.message || "טעינת המכרזים נכשלה.";
}
