export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function validateUploadFile(file) {
  if (!file || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
    const error = new Error("✕ ניתן להעלות קובץ PDF בלבד");
    error.code = "not_pdf";
    throw error;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const error = new Error("✕ ניתן להעלות קובץ עד 50MB");
    error.code = "pdf_too_large";
    throw error;
  }
  if (file.size === 0) {
    const error = new Error("✕ הקובץ ריק");
    error.code = "empty_file";
    throw error;
  }
}
