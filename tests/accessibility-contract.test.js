import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const screens = ["index.html", "upload.html", "profile.html", "tender.html", "checklist.html"];

for (const screen of screens) {
  test(`${screen} has the basic Hebrew accessibility landmarks`, async () => {
    const html = await readFile(new URL(`../${screen}`, import.meta.url), "utf8");
    assert.match(html, /<html lang="he" dir="rtl">/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(html, /<main\b/);
    assert.match(html, /<h1\b/);
  });
}

test("shared controls have keyboard focus and minimum touch-target rules", async () => {
  const styles = await readFile(new URL("../css/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.button:focus-visible/);
  assert.match(styles, /button,\s*\nselect\s*\{\s*\n\s*min-height: 44px/);
  assert.match(styles, /input,\s*\nselect,\s*\ntextarea\s*\{[^}]*min-height: 44px/s);
});
