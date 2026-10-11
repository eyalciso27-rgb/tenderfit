import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTenderMetadata } from "../lib/tender-metadata.js";

test("F15 metadata is normalized for summary, critical dates and guarantees", () => {
  const output = normalizeTenderMetadata({
    executive_summary: "אספקת שירותי הסעדה.",
    submission_deadline: { iso: "2026-09-24T14:00:00+03:00", source_page: 22, source_section: "7", source_quote: "מועד אחרון" },
    critical_dates: [{ label: "סיור מציעים", iso: null, source_page: 15, source_section: "4", source_quote: "סיור מציעים" }],
    guarantees: [{ type: "ערבות ביצוע", amount: "300000", currency: "ILS", valid_until: null, source_page: 154, source_section: "נספח ג", source_quote: "סכום הערבות" }],
    notes: [],
  });
  assert.equal(output.executiveSummary, "אספקת שירותי הסעדה.");
  assert.equal(output.dates.length, 2);
  assert.equal(output.dates[1].iso, null);
  assert.equal(output.guarantees[0].source.page, 154);
});

test("missing F15 fields stay empty instead of becoming an error or invented value", () => {
  assert.deepEqual(normalizeTenderMetadata({}), {
    executiveSummary: null,
    dates: [],
    guarantees: [],
    notes: [],
  });
});

test("database deadline is a source-free fallback when F15 deadline is absent", () => {
  const output = normalizeTenderMetadata({ critical_dates: [] }, "2026-12-01T10:00:00Z");
  assert.equal(output.dates[0].label, "מועד אחרון להגשה");
  assert.equal(output.dates[0].iso, "2026-12-01T10:00:00Z");
  assert.equal(output.dates[0].source.page, null);
});

test("an exact submission-date duplicate is not shown twice", () => {
  const item = { label: "מועד אחרון להגשה", iso: "2026-12-01T10:00:00Z", source_page: 2, source_section: null, source_quote: "עד 10:00" };
  const output = normalizeTenderMetadata({ submission_deadline: item, critical_dates: [item] });
  assert.equal(output.dates.length, 1);
});
