import test from "node:test";
import assert from "node:assert/strict";

import { tenderDemoNotice } from "../js/demo-tender.js";

test("shows a clear notice only for an explicitly marked demo tender", () => {
  assert.equal(tenderDemoNotice({}), null);
  assert.equal(tenderDemoNotice({ demo: { is_demo: false, notice_he: "לא יוצג" } }), null);
  assert.equal(
    tenderDemoNotice({ demo: { is_demo: true, notice_he: "  מועד הדגמה  " } }),
    "מועד הדגמה",
  );
  assert.match(tenderDemoNotice({ demo: { is_demo: true } }), /אינו המועד המקורי/);
});
