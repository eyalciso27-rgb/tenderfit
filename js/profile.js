import { supabase } from "./supabase.js";
import {
  BUSINESS_PROFILE_FIELDS,
  REUSABLE_PROFILE_FACTS,
  findReusableProfileFact,
  normalizeBusinessProfileDetails,
  removeGeneratedMissingPlaceholders,
  updateReusableProfileFacts,
} from "../lib/business-profile.js";
import { markAffectedTenderAnalysesStale } from "./analysis-staleness.js";

const message = document.querySelector("#profile-message");
const detailsSection = document.querySelector("#business-details-section");
const detailsForm = document.querySelector("#business-details-form");
const saveDetailsButton = document.querySelector("#save-business-details");
const reusableFactsSection = document.querySelector("#reusable-facts-section");
const reusableFactsForm = document.querySelector("#reusable-facts-form");
const saveReusableFactsButton = document.querySelector("#save-reusable-facts");
let currentUser = null;
let profile = null;

function setMessage(state, icon, text) {
  message.dataset.state = state;
  message.replaceChildren();
  const iconElement = document.createElement("span");
  iconElement.setAttribute("aria-hidden", "true");
  iconElement.textContent = icon;
  const copy = document.createElement("span");
  copy.textContent = text;
  message.append(iconElement, copy);
  message.hidden = false;
}

function populateBusinessDetails() {
  for (const field of BUSINESS_PROFILE_FIELDS) {
    detailsForm.elements[field].value = profile?.[field] ?? "";
  }
  detailsSection.hidden = false;
}

function populateReusableFacts() {
  for (const field of REUSABLE_PROFILE_FACTS) {
    const fact = findReusableProfileFact(profile?.business_facts, field);
    reusableFactsForm.elements[field.key].value = fact?.value === true
      ? "true"
      : fact?.value === false
        ? "false"
        : fact?.value ?? "";
    if (field.requiresPeriod) {
      reusableFactsForm.elements[`${field.key}_period`].value = fact?.period ?? "";
    }
    if (field.supportsValidity) {
      reusableFactsForm.elements[`${field.key}_valid_until`].value = fact?.valid_until ?? "";
    }
  }
  reusableFactsSection.hidden = false;
}

async function saveBusinessDetails() {
  saveDetailsButton.disabled = true;
  try {
    const details = normalizeBusinessProfileDetails(Object.fromEntries(new FormData(detailsForm)));
    if (!details.legal_name) throw new Error("יש להזין שם משפטי של העסק.");
    const changedAt = new Date().toISOString();
    const { data, error } = await supabase.from("business_profile").upsert({
      user_id: currentUser.id,
      ...details,
      business_facts: profile.business_facts ?? {},
      updated_at: changedAt,
    }, { onConflict: "user_id" }).select("*").single();
    if (error) throw new Error("שמירת פרטי העסק נכשלה.");
    profile = data;
    populateBusinessDetails();
    setMessage("success", "✓", "פרטי העסק נשמרו בהצלחה.");
  } catch (error) {
    setMessage("error", "✕", error.message);
  } finally {
    saveDetailsButton.disabled = false;
  }
}

async function saveReusableFacts() {
  saveReusableFactsButton.disabled = true;
  try {
    const changedAt = new Date().toISOString();
    const formValues = Object.fromEntries(new FormData(reusableFactsForm));
    const update = updateReusableProfileFacts(formValues, profile.business_facts, changedAt);
    if (!update.changedKeys.length) {
      setMessage("success", "✓", "לא נמצאו שינויים בנתוני העסק.");
      return;
    }
    const { data, error } = await supabase.from("business_profile").upsert({
      user_id: currentUser.id,
      ...normalizeBusinessProfileDetails(profile),
      business_facts: update.facts,
      updated_at: changedAt,
    }, { onConflict: "user_id" }).select("*").single();
    if (error) throw new Error("שמירת נתוני העסק נכשלה.");
    profile = data;
    populateReusableFacts();

    let staleMessage = "";
    try {
      const affectedCount = await markAffectedTenderAnalysesStale(
        supabase,
        currentUser.id,
        update.changedKeys,
        changedAt,
      );
      if (affectedCount) staleMessage = ` ${affectedCount} מכרזים סומנו לעדכון בדיקת ההתאמה.`;
    } catch (staleError) {
      staleMessage = ` ${staleError.message}`;
    }
    setMessage("success", "✓", `נתוני העסק נשמרו בהצלחה.${staleMessage}`);
  } catch (error) {
    setMessage("error", "✕", error.message);
  } finally {
    saveReusableFactsButton.disabled = false;
  }
}

async function load() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    location.replace("index.html");
    return;
  }
  currentUser = sessionData.session.user;

  const profileResult = await supabase
    .from("business_profile")
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (profileResult.error) throw new Error("לא הצלחנו לקרוא את פרטי העסק.");

  profile = profileResult.data ?? { user_id: currentUser.id, business_facts: {} };
  profile.business_facts ??= {};

  const migration = removeGeneratedMissingPlaceholders(profile.business_facts);
  if (migration.removedKeys.length) {
    const changedAt = new Date().toISOString();
    const { error } = await supabase.from("business_profile").upsert({
      user_id: currentUser.id,
      business_facts: migration.facts,
      updated_at: changedAt,
    }, { onConflict: "user_id" });
    if (error) throw new Error("עדכון נתוני הפרופיל נכשל.");
    profile.business_facts = migration.facts;
  }

  populateBusinessDetails();
  populateReusableFacts();
  message.hidden = true;
}

document.querySelector("#logout-button").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.replace("index.html");
});

detailsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveBusinessDetails();
});

reusableFactsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveReusableFacts();
});

try {
  await load();
} catch (error) {
  setMessage("error", "✕", error.message);
}

