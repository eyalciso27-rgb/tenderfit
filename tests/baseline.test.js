import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BaselineIntegrityError,
  loadBaseline,
  loadExtractorBaseline,
  loadFitAnalysisBaseline,
  loadMapperBaseline,
  loadMetadataBaseline,
  verifyBaselineDirectory,
} from "../lib/baseline.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("all frozen AI runtime files match their SHA-256 manifests", async () => {
  const mapper = await loadBaseline("mapper-v1.2");
  const extractor = await loadBaseline("extractor-v3.5");
  const extractorProduction = await loadBaseline("extractor-v3.6");
  const metadata = await loadBaseline("metadata-f15");
  const fitAnalysisV10 = await loadBaseline("fit-f18");
  const fitAnalysis = await loadBaseline("fit-f18-v1.1");

  assert.equal(mapper.manifest.version, "v1.2");
  assert.equal(extractor.manifest.version, "v3.5");
  assert.equal(extractorProduction.manifest.version, "v3.6");
  assert.equal(metadata.manifest.version, "f15-v1.0");
  assert.equal(fitAnalysisV10.manifest.version, "f18-v1.0");
  assert.equal(fitAnalysis.manifest.version, "f18-v1.1");
});

test("all active AI baselines remain explicitly configured for Gemini Pro", async () => {
  const baselines = await Promise.all([
    loadMapperBaseline(),
    loadExtractorBaseline(),
    loadMetadataBaseline(),
    loadFitAnalysisBaseline(),
  ]);

  for (const baseline of baselines) {
    assert.equal(baseline.settings.model, "gemini-3.1-pro-preview");
  }
});

test("baseline verification rejects a modified runtime file", async (context) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "tenderfit-baseline-"));
  context.after(() => rm(temporaryRoot, { recursive: true, force: true }));

  const sourceRoot = path.join(REPO_ROOT, "ai", "mapper-v1.2");
  for (const fileName of [
    "BASELINE_MANIFEST.json",
    "system_instructions.txt",
    "user_prompt.txt",
    "structured_output_schema.json",
    "settings.json",
  ]) {
    await writeFile(
      path.join(temporaryRoot, fileName),
      await readFile(path.join(sourceRoot, fileName)),
    );
  }
  await writeFile(path.join(temporaryRoot, "user_prompt.txt"), "tampered\n");

  await assert.rejects(
    verifyBaselineDirectory(temporaryRoot),
    (error) => error instanceof BaselineIntegrityError && error.code === "baseline_integrity_failed",
  );
});
