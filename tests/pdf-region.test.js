import assert from "node:assert/strict";
import test from "node:test";

import { PDFDocument, PDFName } from "pdf-lib";

import {
  createRegionPdfExcerpt,
  normalizeExcerptSourcePages,
  planRegionExcerpt,
} from "../lib/pdf-region.js";

async function samplePdf(pageCount = 10) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    pdf.addPage([500 + index, 700 + index]);
  }
  return new Uint8Array(await pdf.save());
}

test("a normal region gets one context page on each side", () => {
  assert.deepEqual(planRegionExcerpt({ start_page: 4, end_page: 6 }, 10), {
    mode: "region_excerpt",
    target_start_page: 4,
    target_end_page: 6,
    excerpt_start_page: 3,
    excerpt_end_page: 7,
    overlap_before: 1,
    overlap_after: 1,
    page_count: 5,
    original_page_count: 10,
  });
});

test("tables and uncertain boundaries get two context pages", () => {
  const table = planRegionExcerpt({ start_page: 4, end_page: 6, contains_tables: true }, 10);
  const uncertain = planRegionExcerpt({ start_page: 4, end_page: 6, boundary_confidence: "low" }, 10);
  assert.equal(table.excerpt_start_page, 2);
  assert.equal(table.excerpt_end_page, 8);
  assert.equal(uncertain.excerpt_start_page, 2);
  assert.equal(uncertain.excerpt_end_page, 8);
});

test("excerpt boundaries are clamped to the source PDF", () => {
  const plan = planRegionExcerpt({ start_page: 1, end_page: 2, contains_tables: true }, 10);
  assert.equal(plan.excerpt_start_page, 1);
  assert.equal(plan.excerpt_end_page, 4);
  assert.equal(plan.overlap_before, 0);
});

test("an excerpt contains only the selected pages and preserves their dimensions", async () => {
  const result = await createRegionPdfExcerpt(await samplePdf(), { start_page: 4, end_page: 6 });
  const excerpt = await PDFDocument.load(result.bytes);
  assert.equal(excerpt.getPageCount(), 5);
  assert.deepEqual(excerpt.getPage(0).getSize(), { width: 502, height: 702 });
  assert.deepEqual(excerpt.getPage(4).getSize(), { width: 506, height: 706 });
  assert.ok(excerpt.catalog.get(PDFName.of("PageLabels")));
});

test("excerpt-relative source pages are restored to original tender pages", () => {
  const info = planRegionExcerpt({ start_page: 13, end_page: 15 }, 30);
  const normalized = normalizeExcerptSourcePages([
    { requirement_id: "a", source_page: 2 },
    { requirement_id: "b", source_page: 4 },
  ], info);
  assert.equal(normalized[0].source_page, 13);
  assert.equal(normalized[1].source_page, 15);
  assert.equal(normalized[0].requires_manual_review, undefined);
});

test("a requirement extracted from an overlap page is retained but flagged", () => {
  const info = planRegionExcerpt({ start_page: 13, end_page: 15 }, 30);
  const [normalized] = normalizeExcerptSourcePages([
    { requirement_id: "a", source_page: 1 },
  ], info);
  assert.equal(normalized.source_page, 12);
  assert.equal(normalized.requires_manual_review, true);
  assert.match(normalized.review_reason, /עמוד הקשר/);
});

test("invalid region boundaries are rejected before model submission", () => {
  assert.throws(
    () => planRegionExcerpt({ start_page: 8, end_page: 12 }, 10),
    /outside the PDF/,
  );
});
