import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AI_ROOT = path.join(REPO_ROOT, "ai");
const BASELINE_NAME_PATTERN = /^[a-z0-9][a-z0-9.-]*$/;

export class BaselineIntegrityError extends Error {
  constructor(message) {
    super(message);
    this.name = "BaselineIntegrityError";
    this.code = "baseline_integrity_failed";
  }
}

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export async function verifyBaselineDirectory(directoryPath) {
  const manifestPath = path.join(directoryPath, "BASELINE_MANIFEST.json");
  let manifest;

  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    throw new BaselineIntegrityError("Baseline manifest is missing or invalid.");
  }

  if (!manifest.runtime_files || typeof manifest.runtime_files !== "object") {
    throw new BaselineIntegrityError("Baseline manifest has no runtime_files map.");
  }

  const files = {};
  for (const [relativeName, expectedHash] of Object.entries(manifest.runtime_files)) {
    const filePath = path.resolve(directoryPath, relativeName);
    const relativePath = path.relative(directoryPath, filePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new BaselineIntegrityError("Baseline manifest contains an unsafe path.");
    }

    let content;
    try {
      content = await readFile(filePath);
    } catch {
      throw new BaselineIntegrityError(`Baseline runtime file is missing: ${relativeName}`);
    }

    if (sha256(content) !== expectedHash) {
      throw new BaselineIntegrityError(`Baseline hash mismatch: ${relativeName}`);
    }
    files[relativeName] = content;
  }

  return { manifest, files };
}

export async function loadBaseline(name) {
  if (!BASELINE_NAME_PATTERN.test(name)) {
    throw new BaselineIntegrityError("Invalid baseline name.");
  }

  const directoryPath = path.join(AI_ROOT, name);
  const verified = await verifyBaselineDirectory(directoryPath);
  const text = Object.fromEntries(
    Object.entries(verified.files).map(([fileName, content]) => [fileName, content.toString("utf8")]),
  );

  return { ...verified, text };
}

export async function loadMapperBaseline() {
  const baseline = await loadBaseline("mapper-v1.2");
  return {
    manifest: baseline.manifest,
    systemInstruction: baseline.text["system_instructions.txt"],
    userPrompt: baseline.text["user_prompt.txt"],
    schema: JSON.parse(baseline.text["structured_output_schema.json"]),
    settings: JSON.parse(baseline.text["settings.json"]),
  };
}
