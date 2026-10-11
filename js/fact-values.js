export const FACT_STATUS = Object.freeze({
  known: { icon: "✓", label: "ידוע" },
  missing: { icon: "?", label: "חסר מידע" },
  needs_review: { icon: "!", label: "דורש בדיקה" },
});

export const RESULT_STATUS = Object.freeze({
  gap: { icon: "✕", label: "פער" },
  missing: { icon: "?", label: "חסר מידע" },
  review: { icon: "!", label: "דורש בדיקה" },
  met: { icon: "✓", label: "עומד" },
});

export function parseFactInput(type, rawValue) {
  if (type === "number" || type === "currency") {
    const normalized = String(rawValue ?? "").replace(/,/g, "").trim();
    if (!normalized) return null;
    const value = Number(normalized);
    if (!Number.isFinite(value)) throw new Error("יש להזין מספר תקין.");
    return value;
  }
  if (type === "boolean") {
    if (rawValue === true || rawValue === "true") return true;
    if (rawValue === false || rawValue === "false") return false;
    return null;
  }
  const value = String(rawValue ?? "").trim();
  return value || null;
}

export function formatFactValue(fact) {
  if (!fact || fact.value === null || fact.value === undefined || fact.value === "") return "לא הוזן";
  if (fact.business_fact_type === "boolean") return fact.value === true || fact.value === "true" ? "כן" : "לא";
  if (["number", "currency"].includes(fact.business_fact_type) && Number.isFinite(Number(fact.value))) {
    return new Intl.NumberFormat("he-IL").format(Number(fact.value));
  }
  return String(fact.value);
}

export function inputKindForFact(type) {
  if (type === "number" || type === "currency") return "number";
  if (type === "date") return "date";
  if (type === "boolean" || type === "enum") return "select";
  return "text";
}

export const FACT_TYPE_LABELS = Object.freeze({
  number: "מספר",
  currency: "מטבע (ש״ח)",
  boolean: "כן / לא",
  date: "תאריך",
  enum: "בחירה מרשימה",
  string: "טקסט חופשי",
});

export const UNIT_LABELS = Object.freeze({
  sites: "אתרים",
  diners: "סועדים",
  systems: "מערכות",
  clients: "לקוחות",
  years: "שנים",
  months: "חודשים",
  days: "ימים",
  hours: "שעות",
  projects: "פרויקטים",
  ILS: "ש״ח",
  USD: "דולר",
  percent: "%",
  MB: "מגה־בייט",
  SMS: "מסרונים",
  convictions: "הרשעות",
  sanctions: "עיצומים",
  fines: "קנסות",
});

export const ENUM_VALUE_LABELS = Object.freeze({
  authorized_supplier: "ספק מורשה בישראל",
  manufacturer: "יצרן המערכת",
});

export function formatFactType(type) {
  return FACT_TYPE_LABELS[type] ?? type ?? "נתון";
}

export function formatFactUnit(unit) {
  return UNIT_LABELS[unit] ?? unit ?? "";
}

export function formatFactOption(value) {
  return ENUM_VALUE_LABELS[value] ?? value;
}
