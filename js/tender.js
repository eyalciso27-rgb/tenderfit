import { FACT_STATUS, RESULT_STATUS, formatFactValue, inputKindForFact, parseFactInput } from "./fact-values.js";
import { callPipelineStep } from "./pipeline.js";
import { organizeRequirements } from "./requirement-tree.js";
import { groupTableRequirements, referencesTable } from "./source-tables.js";
import { supabase } from "./supabase.js";
import { calculateUrgency, formatDeadline } from "./urgency.js";

const params = new URLSearchParams(location.search);
const tenderId = params.get("id");
const pageMessage = document.querySelector("#page-message");
const content = document.querySelector("#tender-content");
const compareMessage = document.querySelector("#compare-message");
const compareButton = document.querySelector("#compare-button");
let tender = null;
let profile = null;
let currentUser = null;
let registryByKey = new Map();
let activeFilter = "all";
let sourcePdfUrl = null;

function text(id, value) { document.querySelector(`#${id}`).textContent = value ?? "—"; }
function bidi(value) { const bdi = document.createElement("bdi"); bdi.textContent = value; return bdi; }

function setCompareMessage(state, icon, copy) {
  compareMessage.dataset.state = state;
  compareMessage.replaceChildren();
  const iconElement = document.createElement("span"); iconElement.setAttribute("aria-hidden", "true"); iconElement.textContent = icon;
  const textElement = document.createElement("span"); textElement.textContent = copy;
  compareMessage.append(iconElement, textElement);
  compareMessage.hidden = false;
}

function detailRow(label, value) {
  const row = document.createElement("div"); row.className = "requirement-field";
  const term = document.createElement("span"); term.textContent = label;
  const data = document.createElement("strong"); data.append(bidi(value ?? "—"));
  row.append(term, data); return row;
}

function labelForFact(key) {
  return registryByKey.get(key)?.description_he || String(key ?? "נתון עסק").replaceAll("_", " ");
}

function resultFor(requirement) {
  return tender.results?.by_requirement_id?.[requirement.requirement_id] ?? {
    status: "review",
    explanation: "ההשוואה טרם הושלמה.",
    business_fact_key: null,
  };
}

function resultBadge(status) {
  const meta = RESULT_STATUS[status] ?? RESULT_STATUS.review;
  const badge = document.createElement("span");
  badge.className = "result-badge";
  badge.dataset.status = status;
  badge.textContent = `${meta.icon} ${meta.label}`;
  return badge;
}

function sourcePageLink(requirement, label = "פתח עמוד מקור") {
  if (!sourcePdfUrl) return null;
  const link = document.createElement("a");
  link.className = "button button-text source-page-link";
  link.target = "_blank";
  link.rel = "noopener";
  const page = Number(requirement.source_page);
  link.href = Number.isFinite(page) ? `${sourcePdfUrl}#page=${page}` : sourcePdfUrl;
  link.textContent = label;
  return link;
}

function createFactInput(key, fact) {
  const registryFact = registryByKey.get(key);
  const kind = inputKindForFact(fact.business_fact_type);
  let input;
  if (fact.business_fact_type === "boolean") {
    input = document.createElement("select");
    input.append(new Option("בחרו…", ""), new Option("כן", "true"), new Option("לא", "false"));
    if (fact.value === true || fact.value === "true") input.value = "true";
    if (fact.value === false || fact.value === "false") input.value = "false";
  } else if (kind === "select" && registryFact?.allowed_values?.length) {
    input = document.createElement("select");
    input.append(new Option("בחרו…", ""));
    for (const option of registryFact.allowed_values) input.append(new Option(option, option));
    input.value = fact.value ?? "";
  } else {
    input = document.createElement("input");
    input.type = kind === "select" ? "text" : kind;
    if (input.type === "number") input.step = "any";
    input.value = fact.value ?? "";
  }
  input.setAttribute("aria-label", labelForFact(key));
  return input;
}

async function saveFact(key, fact, input, messageElement, button) {
  button.disabled = true;
  try {
    const value = parseFactInput(fact.business_fact_type, input.value);
    const updatedFact = {
      ...fact,
      value,
      status: value === null ? "missing" : "known",
      source: "user",
      updated_at: new Date().toISOString(),
    };
    const updatedFacts = { ...profile.business_facts, [key]: updatedFact };
    const { error } = await supabase.from("business_profile").upsert({
      user_id: currentUser.id,
      business_facts: updatedFacts,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error("שמירת הנתון נכשלה.");
    profile.business_facts = updatedFacts;
    messageElement.dataset.state = "success";
    messageElement.textContent = "✓ נשמר. לחצו \"בדוק שוב\" לעדכון ההתאמה.";
    renderAll();
    setCompareMessage("success", "✓", "הנתון נשמר בפרופיל. לחצו \"בדוק שוב\" כדי לחשב את התוצאות מחדש.");
  } catch (error) {
    messageElement.dataset.state = "error";
    messageElement.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function factEditor(key, fallbackRequirement = null) {
  const existing = profile.business_facts?.[key];
  const fact = existing ?? {
    business_fact_type: fallbackRequirement?.business_fact_type ?? "string",
    unit: fallbackRequirement?.unit ?? null,
    value: null,
    status: "missing",
    aliases: [],
    source: null,
    updated_at: null,
  };
  const form = document.createElement("form"); form.className = "inline-fact-form";
  const label = document.createElement("label"); label.textContent = labelForFact(key);
  const input = createFactInput(key, fact);
  const button = document.createElement("button"); button.type = "submit"; button.className = "button button-secondary"; button.textContent = fact.status === "missing" ? "השלם נתון" : "שמור שינוי";
  const feedback = document.createElement("p"); feedback.className = "inline-save-message"; feedback.setAttribute("aria-live", "polite");
  form.append(label, input, button, feedback);
  form.addEventListener("submit", async (event) => { event.preventDefault(); await saveFact(key, fact, input, feedback, button); });
  return form;
}

const statusWeight = { gap: 0, missing: 1, review: 2, met: 3 };

function subtreeMatches(requirement, childrenByParent) {
  if (activeFilter === "all" || resultFor(requirement).status === activeFilter) return true;
  return (childrenByParent.get(requirement.requirement_id) ?? []).some((child) => subtreeMatches(child, childrenByParent));
}

function requirementCard(requirement, childrenByParent, ancestorIds = new Set()) {
  const result = resultFor(requirement);
  const article = document.createElement("article"); article.className = "card requirement-card"; article.dataset.status = result.status;
  const header = document.createElement("header");
  const chips = document.createElement("div"); chips.className = "chip-row";
  chips.append(resultBadge(result.status));
  if (requirement.requirement_target === "evaluation_rule") {
    const evaluation = document.createElement("span"); evaluation.className = "chip chip-evaluation"; evaluation.textContent = "סעיף ניקוד · אינו תנאי סף"; chips.append(evaluation);
  }
  for (const value of [requirement.category, requirement.requirement_type]) {
    if (!value) continue;
    const chip = document.createElement("span"); chip.className = "chip"; chip.textContent = value; chips.append(chip);
  }
  if (requirement.requires_manual_review) { const chip = document.createElement("span"); chip.className = "chip chip-review"; chip.textContent = "! דורש בדיקה"; chips.append(chip); }
  const title = document.createElement("h3"); title.textContent = requirement.requirement_text;
  header.append(chips, title); article.append(header);

  const comparison = document.createElement("div"); comparison.className = "requirement-comparison";
  const factKey = result.business_fact_key;
  if (factKey) {
    const fact = profile.business_facts?.[factKey];
    comparison.append(detailRow("נתון העסק", `${formatFactValue(fact)}${fact?.unit ? ` ${fact.unit}` : ""}`));
  }
  comparison.append(detailRow("הסבר התוצאה", result.explanation));
  article.append(comparison);
  if (result.status === "missing" && factKey) article.append(factEditor(factKey, requirement));

  const fields = document.createElement("div"); fields.className = "requirement-fields";
  const valueLabel = requirement.requirement_target === "evaluation_rule" ? "ניקוד מרבי / ערך" : "ערך";
  const fieldValues = [
    [valueLabel, requirement.value], ["יחידה", requirement.unit],
    ["תנאי", requirement.comparison_operator], ["עמוד", requirement.source_page],
    ["סעיף", requirement.source_section], ["סוג מקור", requirement.source_type],
    ["טבלה", requirement.table_id], ["שורה", requirement.row_index],
  ];
  for (const [label, value] of fieldValues) {
    if (value !== null && value !== undefined && value !== "") fields.append(detailRow(label, value));
  }
  article.append(fields);

  const source = document.createElement("details"); source.className = "source-details";
  const summary = document.createElement("summary"); summary.textContent = "הצגת ציטוט מהמקור";
  const quote = document.createElement("blockquote"); quote.append(bidi(requirement.source_quote || "לא סופק ציטוט"));
  source.append(summary, quote);
  if (requirement.cell_text) { const cell = document.createElement("p"); cell.className = "cell-text"; cell.append("תא בטבלה: ", bidi(requirement.cell_text)); source.append(cell); }
  const sourceLink = sourcePageLink(requirement, referencesTable(requirement) ? "פתח את הטבלה בעמוד המקור" : "פתח עמוד מקור");
  if (sourceLink) source.append(sourceLink);
  article.append(source);
  if (referencesTable(requirement)) {
    const notice = document.createElement("p"); notice.className = "table-reference-notice";
    notice.append("הסעיף מפנה לטבלה במסמך. ");
    const tableLink = sourcePageLink(requirement, "הצג את הטבלה המקורית");
    if (tableLink) notice.append(tableLink);
    article.append(notice);
  }

  const nextAncestors = new Set(ancestorIds);
  nextAncestors.add(requirement.requirement_id);
  const children = (childrenByParent.get(requirement.requirement_id) ?? [])
    .filter((child) => !nextAncestors.has(child.requirement_id) && subtreeMatches(child, childrenByParent))
    .sort((first, second) => statusWeight[resultFor(first).status] - statusWeight[resultFor(second).status]);
  if (children.length) {
    const childGroup = document.createElement("details"); childGroup.className = "children-group";
    const childSummary = document.createElement("summary"); childSummary.textContent = `${children.length} דרישות משנה`;
    const childList = document.createElement("div"); childList.className = "child-list";
    for (const child of children) childList.append(requirementCard(child, childrenByParent, nextAncestors));
    childGroup.append(childSummary, childList); article.append(childGroup);
  }
  return article;
}

function renderRequirements() {
  const requirements = tender.requirements ?? [];
  const list = document.querySelector("#requirements-list");
  const { roots, childrenByParent } = organizeRequirements(requirements);
  const visibleRoots = roots.filter((item) => subtreeMatches(item, childrenByParent))
    .sort((first, second) => statusWeight[resultFor(first).status] - statusWeight[resultFor(second).status]);
  list.replaceChildren(...visibleRoots.map((item) => requirementCard(item, childrenByParent)));
  document.querySelector("#empty-state").hidden = requirements.length !== 0;
  document.querySelector("#filter-empty").hidden = requirements.length === 0 || visibleRoots.length !== 0;
}

function renderOverview() {
  const results = tender.results ?? {};
  const counts = results.counts ?? { gap: 0, missing: 0, review: 0, met: 0 };
  for (const status of ["gap", "missing", "review", "met"]) text(`${status}-count`, String(counts[status] ?? 0));
  text("compliance-percent", results.compliance_percent === null || results.compliance_percent === undefined ? "לא מחושב" : `${results.compliance_percent}%`);
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  const bar = document.querySelector("#segmented-bar"); bar.replaceChildren();
  for (const status of ["gap", "missing", "review", "met"]) {
    const segment = document.createElement("span"); segment.dataset.status = status;
    segment.style.width = `${total ? (100 * Number(counts[status] ?? 0)) / total : 0}%`;
    segment.title = `${RESULT_STATUS[status].label}: ${counts[status] ?? 0}`;
    bar.append(segment);
  }
  const critical = Number(results.critical_attention_count ?? 0);
  text("critical-summary", critical ? `! ${critical} תנאי סף קריטיים דורשים תשומת לב.` : "✓ לא זוהו תנאי סף קריטיים שדורשים תשומת לב.");
  text("comparison-summary", results.summary || "ההשוואה טרם הושלמה.");
}

function renderMissingFacts() {
  const section = document.querySelector("#missing-facts-section");
  const list = document.querySelector("#missing-facts-list");
  const seen = new Set();
  const missing = [];
  for (const requirement of tender.requirements ?? []) {
    const result = resultFor(requirement);
    const key = result.business_fact_key;
    if (result.status !== "missing" || !key || seen.has(key)) continue;
    seen.add(key); missing.push([key, requirement]);
  }
  list.replaceChildren();
  for (const [key, requirement] of missing) {
    const card = document.createElement("article"); card.className = "card missing-fact-card";
    const status = FACT_STATUS[profile.business_facts?.[key]?.status ?? "missing"] ?? FACT_STATUS.missing;
    const heading = document.createElement("div"); heading.className = "fact-heading";
    const title = document.createElement("h3"); title.textContent = labelForFact(key);
    const badge = document.createElement("span"); badge.className = "result-badge"; badge.dataset.status = "missing"; badge.textContent = `${status.icon} ${status.label}`;
    heading.append(title, badge); card.append(heading, factEditor(key, requirement)); list.append(card);
  }
  section.hidden = missing.length === 0;
}

function renderSourceTables() {
  const section = document.querySelector("#source-tables-section");
  const list = document.querySelector("#source-tables-list");
  const groups = groupTableRequirements(tender.requirements ?? []);
  list.replaceChildren();
  for (const group of groups) {
    const details = document.createElement("details"); details.className = "card source-table-card";
    const summary = document.createElement("summary");
    const pages = [...new Set(group.requirements.map((item) => item.source_page).filter(Boolean))];
    summary.textContent = `${group.title} · ${group.requirements.length} פריטים${pages.length ? ` · עמודים ${pages.join(", ")}` : ""}`;
    const scroll = document.createElement("div"); scroll.className = "table-scroll";
    const table = document.createElement("table"); table.className = "extracted-table";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const label of ["מצב", "עמוד", "שורה", "עמודה", "תוכן שחולץ", "ערך נדרש", "מקור"]) {
      const cell = document.createElement("th"); cell.scope = "col"; cell.textContent = label; headRow.append(cell);
    }
    head.append(headRow); table.append(head);
    const body = document.createElement("tbody");
    for (const requirement of group.requirements) {
      const row = document.createElement("tr");
      const result = resultFor(requirement);
      const values = [
        `${RESULT_STATUS[result.status]?.icon ?? "!"} ${RESULT_STATUS[result.status]?.label ?? "דורש בדיקה"}`,
        requirement.source_page ?? "—",
        requirement.row_index ?? "—",
        requirement.column_index ?? "—",
        requirement.cell_text || requirement.source_quote || requirement.requirement_text || "—",
        requirement.value ?? "—",
      ];
      for (const value of values) { const cell = document.createElement("td"); cell.append(bidi(value)); row.append(cell); }
      const linkCell = document.createElement("td");
      const link = sourcePageLink(requirement, "פתח עמוד");
      if (link) linkCell.append(link); else linkCell.textContent = "—";
      row.append(linkCell); body.append(row);
    }
    table.append(body); scroll.append(table); details.append(summary, scroll); list.append(details);
  }
  text("source-tables-count", `${groups.length} טבלאות · ${groups.reduce((sum, group) => sum + group.requirements.length, 0)} פריטים`);
  section.hidden = groups.length === 0;
}

function renderAll() {
  renderOverview();
  renderMissingFacts();
  renderSourceTables();
  renderRequirements();
}

async function refreshData() {
  const [tenderResult, profileResult] = await Promise.all([
    supabase.from("tenders").select("*").eq("id", tenderId).single(),
    supabase.from("business_profile").select("*").eq("user_id", currentUser.id).maybeSingle(),
  ]);
  if (tenderResult.error) throw new Error("לא הצלחנו לקרוא את המכרז.");
  if (profileResult.error) throw new Error("לא הצלחנו לקרוא את פרופיל העסק.");
  tender = tenderResult.data;
  profile = profileResult.data ?? { user_id: currentUser.id, business_facts: {} };
  profile.business_facts ??= {};
}

async function compare() {
  compareButton.disabled = true;
  const startedAt = performance.now();
  setCompareMessage("working", "…", "משווה בקוד את דרישות המכרז לנתוני העסק…");
  try {
    await callPipelineStep("compare", tenderId);
    await refreshData();
    renderAll();
    const elapsed = performance.now() - startedAt;
    setCompareMessage("success", "✓", `ההשוואה הושלמה בתוך ${(elapsed / 1000).toFixed(2)} שניות. לא הופעלה קריאת AI.`);
  } catch (error) {
    setCompareMessage("error", "✕", error.message || "ההשוואה נכשלה.");
  } finally {
    compareButton.disabled = false;
  }
}

function renderTenderHeader() {
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
}

async function load() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) { location.replace("index.html"); return; }
  if (!tenderId) throw new Error("לא נבחר מכרז.");
  currentUser = sessionData.session.user;
  const registryResponse = await fetch("data/business-facts-registry.json");
  if (!registryResponse.ok) throw new Error("לא הצלחנו לקרוא את מילון נתוני העסק.");
  const registry = await registryResponse.json();
  registryByKey = new Map((registry.facts ?? []).map((item) => [item.business_fact_key, item]));
  await refreshData();
  const signedUrlResult = await supabase.storage.from("tender-pdfs").createSignedUrl(tender.pdf_path, 3600);
  if (!signedUrlResult.error) sourcePdfUrl = signedUrlResult.data?.signedUrl ?? null;
  renderTenderHeader();
  pageMessage.hidden = true; content.hidden = false;
  if (tender.processing?.steps?.compare?.status !== "done" || !tender.results?.by_requirement_id) await compare();
  else renderAll();
}

document.querySelector("#logout-button").addEventListener("click", async () => { await supabase.auth.signOut(); location.replace("index.html"); });
compareButton.addEventListener("click", compare);
document.querySelector("#result-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  for (const candidate of document.querySelectorAll("[data-filter]")) candidate.classList.toggle("is-active", candidate === button);
  renderRequirements();
});
try { await load(); } catch (error) { pageMessage.dataset.state = "error"; pageMessage.lastElementChild.textContent = error.message; }
