const RETRYABLE_REGION_ERRORS = new Set([
  "extract_failed",
  "extract_timeout",
  "extract_schema_invalid",
  "invalid_model_json",
]);

const RETRYABLE_STEP_ERRORS = Object.freeze({
  map: new Set([
    "mapper_submit_failed",
    "mapper_failed",
    "mapper_timeout",
    "mapper_schema_invalid",
    "invalid_model_json",
    "network_error",
  ]),
  metadata: new Set([
    "metadata_submit_failed",
    "metadata_failed",
    "metadata_timeout",
    "metadata_schema_invalid",
    "invalid_model_json",
    "network_error",
  ]),
});

export function shouldRetryRegion(code) {
  return RETRYABLE_REGION_ERRORS.has(code);
}

export function shouldRetryStep(step, code) {
  return RETRYABLE_STEP_ERRORS[step]?.has(code) ?? false;
}
