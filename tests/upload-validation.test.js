import assert from "node:assert/strict";
import test from "node:test";

import { MAX_UPLOAD_BYTES, validateUploadFile } from "../js/upload-validation.js";

test("upload validation accepts a non-empty PDF", () => {
  assert.doesNotThrow(() => validateUploadFile({ name: "tender.pdf", type: "application/pdf", size: 42 }));
});

test("upload validation reports the approved M2 edge-case messages", () => {
  assert.throws(
    () => validateUploadFile({ name: "tender.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 42 }),
    { code: "not_pdf", message: "✕ ניתן להעלות קובץ PDF בלבד" },
  );
  assert.throws(
    () => validateUploadFile({ name: "large.pdf", type: "application/pdf", size: MAX_UPLOAD_BYTES + 1 }),
    { code: "pdf_too_large", message: "✕ ניתן להעלות קובץ עד 50MB" },
  );
  assert.throws(
    () => validateUploadFile({ name: "empty.pdf", type: "application/pdf", size: 0 }),
    { code: "empty_file", message: "✕ הקובץ ריק" },
  );
});
