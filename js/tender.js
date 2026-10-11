import {
  FACT_STATUS,
  RESULT_STATUS,
  formatFactOption,
  formatFactUnit,
  formatFactValue,
  inputKindForFact,
  parseFactInput,
  questionForFact,
  translateCategory,
  translateFactKey,
  translatePeriod,
  translateRequirementType,
  translateScope,
  translateSourceType,
  translateToHebrew,
} from "./fact-values.js";
import { callPipelineStep } from "./pipeline.js";
import { markAffectedTenderAnalysesStale, markResultsStale } from "./analysis-staleness.js";
import { organizeRequirements } from "./requirement-tree.js";
import { groupTableRequirements, referencesTable } from "./source-tables.js";
import { supabase } from "./supabase.js";
import { calculateUrgency, formatDeadline } from "./urgency.js";
import { tenderDemoNotice } from "./demo-tender.js";
import {
  normalizeTenderResponse,
  normalizeTenderResponses,
  TENDER_RESPONSE_STATUS,
} from "../lib/tender-response.js";
import { buildAiErrorReport, buildDecisionUpdate } from "../lib/m4-actions.js";

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
let tenderResponseSaving = false;
let decisionSaving = false;
let activeReportRequirement = null;
let reportedRequirementIds = new Set();

const RESPONSE_STATUS_META = Object.freeze({
  met: { icon: "✓", label: "עומד" },
  gap: { icon: "✕", label: "לא עומד" },
  partial: { icon: "◐", label: "עמידה חלקית" },
  conditional: { icon: "◇", label: "עמידה מותנית" },
  review: { icon: "!", label: "דורש בדיקה" },
  not_applicable: { icon: "—", label: "לא רלוונטי" },
});

const RESPONSE_BASIS_META = Object.freeze({
  business_fact: "עובדה קיימת על העסק",
  user_statement: "הצהרת הלקוח",
  document: "מסמך או אסמכתא",
  future_commitment: "התחייבות עתידית למכרז זה",
});

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

function labelForFact(key, fallbackRequirement = null) {
  const fact = profile?.business_facts?.[key];
  const registryFact = registryByKey.get(key);
  const q = questionForFact(key, fact, registryFact);
  if (q && q !== "נתון עסק נדרש") return q;
  if (fact?.title_he) return fact.title_he;
  if (registryFact?.title_he) return registryFact.title_he;
  if (fact?.description_he) return fact.description_he;
  if (registryFact?.description_he) return registryFact.description_he;
  if (fallbackRequirement?.requirement_text) return translateToHebrew(fallbackRequirement.requirement_text);
  if (fallbackRequirement?.source_quote) return translateToHebrew(fallbackRequirement.source_quote);
  if (typeof key === "string" && key) {
    const translatedKey = translateFactKey(key);
    if (translatedKey) return translatedKey;
    return key.replace(/_/g, " ");
  }
  return "נתון עסק נדרש";
}

function resultFor(requirement) {
  return tender.results?.by_requirement_id?.[requirement.requirement_id] ?? {
    status: "review",
    explanation: "ההשוואה טרם הושלמה.",
    business_fact_key: null,
  };
}

function responseFor(requirement) {
  return tender.results?.responses?.[requirement.requirement_id] ?? null;
}

function resultBadge(status) {
  const meta = RESULT_STATUS[status] ?? RESULT_STATUS.review;
  const badge = document.createElement("span");
  badge.className = "result-badge";
  badge.dataset.status = status;
  badge.textContent = `תוצאת מערכת: ${meta.icon} ${meta.label}`;
  return badge;
}

function informationPanel(title, sourceLabel, className, rows, emptyCopy = null) {
  const panel = document.createElement("section");
  panel.className = `requirement-data-panel ${className}`;
  const source = document.createElement("p");
  source.className = "requirement-data-source";
  source.textContent = sourceLabel;
  const heading = document.createElement("h4");
  heading.textContent = title;
  panel.append(source, heading);
  let appended = 0;
  for (const [label, value] of rows) {
    if (value === null || value === undefined || value === "") continue;
    panel.append(detailRow(label, value));
    appended += 1;
  }
  if (!appended && emptyCopy) {
    const empty = document.createElement("p");
    empty.className = "requirement-data-empty";
    empty.textContent = emptyCopy;
    panel.append(empty);
  }
  return panel;
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
    for (const option of registryFact.allowed_values) {
      input.append(new Option(formatFactOption(option), option));
    }
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
    const changedAt = new Date().toISOString();
    const updatedFact = {
      ...fact,
      value,
      status: value === null ? "missing" : "known",
      source: "user",
      updated_at: changedAt,
    };
    const updatedFacts = { ...profile.business_facts, [key]: updatedFact };
    const { error } = await supabase.from("business_profile").upsert({
      user_id: currentUser.id,
      business_facts: updatedFacts,
      updated_at: changedAt,
    }, { onConflict: "user_id" });
    if (error) throw new Error("שמירת הנתון נכשלה.");
    profile.business_facts = updatedFacts;
    tender.results = markResultsStale(tender.results, [key], changedAt);
    let staleWarning = "";
    try {
      await markAffectedTenderAnalysesStale(supabase, currentUser.id, [key], changedAt);
    } catch (staleError) {
      staleWarning = ` ${staleError.message}`;
    }
    messageElement.dataset.state = "success";
    messageElement.textContent = `✓ נשמר. לחצו "בדוק שוב" לעדכון ההתאמה.${staleWarning}`;
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
    scope: fallbackRequirement?.scope ?? null,
    period: fallbackRequirement?.period ?? null,
    valid_until: null,
    verification_status: null,
    updated_at: null,
  };
  const form = document.createElement("form"); form.className = "inline-fact-form";
  const label = document.createElement("label");
  const unitLabel = formatFactUnit(fact.unit || fallbackRequirement?.unit);
  label.textContent = unitLabel ? `ערך העסק (${unitLabel}):` : "ערך העסק:";
  const input = createFactInput(key, fact);
  const button = document.createElement("button"); button.type = "submit"; button.className = "button button-secondary"; button.textContent = fact.status === "missing" ? "השלם נתון" : "שמור שינוי";
  const feedback = document.createElement("p"); feedback.className = "inline-save-message"; feedback.setAttribute("aria-live", "polite");
  form.append(label, input, button, feedback);
  form.addEventListener("submit", async (event) => { event.preventDefault(); await saveFact(key, fact, input, feedback, button); });
  return form;
}

async function saveTenderResponse(requirementId, form, clear = false) {
  if (tenderResponseSaving) return;
  tenderResponseSaving = true;
  const controls = [...form.querySelectorAll("button, input, select, textarea")];
  const feedback = form.querySelector(".tender-response-feedback");
  for (const control of controls) control.disabled = true;
  feedback.dataset.state = "working";
  feedback.textContent = "שומר את מענה הלקוח…";

  try {
    const responses = { ...(tender.results?.responses ?? {}) };
    if (clear) {
      delete responses[requirementId];
    } else {
      const status = form.querySelector("[name='response_status']").value;
      if (!status) throw new Error("יש לבחור מענה לדרישה.");
      const previous = responses[requirementId] ?? null;
      const reminderOn = status === TENDER_RESPONSE_STATUS.REVIEW
        ? form.querySelector("[name='reminder_on']").value || null
        : null;
      const normalized = normalizeTenderResponse({
        response_status: status,
        response_basis: form.querySelector("[name='response_basis']").value || null,
        note: form.querySelector("[name='response_note']").value,
        reminder_on: reminderOn,
        reminder_sent_at: previous?.reminder_on === reminderOn ? previous?.reminder_sent_at : null,
        updated_at: new Date().toISOString(),
        source: "user",
      });
      if (!normalized) throw new Error("המענה שנבחר אינו תקין.");
      responses[requirementId] = normalized;
    }
    const { manual_reviews: legacyManualReviews, ...automaticResults } = tender.results ?? {};
    const nextResults = { ...automaticResults, responses };
    const { data, error } = await supabase
      .from("tenders")
      .update({ results: nextResults, updated_at: new Date().toISOString() })
      .eq("id", tender.id)
      .select("results")
      .single();
    if (error) throw new Error("שמירת מענה הלקוח נכשלה.");
    tender.results = data.results;
    renderAll();
    setCompareMessage(
      "success",
      "✓",
      clear
        ? "מענה הלקוח נמחק. תוצאת המערכת לא השתנתה."
        : "מענה הלקוח נשמר בנפרד. תוצאת המערכת והמונים לא השתנו.",
    );
  } catch (error) {
    feedback.dataset.state = "error";
    feedback.textContent = error.message || "שמירת מענה הלקוח נכשלה.";
  } finally {
    tenderResponseSaving = false;
    for (const control of controls) control.disabled = false;
  }
}

function tenderResponseForm(requirement) {
  const existing = responseFor(requirement);
  const wrapper = document.createElement("details");
  wrapper.className = "tender-response-form";
  const summary = document.createElement("summary");
  summary.textContent = existing ? "עריכת מענה הלקוח" : "הוספת מענה לדרישה";
  const form = document.createElement("form");
  form.className = "tender-response-form-body";
  form.setAttribute("aria-label", "מענה הלקוח לדרישה");

  const heading = document.createElement("h4");
  heading.textContent = "מענה הלקוח לדרישה";
  const guidance = document.createElement("p");
  guidance.className = "tender-response-guidance";
  guidance.textContent = "המענה נשמר במכרז הזה בלבד ואינו משנה את תוצאת המערכת או את פרופיל העסק.";

  const fields = document.createElement("div");
  fields.className = "tender-response-fields";

  const statusLabel = document.createElement("label");
  statusLabel.textContent = "מענה";
  const status = document.createElement("select");
  status.name = "response_status";
  status.required = true;
  status.append(new Option("בחרו מענה…", ""));
  for (const [value, meta] of Object.entries(RESPONSE_STATUS_META)) {
    status.append(new Option(`${meta.icon} ${meta.label}`, value));
  }
  status.value = existing?.response_status ?? "";
  statusLabel.append(status);

  const basisLabel = document.createElement("label");
  basisLabel.textContent = "בסיס למענה";
  const basis = document.createElement("select");
  basis.name = "response_basis";
  basis.append(new Option("לא צוין", ""));
  for (const [value, label] of Object.entries(RESPONSE_BASIS_META)) basis.append(new Option(label, value));
  basis.value = existing?.response_basis ?? "user_statement";
  basisLabel.append(basis);

  const reminderLabel = document.createElement("label");
  reminderLabel.className = "tender-response-reminder";
  reminderLabel.textContent = "תאריך יעד לתזכורת (רשות)";
  const reminder = document.createElement("input");
  reminder.type = "date";
  reminder.name = "reminder_on";
  reminder.value = existing?.reminder_on ?? "";
  reminderLabel.append(reminder);
  const reminderHelp = document.createElement("small");
  reminderHelp.textContent = "בלי תאריך יעד לא יישלח מייל.";
  reminderLabel.append(reminderHelp);
  fields.append(statusLabel, basisLabel, reminderLabel);

  const noteLabel = document.createElement("label");
  noteLabel.textContent = "הערה או אסמכתא (רשות)";
  const note = document.createElement("textarea");
  note.name = "response_note";
  note.rows = 2;
  note.maxLength = 500;
  note.value = existing?.note ?? "";
  note.placeholder = "לדוגמה: נדרש אישור של מנהל הכספים";
  noteLabel.append(note);

  const actions = document.createElement("div");
  actions.className = "tender-response-actions";
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "button button-secondary";
  saveButton.textContent = "שמור מענה";
  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "button button-text tender-response-reset";
  clearButton.textContent = "מחק מענה";
  clearButton.hidden = !existing;
  actions.append(saveButton, clearButton);

  const feedback = document.createElement("p");
  feedback.className = "tender-response-feedback";
  feedback.setAttribute("aria-live", "polite");
  if (existing) {
    feedback.dataset.state = "success";
    feedback.textContent = existing.response_status === TENDER_RESPONSE_STATUS.REVIEW && !existing.reminder_on
      ? "המענה נשמר. לא הוגדר תאריך יעד ולכן לא יישלח מייל."
      : "✓ המענה נשמר במכרז זה.";
  }

  const updateReminderVisibility = () => {
    reminderLabel.hidden = status.value !== TENDER_RESPONSE_STATUS.REVIEW;
    if (reminderLabel.hidden) reminder.value = "";
  };
  status.addEventListener("change", updateReminderVisibility);
  updateReminderVisibility();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveTenderResponse(requirement.requirement_id, form);
  });
  clearButton.addEventListener("click", () => saveTenderResponse(requirement.requirement_id, form, true));
  form.append(heading, guidance, fields, noteLabel, actions, feedback);
  wrapper.append(summary, form);
  return wrapper;
}

function formatDecisionTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "החלטה עוד לא נבחרה.";
  return `החלטה עודכנה: ${new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value))}`;
}

function renderDecision() {
  const decision = tender.decision ?? "none";
  const badge = document.querySelector("#decision-badge");
  badge.dataset.decision = decision;
  badge.textContent = decision === "go" ? "✓ Go" : decision === "no_go" ? "✓ No-Go" : "טרם נבחרה";
  for (const button of document.querySelectorAll(".decision-button")) {
    const selected = button.dataset.decision === decision;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = selected
      ? `✓ ${button.dataset.decision === "go" ? "Go" : "No-Go"}`
      : button.dataset.decision === "go" ? "Go" : "No-Go";
  }
  document.querySelector("#decision-updated-at").textContent = formatDecisionTime(tender.decision_updated_at);
}

async function saveDecision(value) {
  if (decisionSaving || tender.decision === value) return;
  const update = buildDecisionUpdate(value);
  if (!update) return;
  decisionSaving = true;
  const buttons = [...document.querySelectorAll(".decision-button")];
  const feedback = document.querySelector("#decision-feedback");
  for (const button of buttons) button.disabled = true;
  feedback.dataset.state = "working";
  feedback.textContent = "שומר את ההחלטה…";
  try {
    const { data, error } = await supabase
      .from("tenders")
      .update(update)
      .eq("id", tender.id)
      .select("decision, decision_updated_at, updated_at")
      .single();
    if (error) throw new Error("שמירת ההחלטה נכשלה.");
    Object.assign(tender, data);
    renderDecision();
    feedback.dataset.state = "success";
    feedback.textContent = `✓ ההחלטה נשמרה: ${value === "go" ? "Go" : "No-Go"}.`;
  } catch (error) {
    feedback.dataset.state = "error";
    feedback.textContent = error.message || "שמירת ההחלטה נכשלה.";
  } finally {
    decisionSaving = false;
    for (const button of buttons) button.disabled = false;
  }
}

function reportAction(requirement) {
  const row = document.createElement("div");
  row.className = "error-report-entry";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-text error-report-open";
  button.textContent = "⚑ דווח על בעיה בניתוח";
  button.addEventListener("click", () => openErrorReport(requirement));
  row.append(button);
  if (reportedRequirementIds.has(requirement.requirement_id)) {
    const saved = document.createElement("span");
    saved.className = "report-saved-chip";
    saved.textContent = "✓ הדיווח נשמר";
    row.append(saved);
  }
  return row;
}

function openErrorReport(requirement) {
  activeReportRequirement = requirement;
  const result = resultFor(requirement);
  document.querySelector("#error-report-requirement").textContent = translateToHebrew(requirement.requirement_text);
  const status = document.querySelector("#error-report-status");
  status.replaceChildren(resultBadge(result.status));
  document.querySelector("#error-report-explanation").value = "";
  const feedback = document.querySelector("#error-report-feedback");
  feedback.textContent = "";
  delete feedback.dataset.state;
  document.querySelector("#error-report-dialog").showModal();
}

async function submitErrorReport(event) {
  event.preventDefault();
  if (!activeReportRequirement) return;
  const submit = document.querySelector("#error-report-submit");
  const feedback = document.querySelector("#error-report-feedback");
  const explanation = document.querySelector("#error-report-explanation").value;
  const report = buildAiErrorReport({
    userId: currentUser.id,
    tenderId: tender.id,
    requirement: activeReportRequirement,
    comparisonResult: resultFor(activeReportRequirement),
    fitAnalysis: tender.fit_analysis,
    userExplanation: explanation,
  });
  if (!report) {
    feedback.dataset.state = "error";
    feedback.textContent = "יש להסביר מה לדעתך שגוי.";
    return;
  }
  submit.disabled = true;
  feedback.dataset.state = "working";
  feedback.textContent = "שומר את הדיווח…";
  try {
    const { error } = await supabase.from("ai_error_reports").insert(report);
    if (error) throw new Error("שמירת הדיווח נכשלה.");
    reportedRequirementIds.add(activeReportRequirement.requirement_id);
    document.querySelector("#error-report-dialog").close();
    activeReportRequirement = null;
    renderRequirements();
    setCompareMessage("success", "✓", "הדיווח נשמר. הוא אינו משנה את תוצאת המערכת.");
  } catch (error) {
    feedback.dataset.state = "error";
    feedback.textContent = error.message || "שמירת הדיווח נכשלה.";
  } finally {
    submit.disabled = false;
  }
}

const statusWeight = { gap: 0, missing: 1, review: 2, met: 3 };

function subtreeMatches(requirement, childrenByParent) {
  if (activeFilter === "all") return true;
  if (activeFilter === "critical") {
    if (requirement.is_critical) return true;
    return (childrenByParent.get(requirement.requirement_id) ?? []).some((child) => subtreeMatches(child, childrenByParent));
  }
  if (resultFor(requirement).status === activeFilter) return true;
  return (childrenByParent.get(requirement.requirement_id) ?? []).some((child) => subtreeMatches(child, childrenByParent));
}

function requirementCard(requirement, childrenByParent, ancestorIds = new Set()) {
  const result = resultFor(requirement);
  const customerResponse = responseFor(requirement);
  const article = document.createElement("article"); article.className = "card requirement-card"; article.dataset.status = result.status;
  article.dataset.critical = String(Boolean(requirement.is_critical));
  const header = document.createElement("header");
  const chips = document.createElement("div"); chips.className = "chip-row";
  chips.append(resultBadge(result.status));
  if (requirement.is_critical) {
    const criticalChip = document.createElement("span");
    criticalChip.className = "chip chip-critical";
    criticalChip.textContent = "⚠ תנאי סף קריטי";
    chips.append(criticalChip);
  }
  if (customerResponse) {
    const responseMeta = RESPONSE_STATUS_META[customerResponse.response_status];
    const responseChip = document.createElement("span");
    responseChip.className = "chip chip-customer-response";
    responseChip.textContent = `מענה לקוח: ${responseMeta?.icon ?? ""} ${responseMeta?.label ?? "נשמר"}`;
    chips.append(responseChip);
  }
  if (requirement.requirement_target === "evaluation_rule") {
    const evaluation = document.createElement("span"); evaluation.className = "chip chip-evaluation"; evaluation.textContent = "סעיף ניקוד · אינו תנאי סף"; chips.append(evaluation);
  }
  if (requirement.source_type === "table" || requirement.table_id) {
    const tableChip = document.createElement("span"); tableChip.className = "chip"; tableChip.textContent = "פריט טבלה"; chips.append(tableChip);
  }
  const categoryLabel = translateCategory(requirement.category);
  const typeLabel = translateRequirementType(requirement.requirement_type);
  for (const value of [categoryLabel, typeLabel]) {
    if (!value) continue;
    const chip = document.createElement("span"); chip.className = "chip"; chip.textContent = value; chips.append(chip);
  }
  if (requirement.requires_manual_review) { const chip = document.createElement("span"); chip.className = "chip chip-review"; chip.textContent = "! דורש בדיקה"; chips.append(chip); }
  const title = document.createElement("h3"); title.textContent = translateToHebrew(requirement.requirement_text);
  header.append(chips, title); article.append(header);

  const factKey = result.business_fact_key;
  const fact = factKey ? profile.business_facts?.[factKey] : null;
  const tenderValue = [
    requirement.comparison_operator,
    requirement.value,
    formatFactUnit(requirement.unit),
  ].filter((value) => value !== null && value !== undefined && value !== "").join(" ");
  const businessUnit = formatFactUnit(fact?.unit);
  const businessValue = factKey
    ? `${formatFactValue(fact)}${businessUnit ? ` ${businessUnit}` : ""}`
    : null;
  const dataComparison = document.createElement("div");
  dataComparison.className = "requirement-data-comparison";
  dataComparison.append(
    informationPanel("מה המכרז דורש", "מקור: מסמך המכרז", "tender-data-panel", [
      ["ערך ותנאי", tenderValue || "לא צוין ערך מובנה"],
      ["תחולה", translateScope(requirement.scope)],
      ["תקופה", translatePeriod(requirement.period)],
    ]),
    informationPanel("מה ידוע על העסק", "מקור: פרופיל העסק", "business-data-panel", factKey ? [
      ["שם הנתון", labelForFact(factKey)],
      ["ערך בפרופיל", businessValue],
      ["תחולה", fact?.scope],
      ["תקופה", fact?.period],
      ["בתוקף עד", fact?.valid_until],
    ] : [], "לסעיף הזה אין Business Fact חוזר בפרופיל העסק."),
  );
  article.append(dataComparison);

  const comparison = document.createElement("section"); comparison.className = "requirement-comparison";
  const comparisonHeading = document.createElement("h4"); comparisonHeading.textContent = "תוצאת המערכת";
  comparison.append(comparisonHeading);
  comparison.append(detailRow("מצב", `${RESULT_STATUS[result.status]?.icon ?? "!"} ${RESULT_STATUS[result.status]?.label ?? "דורש בדיקה"}`));
  comparison.append(detailRow("הסבר", translateToHebrew(result.explanation)));
  article.append(comparison);

  if (customerResponse) {
    const responseSummary = document.createElement("section");
    responseSummary.className = "customer-response-summary";
    const responseHeading = document.createElement("h4"); responseHeading.textContent = "מענה הלקוח למכרז הזה";
    responseSummary.append(responseHeading);
    const responseMeta = RESPONSE_STATUS_META[customerResponse.response_status];
    responseSummary.append(detailRow("מענה", `${responseMeta?.icon ?? ""} ${responseMeta?.label ?? "נשמר"}`));
    if (customerResponse.response_basis) responseSummary.append(detailRow("בסיס למענה", RESPONSE_BASIS_META[customerResponse.response_basis] ?? "לא צוין"));
    if (customerResponse.note) responseSummary.append(detailRow("הערה", customerResponse.note));
    if (customerResponse.reminder_on) responseSummary.append(detailRow("יעד לתזכורת", customerResponse.reminder_on));
    article.append(responseSummary);
  }
  if (factKey) {
    if (result.status === "missing") {
      article.append(factEditor(factKey, requirement));
    } else {
      const editDetails = document.createElement("details");
      editDetails.className = "tender-response-form";
      const editSummary = document.createElement("summary");
      editSummary.textContent = "עריכת נתון להשוואה למכרז הזה";
      editDetails.append(editSummary, factEditor(factKey, requirement));
      article.append(editDetails);
    }
  }
  if (!childrenByParent.has(requirement.requirement_id)) article.append(tenderResponseForm(requirement));

  const fields = document.createElement("div"); fields.className = "requirement-fields";
  const fieldValues = [
    ["עמוד", requirement.source_page],
    ["סעיף", requirement.source_section], ["סוג מקור", translateSourceType(requirement.source_type)],
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
  article.append(reportAction(requirement));

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
  document.querySelector("#analysis-stale-warning").hidden = results.stale !== true;
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
  const criticalSummaryElement = document.querySelector("#critical-summary");
  if (critical) {
    criticalSummaryElement.replaceChildren();
    const textNode = document.createElement("span");
    textNode.textContent = `! ${critical} תנאי סף קריטיים דורשים תשומת לב. `;
    const filterBtn = document.createElement("button");
    filterBtn.type = "button";
    filterBtn.className = "button button-text";
    filterBtn.textContent = "סנן לתנאי סף קריטיים";
    filterBtn.addEventListener("click", () => {
      activeFilter = "critical";
      for (const candidate of document.querySelectorAll("[data-filter]")) {
        candidate.classList.toggle("is-active", candidate.dataset.filter === "critical");
      }
      renderRequirements();
      document.querySelector(".requirements-section").scrollIntoView({ behavior: "smooth" });
    });
    criticalSummaryElement.append(textNode, filterBtn);
  } else {
    criticalSummaryElement.textContent = "✓ לא זוהו תנאי סף קריטיים שדורשים תשומת לב.";
  }
  text("comparison-summary", results.summary || "ההשוואה טרם הושלמה.");
}

function renderTenderComparisonFacts() {
  const section = document.querySelector("#tender-facts-section") || document.querySelector("#missing-facts-section");
  if (!section) return;
  const list = document.querySelector("#tender-facts-list") || document.querySelector("#missing-facts-list");
  const count = document.querySelector("#tender-facts-count");
  const seen = new Set();
  const facts = [];
  for (const requirement of tender.requirements ?? []) {
    const result = resultFor(requirement);
    const key = result.business_fact_key || requirement.business_fact_key;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    facts.push([key, requirement]);
  }
  facts.sort(([first], [second]) => labelForFact(first).localeCompare(labelForFact(second), "he"));
  list.replaceChildren();
  for (const [key, requirement] of facts) {
    const card = document.createElement("article");
    card.className = "card missing-fact-card";
    const statusKey = profile.business_facts?.[key]?.status ?? "missing";
    const status = FACT_STATUS[statusKey] ?? FACT_STATUS.missing;
    const heading = document.createElement("div");
    heading.className = "fact-heading";
    const title = document.createElement("h3");
    title.textContent = labelForFact(key, requirement);
    const badge = document.createElement("span");
    badge.className = "result-badge";
    badge.dataset.status = statusKey;
    badge.textContent = `${status.icon} ${status.label}`;
    heading.append(title, badge);

    if (requirement?.requirement_text) {
      const context = document.createElement("p");
      context.className = "fact-context";
      const sectionInfo = requirement.source_section ? `סעיף ${requirement.source_section} · ` : "";
      context.textContent = `דרישת המכרז: ${sectionInfo}${translateToHebrew(requirement.requirement_text)}`;
      card.append(heading, context, factEditor(key, requirement));
    } else {
      card.append(heading, factEditor(key, requirement));
    }
    list.append(card);
  }
  if (count) count.textContent = `${facts.length} נתונים להשוואה`;
  section.hidden = facts.length === 0;
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
  renderTenderComparisonFacts();
  renderSourceTables();
  renderRequirements();
  renderDecision();
}

async function refreshData() {
  const [tenderResult, profileResult, reportsResult] = await Promise.all([
    supabase.from("tenders").select("*").eq("id", tenderId).single(),
    supabase.from("business_profile").select("*").eq("user_id", currentUser.id).maybeSingle(),
    supabase.from("ai_error_reports").select("requirement_id").eq("tender_id", tenderId),
  ]);
  if (tenderResult.error) throw new Error("לא הצלחנו לקרוא את המכרז.");
  if (profileResult.error) throw new Error("לא הצלחנו לקרוא את פרופיל העסק.");
  if (reportsResult.error) throw new Error("לא הצלחנו לקרוא את דיווחי השגיאות.");
  tender = tenderResult.data;
  tender.results ??= {};
  tender.results.responses = normalizeTenderResponses(
    tender.requirements ?? [],
    tender.results.responses ?? {},
    tender.results.manual_reviews ?? {},
  );
  profile = profileResult.data ?? { user_id: currentUser.id, business_facts: {} };
  profile.business_facts ??= {};
  reportedRequirementIds = new Set((reportsResult.data ?? []).map((item) => item.requirement_id));
}

async function compare(successCopy = null) {
  compareButton.disabled = true;
  const startedAt = performance.now();
  setCompareMessage("working", "…", "משווה בקוד את דרישות המכרז לנתוני העסק…");
  try {
    await callPipelineStep("compare", tenderId);
    await refreshData();
    renderAll();
    const elapsed = performance.now() - startedAt;
    setCompareMessage("success", "✓", successCopy ?? `ההשוואה הושלמה בתוך ${(elapsed / 1000).toFixed(2)} שניות. לא הופעלה קריאת AI.`);
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
  const demoNotice = tenderDemoNotice(tender.metadata);
  const demoNoticeElement = document.querySelector("#demo-notice");
  demoNoticeElement.hidden = !demoNotice;
  demoNoticeElement.textContent = demoNotice ? `ⓘ ${demoNotice}` : "";
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
document.querySelector("#decision-go").addEventListener("click", () => saveDecision("go"));
document.querySelector("#decision-no-go").addEventListener("click", () => saveDecision("no_go"));
document.querySelector("#error-report-form").addEventListener("submit", submitErrorReport);
document.querySelector("#error-report-cancel").addEventListener("click", () => {
  activeReportRequirement = null;
  document.querySelector("#error-report-dialog").close();
});
document.querySelector("#result-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  for (const candidate of document.querySelectorAll("[data-filter]")) candidate.classList.toggle("is-active", candidate === button);
  renderRequirements();
});
try { await load(); } catch (error) { pageMessage.dataset.state = "error"; pageMessage.lastElementChild.textContent = error.message; }
