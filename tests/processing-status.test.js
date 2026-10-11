import test from "node:test";
import assert from "node:assert/strict";

import { applyProcessingEvent, buildProcessingStatus } from "../lib/processing-status.js";

test("processing status exposes the documented six user phases", () => {
  const view = buildProcessingStatus({ steps: {}, regions: {} });
  assert.deepEqual(view.phases.map((phase) => phase.id), ["upload", "map", "extract", "validate", "facts", "compare"]);
  assert.equal(view.currentStep, 1);
  assert.equal(view.percent, 0);
});

test("region progress is aggregated from the persisted processing state", () => {
  const view = buildProcessingStatus({
    steps: { upload: { status: "done" }, map: { status: "done" }, metadata: { status: "done" } },
    regions: { a: { status: "done" }, b: { status: "waiting" }, c: { status: "pending" } },
  });
  assert.equal(view.phases[2].status, "working");
  assert.equal(view.phases[2].detail, "אזור 2 מתוך 3");
  assert.deepEqual(view.regionProgress, { completed: 1, total: 3 });
  assert.equal(view.currentStep, 3);
});

test("a metadata failure does not fail mapping when the map completed", () => {
  const view = buildProcessingStatus({
    steps: { map: { status: "done" }, metadata: { status: "failed" } },
    regions: {},
  });
  assert.equal(view.phases[1].status, "done");
  assert.equal(view.metadataStatus, "failed");
});

test("mapping stays active while parallel metadata is still pending", () => {
  const view = buildProcessingStatus({ steps: { upload: { status: "done" }, map: { status: "done" }, metadata: { status: "pending" } }, regions: {} });
  assert.equal(view.phases[1].status, "working");
  assert.equal(view.currentStep, 2);
});

test("facts finish when code comparison is stored while Fit Analysis is waiting", () => {
  const view = buildProcessingStatus({
    steps: {
      upload: { status: "done" }, map: { status: "done" }, metadata: { status: "done" },
      validate: { status: "done" }, compare: { status: "waiting", phase: "fit_analysis", code_finished_at: "2026-10-11T10:00:00Z" },
    },
    regions: { a: { status: "done" } },
  });
  assert.equal(view.phases[4].status, "done");
  assert.equal(view.phases[5].status, "working");
  assert.equal(view.currentStep, 6);
});

test("completed persisted processing returns six of six", () => {
  const view = buildProcessingStatus({
    steps: {
      upload: { status: "done" }, map: { status: "done" }, metadata: { status: "done" },
      validate: { status: "done" }, compare: { status: "done", code_finished_at: "2026-10-11T10:00:00Z" },
    },
    regions: { a: { status: "done" }, b: { status: "done" } },
  });
  assert.equal(view.complete, true);
  assert.equal(view.currentStep, 6);
  assert.equal(view.percent, 100);
});

test("pipeline events update the local snapshot without inventing a server step", () => {
  const started = applyProcessingEvent({ steps: {}, regions: {} }, { step: "extract", state: "starting", total: 2 });
  const finished = applyProcessingEvent(started, { step: "extract", state: "done", regionId: "region-1" });
  assert.equal(Object.keys(finished.regions).length, 2);
  assert.equal(finished.regions["region-1"].status, "done");
  assert.equal(finished.steps.extract, undefined);
});
