// Publishable Supabase values are intentionally public. Replace these three
// placeholders after creating the M1 Supabase and Vercel projects.
export const CONFIG = Object.freeze({
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabasePublishableKey: "sb_publishable_REPLACE_ME",
  apiBaseUrl: "https://YOUR_VERCEL_PROJECT.vercel.app",
});

export function isConfigured() {
  return !Object.values(CONFIG).some((value) => value.includes("YOUR_") || value.includes("REPLACE_ME"));
}
