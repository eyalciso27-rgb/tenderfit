import { supabase } from "./supabase.js";
import { calculateUrgency, formatDeadline } from "./urgency.js";

const params = new URLSearchParams(location.search);
const tenderId = params.get("id");
const pageMessage = document.querySelector("#page-message");
const content = document.querySelector("#tender-content");

function text(id, value) { document.querySelector(`#${id}`).textContent = value ?? "—"; }
function bidi(value) { const bdi = document.createElement("bdi"); bdi.textContent = value; return bdi; }

function detailRow(label, value) {
  const row = document.createElement("div"); row.className = "requirement-field";
  const term = document.createElement("span"); term.textContent = label;
  const data = document.createElement("strong"); data.append(bidi(value ?? "—"));
  row.append(term, data); return row;
}

function requirementCard(requirement, children = []) {
  const article = document.createElement("article"); article.className = "card requirement-card";
  const header = document.createElement("header");
  const chips = document.createElement("div"); chips.className = "chip-row";
  for (const value of [requirement.category, requirement.requirement_type]) {
    const chip = document.createElement("span"); chip.className = "chip"; chip.textContent = value; chips.append(chip);
  }
  if (requirement.requires_manual_review) { const chip = document.createElement("span"); chip.className = "chip chip-review"; chip.textContent = "דורש בדיקה"; chips.append(chip); }
  const title = document.createElement("h3"); title.textContent = requirement.requirement_text;
  header.append(chips, title); article.append(header);

  const fields = document.createElement("div"); fields.className = "requirement-fields";
  fields.append(
    detailRow("ערך", requirement.value), detailRow("יחידה", requirement.unit),
    detailRow("תנאי", requirement.comparison_operator), detailRow("עמוד", requirement.source_page),
    detailRow("סעיף", requirement.source_section),
  );
  article.append(fields);

  const source = document.createElement("details"); source.className = "source-details";
  const summary = document.createElement("summary"); summary.textContent = "הצגת ציטוט מהמקור";
  const quote = document.createElement("blockquote"); quote.append(bidi(requirement.source_quote || "לא סופק ציטוט"));
  source.append(summary, quote);
  if (requirement.cell_text) { const cell = document.createElement("p"); cell.className = "cell-text"; cell.append("תא בטבלה: ", bidi(requirement.cell_text)); source.append(cell); }
  article.append(source);

  if (children.length) {
    const childGroup = document.createElement("details"); childGroup.className = "children-group";
    const childSummary = document.createElement("summary"); childSummary.textContent = `${children.length} דרישות משנה`;
    const list = document.createElement("div"); list.className = "child-list";
    for (const child of children) list.append(requirementCard(child));
    childGroup.append(childSummary, list); article.append(childGroup);
  }
  return article;
}

function renderRequirements(requirements) {
  const list = document.querySelector("#requirements-list");
  const byParent = new Map();
  for (const requirement of requirements) {
    if (!requirement.parent_requirement_id) continue;
    const children = byParent.get(requirement.parent_requirement_id) ?? [];
    children.push(requirement); byParent.set(requirement.parent_requirement_id, children);
  }
  const roots = requirements.filter((requirement) => !requirement.parent_requirement_id);
  for (const requirement of roots) list.append(requirementCard(requirement, byParent.get(requirement.requirement_id) ?? []));
  document.querySelector("#empty-state").hidden = requirements.length !== 0;
}

async function load() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) { location.replace("index.html"); return; }
  if (!tenderId) throw new Error("לא נבחר מכרז.");
  const { data: tender, error } = await supabase.from("tenders").select("*").eq("id", tenderId).single();
  if (error) throw new Error("לא הצלחנו לקרוא את המכרז.");
  const urgency = calculateUrgency(tender.submission_deadline);
  text("tender-number", tender.tender_number || "לא צוין");
  text("tender-title", tender.title);
  text("publisher", tender.publisher || "גוף מפרסם לא אותר");
  text("deadline", formatDeadline(tender.submission_deadline));
  text("days-left", urgency.days === null ? "לא ידוע" : urgency.days < 0 ? "עבר" : String(urgency.days));
  text("requirements-count", String(tender.requirements?.length ?? 0));
  const duration = Number(sessionStorage.getItem(`tenderfit.duration.${tender.id}`));
  text("duration", duration ? `${Math.round(duration / 1000)} שניות` : "לא נמדד בדפדפן זה");
  const urgencyBadge = document.querySelector("#urgency-badge"); urgencyBadge.textContent = urgency.label; urgencyBadge.dataset.level = urgency.level;
  const manualCount = (tender.requirements ?? []).filter((item) => item.requires_manual_review).length;
  text("manual-review-count", `${manualCount} לבדיקה ידנית`);
  document.querySelector("#metadata-warning").hidden = tender.processing?.steps?.metadata?.status !== "failed";
  renderRequirements(tender.requirements ?? []);
  pageMessage.hidden = true; content.hidden = false;
}

document.querySelector("#logout-button").addEventListener("click", async () => { await supabase.auth.signOut(); location.replace("index.html"); });
try { await load(); } catch (error) { pageMessage.dataset.state = "error"; pageMessage.lastElementChild.textContent = error.message; }
