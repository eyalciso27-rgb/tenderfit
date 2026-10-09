// These values are intentionally public client-side configuration.
export const CONFIG = Object.freeze({
  supabaseUrl: "https://xfgsaovqafirulakzlqh.supabase.co",
  supabasePublishableKey: "sb_publishable_xX7cUR1QMy8wL9O91Do23A_n2-m7iXJ",
  apiBaseUrl: "https://tenderfit-dun.vercel.app",
});

export function isConfigured() {
  return !Object.values(CONFIG).some((value) => value.includes("YOUR_") || value.includes("REPLACE_ME"));
}
