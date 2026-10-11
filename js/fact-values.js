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

export const HEBREW_FACT_QUESTIONS = Object.freeze({
  bidder_system_relationship: "האם המציע הוא יצרן המערכת או ספק מורשה בישראל?",
  systems_installed_since_2023_count: "כמה מערכות מהסוג המוצע סופקו והוקמו מאז 1.1.2023?",
  qualifying_active_clients_count: "כמה לקוחות פעילים עומדים בספי נפח המסרים והדיוור שנקבעו?",
  simultaneous_sms_throughput: "מהי יכולת התעבורה בו-זמנית של מסרוני SMS?",
  supports_sms_all_israel_and_international_carriers: "האם קיים ממשק למשלוח SMS בישראל ובחו״ל מול ספקי התקשורת?",
  registered_entity_in_israel: "האם המציע הוא תאגיד רשום כדין בישראל?",
  required_legal_licenses_valid: "האם כל הרישיונות, ההיתרים וההרשאות הנדרשים לפי דין תקפים?",
  public_entities_transactions_compliant: "האם העסק עומד בדרישות חוק עסקאות גופים ציבוריים?",
  going_concern_warning_absent: "האם הדוחות הכספיים המבוקרים לשנתיים האחרונות נקיים מהערת עסק חי?",
  maximum_supported_attachment_size_mb: "מהו גודל הקובץ המצורף המרבי שהמערכת תומכת בו (במגה־בייט)?",
  supports_monthly_and_yearly_reports: "האם המערכת מפיקה דוחות חודשיים ושנתיים?",
  supports_adaptive_sms_length_per_operator: "האם המערכת מתאימה את אורך ה-SMS לכל מפעיל סלולרי?",
  supports_text_to_voice_conversion_kosher_phones: "האם נתמכת המרת טקסט לקול והפצה לטלפונים כשרים?",
  supports_continuous_chat: "האם המערכת מאפשרת ניהול שיח מתמשך עם הנמען בערוץ WhatsApp?",
  supports_smtp_interface: "האם קיימת תמיכה בממשק SMTP להפצת הודעות?",
  supports_api_rest_ws_soap: "האם המערכת תומכת בממשקי API (כגון REST, WS או SOAP)?",
  food_service_avg_daily_diners_experience: "מהו היקף הסועדים היומי הממוצע בניסיון של העסק בהפעלת מערך הסעדה?",
  food_service_experience_start_date: "מהו מועד תחילת הניסיון הרלוונטי בהפעלת מערכי הסעדה?",
  simultaneous_food_service_sites_count: "כמה אתרי הסעדה העסק הפעיל בו-זמנית בתקופה הרלוונטית?",
  simultaneous_food_service_total_daily_diners: "מהו היקף הסועדים היומי המצטבר בכל האתרים שהופעלו בו-זמנית?",
  food_service_reference_clients_count: "כמה לקוחות ממליצים רלוונטיים יש לעסק עבור שירותי הסעדה?",
  dairy_kitchen_daily_diners: "מהו היקף הסועדים היומי של העסק בניסיון בהפעלת מטבח חלבי?",
  dairy_kitchen_experience_years: "כמה שנות ניסיון יש לעסק בהפעלת מטבח חלבי?",
  refreshment_services_annual_value: "מהו ההיקף הכספי השנתי של שירותי כיבוד ללשכות וחדרי דיונים (בש״ח)?",
  head_chef_professional_profile: "מהו הניסיון, הרקע המקצועי ותעודות ההסמכה של השף הראשי המוצע?",
  operations_manager_professional_profile: "מהו הניסיון המקצועי של מנהל התפעול בתחומי תברואה ובטיחות מזון?",
  valid_kosher_certificate: "האם יש לעסק תעודת כשרות תקפה מטעם הרבנות הראשית?",
  valid_food_service_licenses: "האם קיימים רישיונות תקפים לאספקת שירותי הסעדה ומכירת מזון?",
  labor_law_convictions_last_3_years: "כמה הרשעות בהפרת דיני עבודה נרשמו לחובת העסק ב-3 השנים האחרונות?",
  labor_law_financial_sanctions_last_3_years: "כמה עיצומים כספיים בדיני עבודה הוטלו על העסק ב-3 השנים האחרונות?",
  labor_law_fines_last_year: "כמה קנסות בדיני עבודה הוטלו על העסק בשנה האחרונה?",
  is_saas_system: "האם המערכת פועלת בתצורת ענן (SaaS)?",
  supports_private_cloud_or_tenant: "האם המערכת תומכת בענן פרטי או ב-Tenant ייעודי?",
  supports_various_end_devices: "האם המערכת תומכת פונקציונלית במכשירי קצה שונים?",
  supports_accessible_mailing_items: "האם קיימת אפשרות ליצירת פריטי דיוור נגישים כחוק?",
  has_spam_law_compliance_mechanism: "האם קיים מנגנון ניהול משתמשים לפי חוק הספאם?",
  supports_rtl_and_ltr: "האם המערכת תומכת בכיווניות עברית (RTL) ואנגלית (LTR)?",
  supported_languages: "אילו שפות נתמכות במערכת?",
  supports_label_translation: "האם קיימת אפשרות לתרגום תוויות וכותרות?",
  supports_segment_and_group_distribution: "האם נתמכת הפצה לפי פלחים וקבוצות נמענים?",
  supports_sub_lists: "האם המערכת מאפשרת ניהול תתי-רשימות תפוצה?",
  has_web_management_interface: "האם קיים ממשק ניהול אינטרנטי (Web)?",
  supports_multiple_org_admins: "האם המערכת מאפשרת הגדרת מספר מנהלי ארגון?",
  supports_organizational_tree_management: "האם נתמך ניהול עץ ארגוני מלא?",
  supports_system_admin_role: "האם קיימת הרשאת מנהל מערכת?",
  supports_org_admin_role: "האם קיימת הרשאת מנהל ארגון?",
  supports_authorized_user_role: "האם קיימת הרשאת משתמש מורשה?",
  supports_export_to_agreed_format: "האם ניתן לייצא נתונים בפורמט מוסכם?",
  supports_add_block_users: "האם קיים מנגנון הוספה, רישום, חסימה והסרת משתמשים?",
  supports_account_management_and_reports: "האם קיימים מנגנוני ניהול חשבונות והפקת דוחות?",
  supports_sms_to_all_israeli_networks: "האם נתמך משלוח SMS לכל רשתות הסלולר בישראל?",
  supports_mnp: "האם המערכת תומכת בניידות מספרים (MNP)?",
  supports_sms_concatenation_outbound: "האם נתמך שרשור מסרונים יוצאים?",
  supports_sms_concatenation_inbound: "האם נתמך שרשור מסרונים נכנסים?",
  supports_international_sms_without_local_number: "האם נתמך משלוח SMS לחו״ל ללא צורך במספר מקומי?",
  supports_two_way_sms: "האם נתמך משלוח וקבלת מסרונים דו-כיווניים?",
  supports_invalid_number_handling: "האם המערכת מזהה ומטפלת במספרים שגויים?",
  supports_responsive_newsletter_templates: "האם קיימות תבניות ניוזלטר רספונסיביות?",
  supports_links_to_attachments: "האם נתמכת הוספת קישורים לקבצים מצורפים?",
  supports_automated_periodic_newsletters: "האם המערכת שולחת ניוזלטרים תקופתיים באופן אוטומטי?",
  supports_invalid_email_handling: "האם קיים טיפול אוטומטי בכתובות דוא״ל שגויות?",
  supports_outgoing_spam_prevention: "האם קיים מנגנון למניעת ספאם יוצא?",
  supports_html_templates_and_gov_styleguide: "האם התבניות תואמות HTML ומדריך עיצוב ממשלתי?",
  reports_available_anytime: "האם הדוחות זמינים להפקה ולצפייה בכל עת?",
  supports_report_filtering_by_parameters: "האם ניתן לסנן דוחות לפי פרמטרים מגוונים?",
  supports_statistics_and_history: "האם המערכת שומרת נתוני סטטיסטיקה והיסטוריית הפצה?",
  supports_actual_sent_count_by_channel: "האם מוצגת ספירת הודעות שנשלחו בפועל לפי ערוץ?",
  supports_hierarchical_reports: "האם המערכת מפיקה דוחות היררכיים לפי מבנה הארגון?",
  annual_revenue: "מהו מחזור ההכנסות השנתי של העסק (בש״ח)?",
  employee_count: "כמה עובדים מועסקים בעסק?",
  contractor_classification: "מהו הסיווג הקבלני הרשום של העסק?",
  performance_guarantee_amount: "מהו סכום ערבות הביצוע הנדרש (בש״ח)?",
  performance_guarantee_validity: "מהו תוקף ערבות הביצוע?",
  performance_guarantee: "האם נדרשת ערבות ביצוע?",
  bid_bond_amount: "מהו סכום ערבות ההצעה הנדרש (בש״ח)?",
  bid_guarantee_amount: "מהו סכום ערבות ההצעה הנדרש (בש״ח)?",
  bid_bond: "האם נדרשת ערבות הצעה?",
  bid_guarantee: "האם נדרשת ערבות הצעה?",
  bank_guarantee_amount: "מהו סכום הערבות הבנקאית הנדרש (בש״ח)?",
  bank_guarantee_validity: "מהו תוקף הערבות הבנקאית?",
  bank_guarantee: "האם נדרשת ערבות בנקאית?",
  guarantee_amount: "מהו סכום הערבות הנדרש (בש״ח)?",
  guarantee_validity: "מהו תוקף הערבות הנדרש?",
  financial_turnover: "מהו מחזור ההכנסות השנתי של העסק (בש״ח)?",
  annual_turnover: "מהו מחזור ההכנסות השנתי של העסק (בש״ח)?",
  experience_years: "כמה שנות ניסיון נדרשות?",
  professional_liability_insurance: "האם קיים ביטוח אחריות מקצועית?",
  third_party_insurance: "האם קיים ביטוח צד ג׳?",
  employers_liability_insurance: "האם קיים ביטוח חבות מעבידים?",
});

export function translateFactKey(key) {
  if (!key || typeof key !== "string") return null;
  const normalized = key.toLowerCase();
  if (normalized.includes("performance") && normalized.includes("guarantee") && normalized.includes("amount")) {
    return "סכום ערבות ביצוע";
  }
  if ((normalized.includes("bid_bond") || normalized.includes("bid_guarantee")) && normalized.includes("amount")) {
    return "סכום ערבות הצעה";
  }
  if (normalized.includes("bank_guarantee") && normalized.includes("amount")) {
    return "סכום ערבות בנקאית";
  }
  if (normalized.includes("guarantee") && normalized.includes("amount")) {
    return "סכום ערבות";
  }
  if (normalized.includes("guarantee") && normalized.includes("validity")) {
    return "תוקף ערבות";
  }
  if (normalized.includes("turnover") || normalized.includes("revenue")) {
    return "מחזור הכנסות שנתי";
  }
  if (normalized.includes("insurance")) {
    return "ביטוח מתאים";
  }
  return null;
}

export function questionForFact(key, fact = null, registryFact = null) {
  if (fact?.question_he) return fact.question_he;
  if (registryFact?.question_he) return registryFact.question_he;
  if (HEBREW_FACT_QUESTIONS[key]) return HEBREW_FACT_QUESTIONS[key];
  if (fact?.title_he) return fact.title_he;
  if (registryFact?.title_he) return registryFact.title_he;
  if (fact?.description_he) return fact.description_he;
  if (registryFact?.description_he) return registryFact.description_he;

  if (typeof key === "string" && key) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.includes("performance") && normalizedKey.includes("guarantee") && normalizedKey.includes("amount")) {
      return "מהו סכום ערבות הביצוע הנדרש (בש״ח)?";
    }
    if ((normalizedKey.includes("bid_bond") || normalizedKey.includes("bid_guarantee")) && normalizedKey.includes("amount")) {
      return "מהו סכום ערבות ההצעה הנדרש (בש״ח)?";
    }
    if (normalizedKey.includes("bank_guarantee") && normalizedKey.includes("amount")) {
      return "מהו סכום הערבות הבנקאית הנדרש (בש״ח)?";
    }
    if (normalizedKey.includes("guarantee") && normalizedKey.includes("amount")) {
      return "מהו סכום הערבות הנדרש (בש״ח)?";
    }
    if (normalizedKey.includes("guarantee") && normalizedKey.includes("validity")) {
      return "מהו תוקף הערבות הנדרש?";
    }
    if (normalizedKey.includes("turnover") || normalizedKey.includes("revenue")) {
      return "מהו מחזור ההכנסות השנתי (בש״ח)?";
    }
    if (normalizedKey.includes("insurance")) {
      return "האם קיים ביטוח כנדרש במכרז?";
    }
  }

  return "נתון עסק נדרש";
}

export const EXPLANATION_TRANSLATIONS = Object.freeze({
  "the requirement is not automatically checked against the business profile.": "הדרישה אינה נבדקת אוטומטית מול פרופיל העסק.",
  "the requirement was flagged for manual review and is not automatically approved.": "הדרישה סומנה לבדיקה ידנית ואינה מאושרת אוטומטית.",
  "סוג המידע אינו נתמך אוטומטית ב-mvp.": "סוג המידע אינו נתמך אוטומטית ב-MVP.",
  "the data type is not supported automatically in mvp.": "סוג המידע אינו נתמך אוטומטית ב-MVP.",
  "data type is not supported automatically in mvp.": "סוג המידע אינו נתמך אוטומטית ב-MVP.",
  "the corresponding fact is missing from the business profile.": "הנתון המקביל חסר בפרופיל העסק.",
  "missing corresponding data in business profile.": "הנתון המקביל חסר בפרופיל העסק.",
  "the corresponding data is missing from the business profile.": "הנתון המקביל חסר בפרופיל העסק.",
  "the business fact itself requires review.": "נתון העסק עצמו דורש בדיקה.",
  "business fact itself requires review.": "נתון העסק עצמו דורש בדיקה.",
  "business fact type differs from requirement type.": "סוג נתון העסק שונה מסוג הדרישה.",
  "the business fact type differs from the requirement type.": "סוג נתון העסק שונה מסוג הדרישה.",
  "business fact period does not explicitly match requirement period.": "תקופת נתון העסק אינה תואמת במפורש לתקופת הדרישה.",
  "business fact period does not match requirement period.": "תקופת נתון העסק אינה תואמת במפורש לתקופת הדרישה.",
  "business fact scope does not explicitly match requirement scope.": "היקף נתון העסק אינו תואם במפורש להיקף הדרישה.",
  "business fact scope does not match requirement scope.": "היקף נתון העסק אינו תואם במפורש להיקף הדרישה.",
  "business fact unit does not match requirement unit and there is no approved conversion.": "יחידת נתון העסק אינה תואמת ליחידת הדרישה ואין המרה מאושרת.",
  "business fact unit does not match requirement unit and no conversion exists.": "יחידת נתון העסק אינה תואמת ליחידת הדרישה ואין המרה מאושרת.",
  "business fact unit does not match requirement unit.": "יחידת נתון העסק אינה תואמת ליחידת הדרישה ואין המרה מאושרת.",
  "tender submission deadline is unknown, so fact validity cannot be verified.": "מועד ההגשה לא ידוע ולכן אי אפשר לבדוק את תוקף הנתון.",
  "tender submission deadline is unknown, so validity cannot be verified.": "מועד ההגשה לא ידוע ולכן אי אפשר לבדוק את תוקף הנתון.",
  "business fact date is invalid.": "תאריך נתון העסק אינו תקין.",
  "the business fact date is invalid.": "תאריך נתון העסק אינו תקין.",
  "cannot perform comparison deterministically in code.": "לא ניתן לבצע את ההשוואה באופן אוטומטי וחד-משמעי.",
  "the comparison cannot be performed deterministically in code.": "לא ניתן לבצע את ההשוואה באופן אוטומטי וחד-משמעי.",
  "business fact satisfies the condition code-comparable.": "נתון העסק עומד בתנאי שנבדק אוטומטית.",
  "business fact meets code-comparable condition.": "נתון העסק עומד בתנאי שנבדק אוטומטית.",
  "business fact complies with requirement.": "נתון העסק עומד בתנאי שנבדק אוטומטית.",
  "business fact does not satisfy the condition code-comparable.": "נתון העסק אינו עומד בתנאי שנבדק אוטומטית.",
  "business fact does not meet code-comparable condition.": "נתון העסק אינו עומד בתנאי שנבדק אוטומטית.",
  "לא ניתן לבצע את ההשוואה באופן חד-משמעי בקוד.": "לא ניתן לבצע את ההשוואה באופן אוטומטי וחד-משמעי.",
  "נתון העסק עומד בתנאי שניתן להשוואה בקוד.": "נתון העסק עומד בתנאי שנבדק אוטומטית.",
  "נתון העסק אינו עומד בתנאי שניתן להשוואה בקוד.": "נתון העסק אינו עומד בתנאי שנבדק אוטומטית.",
  "circular parent/child structure requires review.": "מבנה Parent/Child מעגלי דורש בדיקה.",
  "no comparison result.": "אין תוצאת השוואה.",
  "parent result was derived from child requirements and is not counted again in totals.": "תוצאת Parent נגזרה מדרישות המשנה ואינה נספרת שוב במונים.",
  "parent result derived from child requirements.": "תוצאת Parent נגזרה מדרישות המשנה ואינה נספרת שוב במונים.",
  "comparison has not been completed.": "ההשוואה טרם הושלמה.",
  "comparison pending.": "ההשוואה טרם הושלמה.",
  "region boundaries require manual review.": "גבולות האזור דורשים בדיקה ידנית.",
});

export function translateToHebrew(text) {
  if (!text || typeof text !== "string") return text ?? "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
  if (EXPLANATION_TRANSLATIONS[normalized]) {
    return EXPLANATION_TRANSLATIONS[normalized];
  }

  // If already Hebrew and doesn't match known English requirement phrases
  if (/[\u0590-\u05ff]/u.test(trimmed) && !/\b(?:guarantee|must be|bid bond|performance)\b/i.test(trimmed)) {
    return trimmed;
  }

  // Regex pattern for guarantee amounts: "The performance guarantee amount must be exactly 300,000 NIS."
  const guaranteeAmountRegex = /^the\s+(performance\s+guarantee|bid\s+bond|bid\s+guarantee|bank\s+guarantee|guarantee)\s+amount\s+must\s+be\s+(exactly|at\s+least|at\s+most)?\s*([\d,]+(?:\.\d+)?)\s*(?:nis|ils|ש"?ח)?\.?$/i;
  const guaranteeAmountMatch = trimmed.match(guaranteeAmountRegex);
  if (guaranteeAmountMatch) {
    const [, kindRaw, opRaw, amount] = guaranteeAmountMatch;
    const kindMap = {
      "performance guarantee": "סכום ערבות הביצוע",
      "bid bond": "סכום ערבות ההצעה",
      "bid guarantee": "סכום ערבות ההצעה",
      "bank guarantee": "סכום הערבות הבנקאית",
      "guarantee": "סכום הערבות",
    };
    const opMap = {
      "exactly": "בדיוק",
      "at least": "לפחות",
      "at most": "לכל היותר",
    };
    const kind = kindMap[kindRaw.toLowerCase()] || "סכום הערבות";
    const op = opRaw ? ` ${opMap[opRaw.toLowerCase()] || ""}` : "";
    return `${kind} חייב להיות${op} ${amount} ש״ח.`;
  }

  // Regex pattern for guarantee validity
  const guaranteeValidityRegex = /^the\s+(?:performance\s+guarantee|bid\s+bond|bank\s+guarantee|guarantee)?\s*validity\s+must\s+be\s+(at\s+least|at\s+most|exactly)?\s*(\d+)\s*(days|months|years)?\.?$/i;
  const validityMatch = trimmed.match(guaranteeValidityRegex);
  if (validityMatch) {
    const [, opRaw, count, unitRaw] = validityMatch;
    const opMap = { "at least": "לפחות", "at most": "לכל היותר", "exactly": "בדיוק" };
    const unitMap = { "days": "ימים", "months": "חודשים", "years": "שנים" };
    const op = opRaw ? `${opMap[opRaw.toLowerCase()] || ""} ` : "";
    const unit = unitRaw ? ` ${unitMap[unitRaw.toLowerCase()] || unitRaw}` : "";
    return `תוקף הערבות חייב להיות ${op}${count}${unit}.`;
  }

  if (/^the bidder must be a registered entity in israel\.?$/i.test(trimmed)) {
    return "המציע חייב להיות תאגיד רשום כדין בישראל.";
  }
  if (/^the bidder must hold valid legal licenses\.?$/i.test(trimmed)) {
    return "המציע חייב להחזיק ברישיונות והיתרים תקפים כחוק.";
  }
  if (/^the business must be able to serve the required number of diners\.?$/i.test(trimmed)) {
    return "על העסק להיות מסוגל לשרת את מספר הסועדים הנדרש.";
  }

  // General "The ... must be ..." translation
  const generalMustBeMatch = trimmed.match(/^the\s+(.+?)\s+must\s+be\s+(.+?)\.?$/i);
  if (generalMustBeMatch) {
    const [, subject, predicate] = generalMustBeMatch;
    const heSubject = subject
      .replace(/performance guarantee amount/gi, "סכום ערבות הביצוע")
      .replace(/bid bond amount/gi, "סכום ערבות ההצעה")
      .replace(/bid guarantee amount/gi, "סכום ערבות ההצעה")
      .replace(/bank guarantee amount/gi, "סכום הערבות הבנקאית")
      .replace(/guarantee amount/gi, "סכום הערבות")
      .replace(/annual turnover/gi, "מחזור ההכנסות השנתי")
      .replace(/annual revenue/gi, "מחזור ההכנסות השנתי")
      .replace(/system/gi, "המערכת")
      .replace(/bidder/gi, "המציע")
      .replace(/business/gi, "העסק");

    const hePredicate = predicate
      .replace(/exactly/gi, "בדיוק")
      .replace(/at least/gi, "לפחות")
      .replace(/at most/gi, "לכל היותר")
      .replace(/\bnis\b/gi, "ש״ח")
      .replace(/\bils\b/gi, "ש״ח");

    if (heSubject !== subject || hePredicate !== predicate) {
      return `${heSubject} חייב להיות ${hePredicate}.`.trim();
    }
  }

  return trimmed;
}

export const SCOPE_TRANSLATIONS = Object.freeze({
  "all sites": "כל האתרים",
  "all_sites": "כל האתרים",
  "single site": "אתר בודד",
  "single_site": "אתר בודד",
  "nationwide": "פריסה ארצית",
  "israel": "ישראל",
  "international": "בינלאומי",
  "legal_entity": "תאגיד משפטי",
});

export const PERIOD_TRANSLATIONS = Object.freeze({
  "past 3 years": "3 השנים האחרונות",
  "last 3 years": "3 השנים האחרונות",
  "last 2 years": "שנתיים אחרונות",
  "last year": "בשנה האחרונה",
  "past 5 years": "5 השנים האחרונות",
  "annual": "שנתי",
  "monthly": "חודשי",
});

export const SOURCE_TYPE_TRANSLATIONS = Object.freeze({
  table: "טבלה",
  text: "טקסט",
  header: "כותרת",
  footnote: "הערת שוליים",
});

export const REQUIREMENT_TYPE_TRANSLATIONS = Object.freeze({
  threshold: "תנאי סף",
  technical: "טכני",
  financial: "פיננסי",
  legal: "משפטי",
  administrative: "מנהלי",
  quality: "איכות",
  security: "אבטחת מידע",
  sla: "רמת שירות (SLA)",
  guarantee: "ערבות",
  insurance: "ביטוח",
  experience: "ניסיון",
  validity: "תוקף",
  mandatory: "חובה",
  evaluation: "ניקוד",
});

export const CATEGORY_TRANSLATIONS = Object.freeze({
  deadlines: "לוחות זמנים",
  eligibility: "תנאי סף",
  submission: "הגשת הצעה",
  guarantee: "ערבויות",
  evaluation: "כללי ניקוד",
  technical_mandatory: "דרישות טכניות חובה",
  quality: "איכות",
  implementation: "יישום ותפעול",
  sla: "רמת שירות (SLA)",
  cybersecurity: "אבטחת מידע וסייבר",
  insurance: "ביטוח",
  financial: "פיננסי ותמחור",
  contract: "תנאי חוזה",
  forms: "טפסים והצהרות",
  post_award: "התחייבויות לאחר זכייה",
  other: "כללי",
});

export function translateScope(scope) {
  if (!scope) return scope;
  return SCOPE_TRANSLATIONS[String(scope).trim().toLowerCase()] ?? scope;
}

export function translatePeriod(period) {
  if (!period) return period;
  return PERIOD_TRANSLATIONS[String(period).trim().toLowerCase()] ?? period;
}

export function translateSourceType(type) {
  if (!type) return type;
  return SOURCE_TYPE_TRANSLATIONS[String(type).trim().toLowerCase()] ?? type;
}

export function translateRequirementType(type) {
  if (!type) return type;
  return REQUIREMENT_TYPE_TRANSLATIONS[String(type).trim().toLowerCase()] ?? type;
}

export function translateCategory(category) {
  if (!category) return category;
  const normalized = String(category).trim().toLowerCase().replace(/[\s-]+/g, "_");
  return CATEGORY_TRANSLATIONS[normalized] ?? null;
}


