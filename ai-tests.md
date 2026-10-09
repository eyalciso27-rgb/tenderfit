# TenderFit AI Tests

## מטרה

מסמך זה מרכז את מקרי ה-Regression הפורמליים ואת יומן ריצות ה-API של TenderFit.

**Baselines מאומתים**
- Requirement Mapper V1.2 — **MVP VALIDATED**
- Requirement Extractor V3.5 — **MVP VALIDATED**

**כלל:** AI extracts and normalizes; Code compares; Human decides.

כל שינוי ב-Prompt / Schema / Model / Temperature מחייב Version bump והרצה מחודשת של TEST-01 עד TEST-10.

---

# חלק א' — 10 מקרי Regression ניתנים להרצה מחדש

כל הקלטים בחלק זה הם ציטוטים אמיתיים ממכרז 2/2025, בעיקר מעמודים 25–28.  
"הפלט שהתקבל" מבוסס על פלט V3.5 שנשמר בפועל במהלך האימות.

## TEST-01 — Stage + Parent/Child בדרישה מורכבת

**קלט — מכרז 2/2025, עמ' 25, שורה 2:**

> המערכת תתמוך פונקציונאלית בכל דרישות החוק והתקנים המחייבים, לרבות דרישות בדבר התאמה למכשירי קצה שונים, לרבות אפשרות ליצירת פריטי דיוור נגישים בהתאם להוראות חוק שוויון זכויות לאנשים עם מוגבלות, התשנ"ח - 1988, וקיומו של מנגנון ניהול, רישום, חסימה והסרה של משתמשים, המנויים לצורך הפצה על ידי המערכת, המאפשר למערכת לעמוד בהוראות סעיף 30א לחוק התקשורת.

**פלט צפוי:**
```yaml
requirement_target: business_fact
stage: evaluation
logic_type: all_of
qualifier: all
parent_requirement_id: null
code_comparable: false
children:
  - התאמה למכשירי קצה שונים
  - יצירת פריטי דיוור נגישים
  - מנגנון ניהול/רישום/חסימה/הסרה
```

**פלט שהתקבל:**
```yaml
requirement_id: REQ_2_PARENT
requirement_target: business_fact
stage: evaluation
logic_type: all_of
qualifier: all
code_comparable: false

REQ_2_1:
  requirement_text: התאמה למכשירי קצה שונים.
  stage: evaluation
  logic_type: simple
  parent_requirement_id: REQ_2_PARENT
  business_fact_key: supports_multiple_endpoint_devices

REQ_2_2:
  requirement_text: אפשרות ליצירת פריטי דיוור נגישים...
  stage: evaluation
  logic_type: simple
  parent_requirement_id: REQ_2_PARENT
  business_fact_key: supports_accessible_mailings_per_law
```

**תוצאה:** PASS

---

## TEST-02 — פירוק שורת Newsletter לכמה דרישות אטומיות

**קלט — מכרז 2/2025, עמ' 26, שורה 17:**

> יצירה של פריט דיוור באמצעות התבנית: ריספונסיבי ומותאם בהתאם למכשיר המשתמש. אפשרות לצרף קבצים עד 40 מגבייט (MB) מפורמטים שונים (ללא הגבלת פורמט – קבצי אופיס, תמונה, וידאו וכדומה). אפשרות שילוב קישור לקבצים מצורפים.

**פלט צפוי:**
```yaml
logic_type: all_of
qualifier: all
children:
  - responsive_template
  - maximum_supported_attachment_size_mb
  - supports_links_to_attachments
```

**פלט שהתקבל:**
```yaml
parent:
  logic_type: all_of
  qualifier: all
  stage: evaluation

REQ_17_1:
  business_fact_key: supports_responsive_newsletter_templates
  logic_type: simple
  parent_requirement_id: REQ_17_PARENT

REQ_17_2:
  business_fact_key: maximum_supported_attachment_size_mb
  value: 40
  unit: MB
  comparison_operator: ">="
  parent_requirement_id: REQ_17_PARENT

REQ_17_3:
  business_fact_key: supports_links_to_attachments
  logic_type: simple
  parent_requirement_id: REQ_17_PARENT
```

**תוצאה:** PASS

---

## TEST-03 — תמיכה בקבצים עד 40MB

**קלט — מכרז 2/2025, עמ' 26:**

> אפשרות לצרף קבצים עד 40 מגבייט (MB) מפורמטים שונים (ללא הגבלת פורמט – קבצי אופיס, תמונה, וידאו וכדומה).

**פלט צפוי:**
```yaml
requirement_type: threshold
requirement_target: business_fact
stage: evaluation
business_fact_key: maximum_supported_attachment_size_mb
business_fact_type: number
value: 40
unit: MB
comparison_operator: ">="
code_comparable: true
```

**פלט שהתקבל:**
```yaml
requirement_id: REQ_17_2
requirement_type: threshold
requirement_target: business_fact
stage: evaluation
business_fact_key: maximum_supported_attachment_size_mb
business_fact_type: number
value: "40"
unit: MB
comparison_operator: ">="
code_comparable: true
confidence: high
```

**תוצאה:** PASS

---

## TEST-04 — דוחות חודשיים ושנתיים

**קלט — מכרז 2/2025, עמ' 27, שורה 22:**

> דו"חות אלו יתאפשרו להפקה הן ברמת דו"ח חודשי והן ברמת דו"ח שנתי, לכל תקופת ההתקשרות במכרז.

**פלט צפוי:**
```yaml
requirement_target: business_fact
stage: evaluation
logic_type: simple
business_fact_key: supports_monthly_and_yearly_reports
business_fact_type: boolean
code_comparable: false
```

**פלט שהתקבל:**
```yaml
requirement_id: REQ_22_5
requirement_text: יכולת הפקת הדו"חות ברמת דו"ח חודשי וברמת דו"ח שנתי.
requirement_target: business_fact
stage: evaluation
logic_type: simple
business_fact_key: supports_monthly_and_yearly_reports
business_fact_type: boolean
code_comparable: false
confidence: high
```

**תוצאה:** PASS

---

## TEST-05 — פירוק 7 פריטי LOG

**קלט — מכרז 2/2025, עמ' 27, שורה 23:**

> כל פעולה המתבצעת במערכת תירשם ביומן המערכת (LOG). בין השאר יירשמו הפרטים הבאים:  
> 1) תוכן הפריט.  
> 2) שולח הפריט – שם והמען הדיגיטלי של השולח.  
> 3) תאריך ושעת השליחה.  
> 4) חיווי פתיחה/קריאה/כשל/שליחה.  
> 5) מספר היעד/כתובת מייל.  
> 6) יכולת שמירה ב-LOG של ID המתקבל מלקוחות.  
> 7) תקלות משלוח.

**פלט צפוי:**
```yaml
parent:
  logic_type: all_of
  qualifier: all
  stage: evaluation
children_count: 7
```

**פלט שהתקבל:**
```yaml
requirement_id: REQ_23_PARENT
logic_type: all_of
qualifier: all
stage: evaluation
requirement_text: כל פעולה המתבצעת במערכת תירשם ביומן המערכת (LOG), כולל 7 פרטים מינימליים.

children:
  - REQ_23_1: log_includes_item_content
  - REQ_23_2: sender name/address
  - REQ_23_3: send date/time
  - REQ_23_4: open/read/fail/send indication
  - REQ_23_5: destination number/email
  - REQ_23_6: client ID in LOG
  - REQ_23_7: delivery failures
```

**תוצאה:** PASS

---

## TEST-06 — פריט אטומי מתוך רשימת Alerts

**קלט — מכרז 2/2025, עמ' 27, שורה 24:**

> 1) רישומי התרעה של מערכת ההפעלה.

**פלט צפוי:**
```yaml
requirement_target: business_fact
stage: evaluation
logic_type: simple
business_fact_key: supports_os_alert_logs
business_fact_type: boolean
code_comparable: false
```

**פלט שהתקבל:**
```yaml
requirement_id: REQ_24_1
requirement_text: יכולת דיווחים של רישומי התרעה של מערכת ההפעלה.
requirement_target: business_fact
stage: evaluation
logic_type: simple
parent_requirement_id: REQ_24_PARENT
business_fact_key: supports_os_alert_logs
business_fact_type: boolean
code_comparable: false
confidence: high
```

**תוצאה:** PASS

---

## TEST-07 — Qualifier: each

**קלט — מכרז 2/2025, עמ' 28, שורה 27:**

> הפצת הודעות SMS באורך מותאם לכל מפעיל סלולרי.

**פלט צפוי:**
```yaml
requirement_target: business_fact
stage: evaluation
logic_type: simple
qualifier: each
business_fact_key: supports_adaptive_sms_length_per_operator
business_fact_type: boolean
code_comparable: false
```

**פלט שהתקבל:**
```yaml
requirement_id: REQ_27
requirement_text: הפצת הודעות SMS באורך מותאם לכל מפעיל סלולרי.
requirement_target: business_fact
stage: evaluation
logic_type: simple
qualifier: each
business_fact_key: supports_adaptive_sms_length_per_operator
business_fact_type: boolean
code_comparable: false
confidence: high
```

**תוצאה:** PASS

---

## TEST-08 — Source Fidelity: SPEECH TO TEXT

**קלט — מכרז 2/2025, עמ' 28, שורה 30:**

> אפשרות המרת הודעת טקסט (SPEECH TO TEXT) להודעה קולית והפצתה ל"טלפונים כשרים" (טלפונים אשר בשימוש יהודים חרדים) ו/או ע"פ בחירת הלקוח ללא שיבוש מבנה ותוכן המסר, תוך שמירה על שפת המקור.

**פלט צפוי:**
```yaml
requirement_target: business_fact
stage: evaluation
logic_type: simple
business_fact_type: boolean
source_quote: contains "SPEECH TO TEXT"
requires_manual_review: true
code_comparable: false
```

**פלט שהתקבל:**
```yaml
requirement_id: REQ_30
requirement_target: business_fact
stage: evaluation
logic_type: simple
business_fact_key: supports_text_to_voice_conversion_kosher_phones
business_fact_type: boolean
exception_text: ו/או ע"פ בחירת הלקוח
source_quote: אפשרות המרת הודעת טקסט (SPEECH TO TEXT) ...
requires_manual_review: true
review_reason: source uses SPEECH TO TEXT although context describes text-to-voice; source wording preserved
code_comparable: false
confidence: high
```

**תוצאה:** PASS

---

## TEST-09 — Parent/Child + Exception ב-WhatsApp

**קלט — מכרז 2/2025, עמ' 28, שורה 31:**

> יכולת שליחת מסרונים מכל הסוגים (שירות, שיווק, תמיכה, אימות) בערוצי WHATSAPP וכן יכולת לנהל שיח מתמשך עם הנמען (ניתן לקיים יכולת זו באמצעות מוצר משלים של צד ג').

**פלט צפוי:**
```yaml
parent:
  logic_type: all_of
  stage: evaluation
children:
  - supports_whatsapp_messaging
  - supports_continuous_chat
second_child:
  exception_text: ניתן לקיים יכולת זו באמצעות מוצר משלים של צד ג'
```

**פלט שהתקבל:**
```yaml
requirement_id: REQ_31_PARENT
logic_type: all_of
stage: evaluation
code_comparable: false

REQ_31_1:
  requirement_text: יכולת שליחת מסרונים מכל הסוגים ... בערוצי WHATSAPP.
  logic_type: simple
  parent_requirement_id: REQ_31_PARENT

REQ_31_2:
  requirement_text: יכולת לנהל שיח מתמשך עם הנמען.
  logic_type: simple
  parent_requirement_id: REQ_31_PARENT
  business_fact_key: supports_continuous_chat
  exception_text: ניתן לקיים יכולת זו באמצעות מוצר משלים של צד ג'
```

**תוצאה:** PASS

---

## TEST-10 — פיצול ממשקי SMTP ו-API

**קלט — מכרז 2/2025, עמ' 28, שורה 35:**

> המערכת תאפשר לכל משתמש מורשה (בכפוף להרשאות) להפיץ הודעה (SMS, דיוור וכדומה) במספר ממשקים:  
> 1) ממשק SMTP.  
> 2) ממשק API תומך REST ותומך WS - שימוש ב API עבור ממשק למערכת באמצעות web service התומך בכל תקני ה-(rest+soap) (לפי תקן Web Services Security העולמי ובהתאם להנחיות המשרד).

**פלט צפוי:**
```yaml
parent:
  logic_type: all_of
  qualifier: all
  stage: evaluation
children:
  - supports_smtp_interface
  - supports_api_rest_ws_soap
```

**פלט שהתקבל:**
```yaml
requirement_id: REQ_35_PARENT
requirement_target: business_fact
stage: evaluation
logic_type: all_of
qualifier: all
code_comparable: false

REQ_35_1:
  requirement_text: הפצת הודעות באמצעות ממשק SMTP.
  logic_type: simple
  parent_requirement_id: REQ_35_PARENT
  business_fact_key: supports_smtp_interface
  business_fact_type: boolean

REQ_35_2:
  requirement_text: ממשק API תומך REST ותומך WS (rest+soap) לפי תקן Web Services Security העולמי.
  logic_type: simple
  parent_requirement_id: REQ_35_PARENT
```

**תוצאה:** PASS

---

# תוצאה כוללת — 10 מקרי Regression

- PASS: **10**
- PARTIAL: **0**
- WRONG: **0**
- MISSED: **0**

## אחוז הצלחה כולל

**10/10 PASS = 100%**

ה-100% מתייחס **רק ל-10 מקרי ה-Regression המתועדים לעיל ב-Extractor V3.5**. הוא אינו טענה ל-100% הצלחה בכל מכרז עתידי.

---

# חלק ב' — Validator

## Early Benchmark

- Full Match: **50.0%**
- Partial: **27.8%**
- Wrong: **11.1%**
- Missed: **11.1%**
- Raw Recall: **88.9%**

## Validator V3.2

- PASS: **73/74**
- Success rate: **98.65%**

## Extractor V3.5 Blind Validation — Temperature 0.0

- Source coverage: **100%**
- FAIL: **0**
- MISSING: **0**
- UNSUPPORTED: **0**

## Extractor V3.5 Blind Validation — Temperature 0.1

- Source coverage: **100%**
- FAIL: **0**
- MISSING: **0**
- UNSUPPORTED: **0**

Baseline שנבחר: `Temperature = 0.1`.

---

# חלק ג' — ריצות API שבוצעו בפועל

## API Run 001 — Mapper V1.0

- Source: Tender 2/2025, 135 pages
- Status: **FAIL**
- Input tokens: 73,065
- Output tokens: 6,266
- Thought tokens: 4,588
- Estimated cost: **$0.276378**

סיבה: Recall טוב, אך Granularity לא מספקת.

## API Run 002 — Mapper V1.1

- Status: **PARTIAL PASS**
- Input tokens: 73,321
- Output tokens: 9,879
- Thought tokens: 7,344
- Estimated cost: **$0.353318**
- Cumulative: **$0.629696**

תוצאות:
- 17/17 Reference regions עם overlap
- 17/17 full union page coverage
- 16/17 semantic match >= 50%
- Evidence: 35 high, 2 medium, 1 low

## API Run 003 — Mapper V1.2

- Source: Tender 2/2025, 135 pages
- Status: **PASS**
- Input tokens: 73,518
- Output tokens: 8,422
- Thought tokens: 10,274
- Estimated cost: **$0.371388**
- Cumulative: **$1.001084**

תוצאות:
- Reference coverage: **17/17 = 100%**
- Critical known false negatives: **0**
- Evidence: **20/20 = 100% high-confidence**

## API Run 004 — Mapper V1.2 Blind Generalization

- Source: MFA Tender 20/2026, catering, 171 pages
- Status: **PASS**
- Input tokens: 92,670
- Output tokens: 10,952
- Thought tokens: 7,482
- Estimated cost: **$0.406548**
- Cumulative estimated cost: **$1.407632**

תוצאות:
- Independent checkpoints: **13/13 = 100%**
- Missing checkpoints: **0**
- Critical known false negatives: **0**
- Regions returned: **22**
- Evidence high-confidence: **39/41 = 95.1%**

**Requirement Mapper V1.2 — MVP VALIDATED**

---

# חלק ד' — F15 ו-F18

## F15 — Metadata

**Version under test:** `metadata-f15` / `f15-v1.0`

### F15-01 — מכרז 20/2026

- Input: מסמך הקורפוס של משרד החוץ, 171 עמודים.
- Expected: שם ומספר מכרז, משרד החוץ כגוף מפרסם, מועד הגשה עם עמוד/סעיף/ציטוט, וכל ערבות שאותרה עם מקור. אין ניחוש לשדה חסר.
- Actual: טרם נרשם; יתועד בהרצת הקבלה של M2.
- Result: PENDING.

### F15-02 — מכרז 2/2025

- Input: מסמך הקורפוס של מערך הדיגיטל, 135 עמודים.
- Expected: שם ומספר מכרז, גוף מפרסם, מועד הגשה עם עמוד/סעיף/ציטוט, וכל ערבות שאותרה עם מקור. אין ניחוש לשדה חסר.
- Actual: טרם נרשם; יתועד בהרצת הקבלה של M2.
- Result: PENDING.

### F15-03 — מועד לא חד-משמעי

- Input: PDF תקין שבו אין מועד הגשה חד-משמעי או שחסרה שנת המועד.
- Expected: `submission_deadline.iso = null`; אין השלמת שנה או שעה; נוסף הסבר ל-`notes`.
- Actual: Schema ו-System Prompt אוכפים null במקום ניחוש; בדיקת מודל חיה טרם בוצעה.
- Result: PARTIAL — contract test passes, live model case pending.

## F18 — Fit Analysis

**Status: NOT YET EXECUTED AS A FORMAL TEST CASE**

אין עדיין Test Case פורמלי מלא עם Input → Expected → Actual → Result.

---

# חלק ה' — Baselines

## Requirement Mapper V1.2

- Model: `gemini-3.1-pro-preview`
- Thinking: `High`
- Temperature: `1.0`
- Structured Output: `ON`
- External Tools: `OFF`
- Status: **MVP VALIDATED**

## Requirement Extractor V3.5

- Model: `gemini-3.1-pro-preview`
- Thinking: `High`
- Temperature: `0.1`
- Structured Output: `ON`
- External Tools: `OFF`
- Status: **MVP VALIDATED**

## Regression Rule

כל שינוי ב-Prompt / Schema / Model / Temperature מחייב:

1. Version bump.
2. הרצה מחדש של TEST-01 עד TEST-10 עם הקלטים המדויקים המופיעים בקובץ זה.
3. השוואה לפלט הצפוי.
4. בדיקת PASS / PARTIAL / WRONG / MISSED.
5. אישור Baseline חדש רק אם אין Regression קריטי.

---

# חלק ו' — Extractor V3.5 Reconstructed Baseline Regression — 2026-10-08

### Why this regression was required

The original raw AI Studio source files for Extractor V3.5 were not available as standalone version-controlled files. The complete V3.5 content remained documented in the technical specification, but the Markdown representation contained serialization escapes and documentation prose around the runtime prompt/schema.

A mechanical reconstruction was created and verified before promotion.

### Mechanical provenance verification

Status: **PASS**

- System Instructions clean reconstruction exactly matches the saved clean runtime file.
- User Prompt clean reconstruction exactly matches the saved clean runtime file.
- Structured Output Schema was stripped of documentation prose, parsed as JSON, and exactly matches the saved clean runtime file after canonical JSON serialization.
- Full unified raw-to-clean diffs are stored under ai/extractor-v3.5/provenance/.
- No intended semantic rule, field, enum, required field, model, thinking level or temperature was changed.

### Final semantic regression gate

Status: **PASS**

Accepted validation attempt: **2**

Requirement count in accepted run: **84**

Gate requirements included schema integrity, unique IDs, valid parent references, complete source-row coverage 1-36 on pages 25-28, source quotes, 40MB semantics, SPEECH TO TEXT source fidelity/manual review, required parent-child decomposition on benchmark compound rows, and technical manual-review safety.

### Reproducibility finding

Repeated runs showed that Gemini can vary generated business_fact_key spelling/prefixes, atomic decomposition granularity, and manual-review flags. Therefore exact generated key spelling or exact atomic count is not a regression oracle by itself.

Production requirement: preserve raw output, validate semantic safety server-side, normalize aliases to canonical Business Fact keys, and reject/retry any extraction that fails the semantic gate.

### Frozen baseline

Runtime source of truth: ai/extractor-v3.5/

Provenance: reconstructed from documented V3.5, mechanically cleaned, diff-verified, regression-validated. It is **not claimed to be byte-for-byte identical to the unavailable original AI Studio raw files**.

Runtime hashes are recorded in ai/extractor-v3.5/BASELINE_MANIFEST.json.

Decision:

**Requirement Extractor V3.5 — FROZEN RUNTIME BASELINE (reconstructed + regression validated)**
