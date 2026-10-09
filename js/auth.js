import { CONFIG } from "./config.js";
import { supabase } from "./supabase.js";

const POLL_INTERVAL_MS = 10_000;
const MAX_MAP_WAIT_MS = 15 * 60_000;

const loginView = document.querySelector("#login-view");
const appView = document.querySelector("#app-view");
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-button");
const loginMessage = document.querySelector("#login-message");
const logoutButton = document.querySelector("#logout-button");
const businessName = document.querySelector("#business-name");
const tenderSelect = document.querySelector("#tender-select");
const uploadButton = document.querySelector("#upload-button");
const mapButton = document.querySelector("#map-button");
const runStatus = document.querySelector("#run-status");
const apiOutput = document.querySelector("#api-output");

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isolate(value) {
  return `\u2068${value}\u2069`;
}

function setLoginMessage(message) {
  loginMessage.textContent = message;
}

function setRunStatus(state, icon, message) {
  runStatus.dataset.state = state;
  runStatus.replaceChildren();
  const iconElement = document.createElement("span");
  iconElement.setAttribute("aria-hidden", "true");
  iconElement.textContent = icon;
  const textElement = document.createElement("span");
  textElement.textContent = message;
  runStatus.append(iconElement, textElement);
}

function showLogin() {
  appView.hidden = true;
  loginView.hidden = false;
  businessName.textContent = "טוען…";
  tenderSelect.replaceChildren(new Option("טוען מכרזים…", ""));
  tenderSelect.disabled = true;
  uploadButton.disabled = true;
  mapButton.disabled = true;
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
}

function setTestButtonsDisabled(disabled) {
  tenderSelect.disabled = disabled;
  uploadButton.disabled = disabled;
  mapButton.disabled = disabled;
}

async function loadProtectedData() {
  const [profileResult, tendersResult] = await Promise.all([
    supabase.from("business_profile").select("legal_name").maybeSingle(),
    supabase.from("tenders").select("id,title,tender_number").order("created_at", { ascending: true }),
  ]);

  if (profileResult.error) throw new Error("לא הצלחנו לקרוא את פרופיל העסק.");
  if (tendersResult.error) throw new Error("לא הצלחנו לקרוא את רשימת המכרזים.");

  businessName.textContent = profileResult.data?.legal_name || "עסק ללא שם";
  tenderSelect.replaceChildren();
  for (const tender of tendersResult.data ?? []) {
    const number = tender.tender_number ? ` (${isolate(tender.tender_number)})` : "";
    tenderSelect.add(new Option(`${tender.title}${number}`, tender.id));
  }
  const hasTenders = tenderSelect.options.length > 0;
  setTestButtonsDisabled(!hasTenders);
  if (!hasTenders) tenderSelect.add(new Option("אין מכרזי Seed", ""));
}

async function refreshSessionView(session) {
  if (!session) {
    showLogin();
    return;
  }
  showApp();
  try {
    await loadProtectedData();
  } catch (error) {
    setRunStatus("error", "✕", error.message);
  }
}

async function currentAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("תוקף החיבור פג. יש להתחבר מחדש.");
  }
  return data.session.access_token;
}

async function callApi(step) {
  const tenderId = tenderSelect.value;
  if (!tenderId) throw new Error("יש לבחור מכרז.");
  const token = await currentAccessToken();
  const response = await fetch(`${CONFIG.apiBaseUrl}/api/tenderfit?step=${encodeURIComponent(step)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tender_id: tenderId }),
  });
  const payload = await response.json().catch(() => ({
    ok: false,
    status: "failed",
    error: { code: "invalid_server_response", message: "השרת לא החזיר JSON תקין." },
  }));
  apiOutput.textContent = JSON.stringify(payload, null, 2);
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error?.message || "הבקשה נכשלה.");
  }
  return payload;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) {
    setLoginMessage("יש לעדכן את js/config.js בפרטי Supabase ו־Vercel.");
    return;
  }

  loginButton.disabled = true;
  setLoginMessage("");
  const formData = new FormData(loginForm);
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  loginButton.disabled = false;

  if (error) {
    setLoginMessage("האימייל או הסיסמה אינם נכונים.");
    return;
  }
  loginForm.reset();
});

logoutButton.addEventListener("click", async () => {
  setTestButtonsDisabled(true);
  await supabase.auth.signOut();
});

uploadButton.addEventListener("click", async () => {
  setTestButtonsDisabled(true);
  setRunStatus("working", "↑", "מעלה את העותק מ־Storage ל־Gemini Files API…");
  try {
    await callApi("upload");
    setRunStatus("success", "✓", "שלב upload הסתיים, והקובץ במצב ACTIVE.");
  } catch (error) {
    setRunStatus("error", "✕", error.message);
  } finally {
    setTestButtonsDisabled(false);
  }
});

mapButton.addEventListener("click", async () => {
  setTestButtonsDisabled(true);
  const startedAt = Date.now();
  setRunStatus("working", "▶", "שולח מיפוי Background ל־Gemini…");
  try {
    let payload = await callApi("map");
    while (payload.status === "waiting") {
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      setRunStatus("working", "…", `Gemini עובד ברקע. נבדק שוב בעוד ${isolate(10)} שניות. חלפו ${isolate(elapsedSeconds)} שניות.`);
      if (Date.now() - startedAt >= MAX_MAP_WAIT_MS) {
        throw new Error("המיפוי לא הסתיים בתוך 15 דקות.");
      }
      await sleep(POLL_INTERVAL_MS);
      payload = await callApi("map");
    }
    const durationSeconds = Math.round(Number(payload.data?.duration_ms ?? 0) / 1000);
    setRunStatus("success", "✓", `מיפוי Background הסתיים. זמן ריצה: ${isolate(durationSeconds)} שניות.`);
  } catch (error) {
    setRunStatus("error", "✕", error.message);
  } finally {
    setTestButtonsDisabled(false);
  }
});

if (!supabase) {
  showLogin();
  setLoginMessage("יש לעדכן את js/config.js בפרטי Supabase ו־Vercel.");
} else {
  const { data } = await supabase.auth.getSession();
  await refreshSessionView(data.session);
  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => refreshSessionView(session), 0);
  });
}
