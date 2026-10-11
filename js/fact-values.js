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
});

export function questionForFact(key, fact = null, registryFact = null) {
  if (fact?.question_he) return fact.question_he;
  if (registryFact?.question_he) return registryFact.question_he;
  if (HEBREW_FACT_QUESTIONS[key]) return HEBREW_FACT_QUESTIONS[key];
  if (fact?.title_he) return fact.title_he;
  if (registryFact?.title_he) return registryFact.title_he;
  if (fact?.description_he) return fact.description_he;
  if (registryFact?.description_he) return registryFact.description_he;
  return "נתון עסק נדרש";
}

