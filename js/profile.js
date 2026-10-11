import { FACT_STATUS, inputKindForFact, parseFactInput } from "./fact-values.js";
import { supabase } from "./supabase.js";

const message = document.querySelector("#profile-message");
const section = document.querySelector("#facts-section");
const list = document.querySelector("#facts-list");
const empty = document.querySelector("#facts-empty");
const count = document.querySelector("#facts-count");
let currentUser = null;
let profile = null;
let registryByKey = new Map();

function setMessage(state, icon, text) {
  message.dataset.state = state;
  message.replaceChildren();
  const iconElement = document.createElement("span"); iconElement.setAttribute("aria-hidden", "true"); iconElement.textContent = icon;
  const copy = document.createElement("span"); copy.textContent = text;
  message.append(iconElement, copy);
  message.hidden = false;
}

function labelFor(key) {
  return registryByKey.get(key)?.description_he || key.replaceAll("_", " ");
}

function createInput(key, fact) {
  const registryFact = registryByKey.get(key);
  const kind = inputKindForFact(fact.business_fact_type);
  let input;
  if (kind === "select" && fact.business_fact_type === "boolean") {
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
  input.id = `fact-${key}`;
  input.name = key;
  input.setAttribute("aria-label", labelFor(key));
  return input;
}

async function saveFact(key, fact, input, statusElement, button) {
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
    const status = FACT_STATUS[updatedFact.status];
    statusElement.dataset.status = updatedFact.status;
    statusElement.textContent = `${status.icon} ${status.label}`;
    setMessage("success", "✓", "הנתון נשמר וישמש בהשוואה הבאה בכל המכרזים.");
  } catch (error) {
    setMessage("error", "✕", error.message);
  } finally {
    button.disabled = false;
  }
}

function factCard(key, fact) {
  const article = document.createElement("article"); article.className = "card fact-card";
  const heading = document.createElement("div"); heading.className = "fact-heading";
  const titleWrap = document.createElement("div");
  const title = document.createElement("h3"); title.textContent = labelFor(key);
  const meta = document.createElement("p"); meta.className = "muted"; meta.textContent = `${fact.business_fact_type}${fact.unit ? ` · ${fact.unit}` : ""}`;
  titleWrap.append(title, meta);
  const status = FACT_STATUS[fact.status] ?? FACT_STATUS.needs_review;
  const badge = document.createElement("span"); badge.className = "result-badge"; badge.dataset.status = fact.status; badge.textContent = `${status.icon} ${status.label}`;
  heading.append(titleWrap, badge);

  const form = document.createElement("form"); form.className = "fact-edit-row";
  const label = document.createElement("label"); label.htmlFor = `fact-${key}`; label.textContent = "ערך העסק";
  const input = createInput(key, fact);
  const button = document.createElement("button"); button.className = "button button-secondary"; button.type = "submit"; button.textContent = fact.status === "missing" ? "השלם נתון" : "שמור שינוי";
  form.append(label, input, button);
  form.addEventListener("submit", async (event) => { event.preventDefault(); await saveFact(key, fact, input, badge, button); });
  article.append(heading, form);
  return article;
}

function render() {
  const facts = Object.entries(profile.business_facts ?? {}).sort(([first], [second]) => labelFor(first).localeCompare(labelFor(second), "he"));
  list.replaceChildren(...facts.map(([key, fact]) => factCard(key, fact)));
  count.textContent = `${facts.length} נתונים`;
  empty.hidden = facts.length !== 0;
  section.hidden = false;
}

async function load() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) { location.replace("index.html"); return; }
  currentUser = sessionData.session.user;
  const [profileResult, registryResponse] = await Promise.all([
    supabase.from("business_profile").select("*").eq("user_id", currentUser.id).maybeSingle(),
    fetch("data/business-facts-registry.json"),
  ]);
  if (profileResult.error) throw new Error("לא הצלחנו לקרוא את פרופיל העסק.");
  if (!registryResponse.ok) throw new Error("לא הצלחנו לקרוא את מילון הנתונים.");
  const registry = await registryResponse.json();
  registryByKey = new Map((registry.facts ?? []).map((item) => [item.business_fact_key, item]));
  profile = profileResult.data ?? { user_id: currentUser.id, business_facts: {} };
  profile.business_facts ??= {};
  message.hidden = true;
  render();
}

document.querySelector("#logout-button").addEventListener("click", async () => { await supabase.auth.signOut(); location.replace("index.html"); });
try { await load(); } catch (error) { setMessage("error", "✕", error.message); }
