import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const auth = await readFile(new URL("../js/auth.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../css/styles.css", import.meta.url), "utf8");

test("login keeps password authentication and adds an accessible Google option", () => {
  assert.match(html, /id="login-form"/);
  assert.match(html, /id="google-login-button"[^>]*type="button"/);
  assert.match(html, /התחברות באמצעות Google/);
  assert.match(html, /אינו מעניק[^<]*גישה ל־Gmail או ל־Drive/);
  assert.match(styles, /#google-login-button\s*\{[^}]*width:\s*100%/s);
});

test("Google login uses Supabase OAuth with a same-site callback", () => {
  assert.match(auth, /signInWithOAuth\(\{\s*provider:\s*"google"/s);
  assert.match(auth, /redirectTo:\s*googleRedirectUrl\(\)/);
  assert.match(auth, /new URL\("index\.html", window\.location\.href\)/);
  assert.doesNotMatch(auth, /provider_token|provider_refresh_token|localStorage\.setItem/);
});

test("both login controls are locked while authentication is in progress", () => {
  assert.match(auth, /loginButton\.disabled = isBusy/);
  assert.match(auth, /googleLoginButton\.disabled = isBusy/);
  assert.match(auth, /loginForm\.setAttribute\("aria-busy", String\(isBusy\)\)/);
});
