# ARCHITECTURE — TenderFit

**גרסה:** v1.3 · 9.10.2026 · Background ב-Gemini, Pro לכל הקריאות, מפתחות Supabase חדשים, Spend Cap
**נגזר מ:** `PRD.md` (v1.3), `tech-stack.md` (v2.1), `product-10-definitions.md` (v3.5), `MVP.md` (v1.2), `course-stack.md`, המפרט הטכני V3.5, `TenderFit_Business_Facts_Registry`
**כלל:** כל החלטה טכנית כאן כפופה ל-`course-stack.md` ול-`tech-stack.md`.

> **AI extracts and normalizes; Code compares; Human decides.**

---

## 1. תמונה כללית

```text
┌──────────────────────── דפדפן (GitHub Pages) ────────────────────────┐
│  HTML / CSS / Vanilla JS (ES Modules)  +  supabase-js (CDN)          │
│  • כניסה, פרופיל, העלאה, ניתוח והתאמה, Checklist, רשימת מכרזים     │
│  • מנהל את רצף העיבוד: שולח בקשה לכל step ומציג סטטוס              │
└───────┬───────────────────────────────┬──────────────────────────────┘
        │ JWT + publishable key (RLS)   │ POST /api/tenderfit?step=…
        │ Auth / DB / Storage           │ Authorization: Bearer <JWT>
        ▼                               ▼
┌──────────────── Supabase ─────────┐  ┌──────── Vercel: api/tenderfit.js ────────┐
│ Auth: משתמש אחד ידני               │◄─┤ supabase-js בשם המשתמש (RLS)             │
│ Postgres: tenders,                 │  │ Ajv + Comparison Engine + Merge/Dedup    │
│   business_profile,                │  │ @google/genai ──────────────┐            │
│   ai_error_reports                 │  └─────────────────────────────┼────────────┘
│ Storage: bucket פרטי tender-pdfs   │                                ▼
└───────────▲────────────────────────┘          ┌──────── Gemini API ────────┐
            │ secret key (n8n בלבד), קריאה       │ Files API (עותק זמני 48ש')  │
┌───────────┴──────────────┐                     │ Interactions API            │
│ n8n (Docker, שרת Oracle) │── Gmail ──► כתובת   │ gemini-3.1-pro-preview      │
│ תזכורת יומית (F32)       │            בדיקה    └─────────────────────────────┘
└──────────────────────────┘
```

**שלוש כתובות, שלוש שכבות:** צד לקוח ב-GitHub Pages, צד שרת ב-Vercel, נתונים ב-Supabase. ‏n8n רץ בנפרד.

**עקרונות:**
- הדפדפן לא פונה ל-Gemini לעולם.
- הפונקציה לא מקבלת קובץ, רק מזהים.
- כל גישה לנתונים עוברת RLS, גם מהשרת.
- חישוב, השוואה, תאריכים ו-Merge נעשים בקוד. המודל רק מחלץ, מסווג ומנסח.
- Supabase Storage הוא מקור האמת לקובץ. Gemini Files API הוא עותק זמני.

---

## 2. מבנה הריפו

```text
/
├── index.html              כניסה
├── tenders.html            רשימת מכרזים (Should)
├── upload.html             מכרז חדש + סטטוס עיבוד
├── tender.html             ניתוח והתאמה (?id=)
├── checklist.html          Checklist (?id=)
├── profile.html            פרופיל העסק
├── css/
│   └── styles.css
├── js/
│   ├── config.js           כתובת Supabase, publishable key, כתובת הפונקציה
│   ├── supabase.js         יצירת הלקוח מ-CDN
│   ├── auth.js             כניסה, יציאה, הגנה על דפים
│   ├── pipeline.js         ניהול רצף ה-steps מהדפדפן
│   ├── urgency.js          חישוב דחיפות (3.4 ב-PRD)
│   └── ui/                 רכיבי תצוגה לכל מסך
├── api/
│   └── tenderfit.js        הפונקציה היחידה
├── lib/                    קוד שרת משותף (לא נפרס כפונקציה)
│   ├── gemini.js           עטיפה ל-@google/genai
│   ├── steps/              upload, map, metadata, extract, validate, compare
│   ├── comparison.js       Comparison Engine (פונקציות טהורות)
│   ├── aggregate.js        צבירת Parent / Child
│   ├── dedup.js            Merge/Dedup שמרני
│   ├── facts.js            Normalization ו-Alias lookup של Business Facts
│   ├── checklist.js        יצירת Checklist מדרישות
│   ├── budget.js           תקרות עלות
│   └── validate.js         Ajv + בדיקות סעיף 11 במפרט
├── ai/
│   ├── mapper-v1.2/        system_instructions.txt, user_prompt.txt, structured_output_schema.json,
│   │                       settings.json, BASELINE_MANIFEST.json, README.md          ✅ קפוא (M0)
│   ├── extractor-v3.5/     אותם קבצים + provenance/ + validation/                     ✅ קפוא (M0, V3.5-clean)
│   ├── extractor-v3.6/     prompt.template.txt, region-context.json   (System + Schema מ-v3.5)   M2
│   ├── metadata-f15/       system_instructions.txt, user_prompt.txt, structured_output_schema.json, settings.json   M2
│   └── fit-f18/            system_instructions.txt, user_prompt.txt, structured_output_schema.json, settings.json   M4
├── reference/
│   └── run_mapper.py       מימוש ייחוס בפייתון (לא נפרס)
├── data/
│   ├── business-facts-registry.json   Seed (= TenderFit_Business_Facts_Registry.json)
│   ├── categories.json
│   ├── units.json                     יחידות והמרות מותרות
│   └── pricing.json                   מחירי Gemini לחישוב עלות
├── tests/                  node:test — בלי תלות נוספת
├── ai-tests.md
├── package.json            "type": "module", engines.node: "24.x"
├── package-lock.json
└── vercel.json             maxDuration: 300
```

- **GitHub Pages** מגיש את הקבצים הסטטיים מהשורש. **Vercel** פורס את `api/tenderfit.js` ואת מה שהוא מייבא מ-`lib/`, ‏`ai/` ו-`data/`.
- הקבצים ב-`ai/` הם ה-Freeze של ה-Baselines. אסור לערוך אותם בלי גרסה חדשה. בכל טעינה, הקוד בודק את ה-SHA-256 של קבצי הריצה מול `BASELINE_MANIFEST.json`, ונכשל אם יש אי-התאמה.
- **Extractor V3.5** שבריפו הוא **V3.5-clean**: שוחזר מהמפרט, נוקה מכנית (diff מלא ב-`provenance/`), ועבר Regression ב-8.10.2026 (`validation/`). הוא אינו זהה בייט-לבייט לקבצי AI Studio המקוריים, שאינם זמינים.
- ‏`ai/` ו-`data/` ציבוריים, כי הריפו ציבורי. אין בהם סודות.

---

## 3. מודל הנתונים

### 3.1 `tenders`

| עמודה | טיפוס | תוכן |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, ‏`default auth.uid()` | בעל הרשומה |
| `title` | text | שם המכרז (מ-F15) |
| `tender_number` | text, null | |
| `publisher` | text, null | הגוף המפרסם |
| `submission_deadline` | timestamptz, null | מועד ההגשה. `null` → "מועד הגשה לא ידוע" |
| `pdf_path` | text | נתיב ב-Storage |
| `pdf_hash` | text | SHA-256 של הקובץ |
| `gemini_file` | jsonb | `{ uri, name, mime_type, state, uploaded_at, expires_at }` |
| `processing` | jsonb | סטטוס לכל step ולכל אזור, ראו 4.2 |
| `regions` | jsonb | פלט ה-Mapper |
| `metadata` | jsonb | פלט F15: סיכום, מועדים, ערבויות, עם מקור |
| `region_outputs` | jsonb | פלט גולמי של ה-Extractor לכל אזור, לפני Merge |
| `requirements` | jsonb | הדרישות אחרי `validate`, במבנה סעיף 11 |
| `dedup_log` | jsonb | מזהים מקוריים ופעולות איחוד |
| `results` | jsonb | תוצאה לכל דרישה + מונים |
| `fit_analysis` | jsonb, null | פלט F18 |
| `checklist` | jsonb, null | פריטים, ראו 7 |
| `ai_usage` | jsonb | יומן קריאות למודל, ראו 9 |
| `decision` | text, null | `go` / `no_go` |
| `decision_updated_at` | timestamptz, null | |
| `analysis_updated_at` | timestamptz, null | |
| `created_at`, `updated_at` | timestamptz | |

### 3.2 `business_profile`

| עמודה | טיפוס | תוכן |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, unique, ‏`default auth.uid()` | שורה אחת למשתמש |
| `legal_name`, `company_number`, `contact_name`, `phone`, `email` | text | פרטי בסיס (F05) |
| `business_facts` | jsonb | מפתח: `business_fact_key`. ערך: רשומה לפי ה-Registry |
| `updated_at` | timestamptz | |

רשומת Business Fact:

```json
{
  "business_fact_type": "number|currency|boolean|date|enum|string",
  "unit": "string|null",
  "value": "typed value|null",
  "status": "known|missing|needs_review",
  "aliases": [],
  "source": "user",
  "updated_at": "timestamp|null"
}
```

### 3.3 `ai_error_reports`

| עמודה | טיפוס | תוכן |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, ‏`default auth.uid()` | |
| `tender_id` | uuid FK → `tenders.id` | |
| `requirement_id` | text | |
| `ai_result` | jsonb | צילום של הדרישה והתוצאה בזמן הדיווח |
| `user_explanation` | text | |
| `status` | text, ‏`default 'new'` | `new` / `in_review` / `resolved` / `rejected` |
| `created_at` | timestamptz | |

### 3.4 RLS ו-Storage

- **בכל שלוש הטבלאות:** ‏`select`, ‏`insert` ו-`update` מותרים רק כש-`user_id = auth.uid()`. אין `delete` ב-MVP.
- **Bucket:** ‏`tender-pdfs`, פרטי. נתיב הקובץ הוא `{user_id}/{tender_id}.pdf`. מדיניות: המשתמש קורא וכותב רק תחת התיקייה ששמה `auth.uid()`.
- **n8n:** קורא מ-`tenders` עם Secret key (`sb_secret_...`) ששמור רק ב-Credentials של n8n. המפתח עוקף RLS, ולכן ה-Workflow מבצע קריאה בלבד.
- **נתוני דוגמה:** עסק בדיוני, ולפחות 5 שורות ב-`tenders`, כדי שכל המסכים יוצגו מלאים.

---

## 4. צנרת העיבוד

### 4.1 הרצף

```text
upload ──► map ──────┐
      └──► metadata ─┤ (במקביל)
                     ▼
            extract × N אזורים (במקביל, עד K בו-זמנית)
                     ▼
                  validate
                     ▼
                  compare (+F18)
```

ה-Frontend (`js/pipeline.js`) מנהל את הרצף. אחרי כל תשובה הוא קורא את `processing` מ-`tenders` ומחליט מה הצעד הבא. אין Realtime. אם המשתמש חוזר לדף, הרצף ממשיך מהמקום שבו נעצר, דרך הכפתור "המשך עיבוד".

**Background:** כל קריאה למודל רצה ב-Gemini ברקע (4.5). השלב נשלח בבקשה אחת, שמחזירה מיד `waiting`. הדפדפן שולח שוב את אותו `step` כל כמה שניות (הנחה: 10 שניות), והשרת בודק אצל Gemini אם התשובה מוכנה. כך אף בקשה לא מתקרבת למגבלת 300 השניות של Vercel.

**מקביליות של `extract`:** כדי לעמוד ביעד של 10 דקות למכרז של כ-150 עמודים, אזורים רצים במקביל, עד K בקשות בו-זמנית (הנחה: K=5, ניתן להגדרה). K ייקבע סופית לפי זמני הריצה ומגבלות הקצב של Gemini שיימדדו ב-M2.

### 4.2 מבנה `processing` ונעילה

```json
{
  "steps": {
    "upload":   { "status": "done",    "started_at": "…", "finished_at": "…", "attempts": 1, "error": null },
    "map":      { "status": "done",    … },
    "metadata": { "status": "failed",  …, "error": "metadata_timeout" },
    "validate": { "status": "pending", … },
    "compare":  { "status": "pending", … }
  },
  "regions": {
    "A01": { "status": "done",    "attempts": 1 },
    "A02": { "status": "running", "started_at": "…", "attempts": 1 },
    "A03": { "status": "waiting", "interaction_id": "…", "sent_at": "…", "attempts": 1 }
  }
}
```

- **מצבים:** `pending` → `running` (השרת עובד, שניות) → `waiting` (Gemini עובד ברקע, ‏`interaction_id` נשמר) → `done` | `failed`. שלב בלי קריאה למודל (`upload`, ‏`validate`) עובר מ-`running` ישר ל-`done`.
- **`waiting`:** בקשה לשלב או לאזור במצב `waiting` לא נדחית. היא בודקת אצל Gemini. גם המעבר מ-`waiting` ל-`done` נעשה בעדכון מותנה אחד, כדי ששתי בדיקות במקביל לא ישמרו פעמיים.
- **נעילה (Idempotency):** לפני תחילת עבודה, השרת מבצע **עדכון מותנה אחד**: מעבר ל-`running` רק אם הסטטוס הנוכחי `pending` או `failed`, או `running` "תקוע" שהתחיל לפני יותר מ-330 שניות. אחר כך בודקים שהשורה באמת עודכנה. אם לא, הבקשה נדחית עם `409`.
- **שלב שהושלם (`done`) לא רץ שוב.** החריג: `compare`, שרץ שוב בכל "בדוק שוב".
- **Retry:** ניסיון חוזר אחד אוטומטי, רק על שגיאת API, ‏Timeout או פלט לא שלם. אחר כך המשתמש מקבל "נסה שוב" לאותו שלב או אזור.
- **עדכוני JSON** נעשים כך ששני אזורים שמסתיימים יחד לא דורסים זה את זה: כל אזור כותב רק לנתיב שלו בתוך ה-jsonb.

### 4.3 השלבים

כל בקשה מתחילה כך: ‏CORS, אימות JWT, טעינת המכרז בשם המשתמש (RLS), ובדיקת תקציב (9) לפני כל קריאה למודל.

| `step` | קלט | מה קורה | כותב ל- |
|---|---|---|---|
| `upload` | `tender_id` | אם `gemini_file` קיים, עם אותו `pdf_hash`, ‏`state=ACTIVE` ולא פג תוקף, הקובץ נשאר. אחרת: הורדה מ-Storage לזיכרון, `files.upload()` כ-Blob, והמתנה ל-`ACTIVE` | `gemini_file`, ‏`processing.steps.upload` |
| `map` | `tender_id` | Mapper V1.2 על המכרז המלא. Ajv מול ה-Schema של ה-Mapper. יצירת רשומת סטטוס לכל אזור | `regions`, ‏`processing.regions`, ‏`ai_usage` |
| `metadata` | `tender_id` | F15. Ajv. שדה שלא אותר נשמר כ-`null` | `metadata`, ‏`title`, ‏`publisher`, ‏`submission_deadline`, ‏`ai_usage` |
| `extract` | `tender_id`, ‏`region_id` | בניית ה-Prompt מתבנית V3.6 (4.4), קריאה למודל, ‏Ajv על פלט האזור | `region_outputs[region_id]`, ‏`processing.regions`, ‏`ai_usage` |
| `validate` | `tender_id` | רץ רק כשכל האזורים `done`. בדיקות סעיף 11 במפרט, מזהים עם קידומת אזור, Merge/Dedup (5) | `requirements`, ‏`dedup_log` |
| `compare` | `tender_id` | זיהוי Facts (6.1), Comparison Engine וצבירה (6), מונים, ואז F18. אם F18 נכשל, תוצאות הקוד נשמרות ו-F18 מסומן כנכשל | `results`, ‏`fit_analysis`, ‏`analysis_updated_at`, ‏`business_profile.business_facts` (Facts חדשים במצב `missing`) |

**שלבים עם מודל** (`map`, ‏`metadata`, ‏`extract`, ו-F18 בתוך `compare`) עובדים בשני מצבים: אם עוד אין `interaction_id`, השרת שולח את הקריאה ומחזיר `waiting`. אם יש, השרת בודק אותה (4.5), ורק כשהיא `completed` מריץ Ajv, שומר ומסמן `done`. ב-`compare`, תוצאות הקוד נשמרות כבר בבקשה הראשונה, ו-F18 ממשיך ברקע.

**מתי מכרז "מוכן":** כש-`compare` הסתיים. אם `metadata` נכשל, המסך מוצג אבל עם הודעה ברורה: "חילוץ פרטי המכרז נכשל", ו"נסה שוב" ל-`metadata` בלבד.

### 4.4 Extractor V3.6 — בניית ה-Prompt

```text
prompt = fill(extractor-v3.6/prompt.template.txt, {
  REGION_NAME:    region.title,
  PAGES:          `${region.start_page}–${region.end_page}`,
  REGION_CONTEXT: regionContext[region.region_type]
})
```

- **שדות האזור** לפי Schema של Mapper V1.2: `region_id`, ‏`title`, ‏`region_type`, ‏`start_page`, ‏`end_page`, ‏`start_anchor`, ‏`end_anchor`, ‏`content_summary`, ‏`boundary_confidence`, ‏`content_confidence`, ‏`needs_manual_review`, ‏`review_reason` ועוד.
- `region-context.json` היא טבלת ניסוחים קבועה, עם **ניסוח אחד לכל אחד מ-16 ערכי `region_type`**: ‏deadlines, ‏eligibility, ‏submission, ‏guarantee, ‏evaluation, ‏technical_mandatory, ‏quality, ‏implementation, ‏sla, ‏cybersecurity, ‏insurance, ‏financial, ‏contract, ‏forms, ‏post_award, ‏other. ‏`content_summary` לא נכנס להוראות.
- **אזור בלי עמודים** (`start_page` או `end_page` הם `null`): לא נשלח ל-Extractor. הוא מסומן במסך "אזור ללא גבולות עמודים: דורש בדיקה ידנית", עם `start_anchor` ו-`end_anchor` כמידע. שאר העיבוד ממשיך. (הנחה, לאישור ב-M2.)
- **אזור עם `needs_manual_review=true`** או `boundary_confidence=low`: נשלח ל-Extractor כרגיל, וכל הדרישות שלו מסומנות לבדיקה עם `review_reason` מה-Mapper.
- **בדיקת תאימות (בקוד):** עם הפרמטרים של אזור ה-Benchmark ("נספח 1, סעיף 1 — דרישות חובה", ‏25–28, וה-REGION CONTEXT המקורי), הפלט של `fill` זהה תו-בתו ל-`extractor-v3.5/user_prompt.txt` (SHA-256 ב-`BASELINE_MANIFEST.json`).
- System Instructions, ‏Schema והגדרות נטענים מ-`extractor-v3.5/`.

### 4.5 קריאה למודל

```text
client.interactions.create({
  model, system_instruction, input: [ {type:"document", uri, mime_type}, {type:"text", text} ],
  generation_config: { thinking_level, temperature },
  response_format: [ { type:"text", mime_type:"application/json", schema } ],
  store: true,
  background: true
})
→ שומרים interaction.id ב-processing

client.interactions.get(id)   ← בכל בדיקה חוזרת
```

- **מודל:** `gemini-3.1-pro-preview` לכל ארבעת הרכיבים: Mapper, ‏Extractor, ‏F15 ו-F18.
- **`store: true`** נדרש ל-Background. Google שומרת את הקריאה 7 ימים (הגדרה ב-AI Studio). זה לא משנה את פלט המודל, ולכן לא נחשב גרסה חדשה של ה-Baseline.
- **זמן המתנה מרבי:** קריאה שלא הגיעה ל-`completed` אחרי 15 דקות (הנחה, תימדד ב-M2) מסומנת `failed`.
- אין `tools` ואין `previous_interaction_id`.
- אם `status` אינו `completed`, זה כשל ולא תוצאה חלקית.
- **סדר ה-input:** המסמך קודם ואחריו הטקסט, וה-`response_format` נשלח כרשימה. כך בדיוק רצו `run_mapper.py` וה-Regression של V3.5-clean (`validation/run_regression.py`). אין לשנות את הסדר.
- `JSON.parse`, ואחריו Ajv. אסור "לתקן" JSON ידנית.
- **Ajv ו-`nullable`:** ה-Schema של ה-Extractor כתוב בסגנון של Gemini/OpenAPI (`"nullable": true`, כולל שדות `enum` שמותר להם `null`). הקובץ שנשלח ל-Gemini **לא משתנה**. לבדיקה בשרת, `lib/validate.js` בונה בזיכרון עותק לבדיקה בלבד: כל שדה `nullable` הופך ל-`type: [T, "null"]`, ול-`enum` שלו מתווסף `null`. בדיקת יחידה מוודאת שהפלט המאושר ב-`validation/accepted_response.json` עובר את הבדיקה.
- **נרמול `business_fact_key`:** ה-Regression הראה שהמודל משנה איות וקידומות של המפתח בין ריצות. לכן הנרמול וה-aliases (6.1) הם חובה, ואסור להשוות מפתח גולמי.
- לכל תוצאה מצורפים: גרסת רכיב, מודל בפועל, `pdf_hash`.

---

## 5. Merge/Dedup (בתוך `validate`)

1. **מזהים:** כל `requirement_id` מקבל קידומת אזור (`A03-R-012`). גם `parent_requirement_id` ו-`condition_group_id` מעודכנים בהתאם.
2. **נרמול:** רק רווחים, ירידות שורה ורווחים בקצוות. מספרים, יחידות, סימני השוואה וניסוח לא משתנים.
3. **איחוד אוטומטי:** רק בהתאמה מלאה של `source_page`, של `source_quote` המנורמל, ושל `business_fact_key`, ‏`value` ו-`comparison_operator`. ‏`value` מושווה לפי הטיפוס שלו. נשארת רשומה אחת, וההפניות לרשומה שהוסרה מופנות לרשומה שנשארה.
4. **חשד לכפילות:** לפי כללים קבועים בלבד, למשל אותו `source_page` ואותו `business_fact_key`, אבל ציטוט שונה. שתי הרשומות נשמרות, ומסומנות `requires_manual_review=true` עם `review_reason: "חשד לכפילות"`. דמיון טקסטואלי כללי לא מספיק.
5. **Traceability:** כל איחוד נרשם ב-`dedup_log`: המזהים המקוריים, הרשומה שנשארה והכלל שהופעל.
6. **בדיקות:** אזורים חופפים, דרישות זהות, דרישות דומות אבל שונות (למשל מחזור בשנה אחת לעומת מחזור בכל אחת משלוש שנים), ויחסי Parent/Child. **לא מאומת** עד שהבדיקות יעברו.

---

## 6. Comparison Engine (בתוך `compare`)

קוד טהור ב-`lib/comparison.js` וב-`lib/aggregate.js`. בלי I/O, ונבדק ביחידות.

### 6.1 זיהוי Business Facts

1. לכל דרישה עם `requirement_target = business_fact`: נרמול `business_fact_key` וחיפוש ב-aliases של הפרופיל ושל ה-Registry.
2. אם יש Fact קנוני, משתמשים בו. אם אין, נוצר Fact חדש בפרופיל עם `status=missing`.
3. ‏`business_fact_type` מוגבל לששת הטיפוסים. טיפוס אחר → "דורש בדיקה – סוג המידע אינו נתמך אוטומטית ב-MVP".

### 6.2 תוצאה לדרישה אטומית

| תנאי | תוצאה |
|---|---|
| `code_comparable = false` או `requires_manual_review = true` | דורש בדיקה |
| ה-Fact חסר (`status=missing` או `value=null`) | חסר מידע |
| ה-Fact במצב `needs_review` | דורש בדיקה |
| יחידה שונה בלי המרה מוגדרת ב-`units.json` | דורש בדיקה |
| `period` או `scope` שה-Fact לא מייצג במפורש | דורש בדיקה |
| תאריך תוקף, כשמועד ההגשה לא ידוע | דורש בדיקה. בדיקת תוקף נעשית מול מועד ההגשה, לא מול היום |
| ההשוואה מתקיימת | עומד |
| ההשוואה לא מתקיימת | פער |

- **אופרטורים:** `>` `>=` `=` `<=` `<` `between` `required` `in` `not_in`.
- **טיפוסים:** ‏number, ‏currency, ‏boolean (רק כשהסמנטיקה חד-משמעית), ‏date, ‏enum, ‏string (שוויון מדויק בלבד).
- **כלל ברירת מחדל:** בכל ספק, התוצאה היא "דורש בדיקה" ולא "עומד".

### 6.3 צבירת Parent / Child

| `logic_type` | סדר קדימויות |
|---|---|
| `all_of` | פער > דורש בדיקה > חסר מידע > עומד |
| `any_of` | עומד > דורש בדיקה > חסר מידע > פער. "פער" רק אם כל החלופות נכשלו |
| `conditional` | תמיד דורש בדיקה |

Parent לא מבצע השוואה עצמאית ולא נספר במונים. התוצאה שלו נגזרת רק מה-Children.

### 6.4 מונים

המונים של ארבעת המצבים סופרים רק דרישות אטומיות (לא Parent) עם `requirement_target = business_fact`. בנוסף מוצג מונה של "תנאי סף קריטיים שדורשים תשומת לב": דרישות עם `is_critical=true` ו-`stage=eligibility` שאינן במצב "עומד".

**אחוז עמידה (בקוד):** `round(100 × עומד ÷ (עומד + פער + דורש בדיקה + חסר מידע))`. "חסר מידע" ו"דורש בדיקה" לא נספרים כעמידה. כשאין דרישות, מוצג "—". זה אינו ציון התאמה ואינו נוצר על ידי AI.

**סיכום מצב (בקוד):** משפט שנבנה מתבנית קבועה מתוך המונים, למשל: "{פערים קריטיים} פערים בתנאי סף קריטיים, {חסר} נתונים חסרים בפרופיל, ו-{בדיקה} דרישות שדורשות בדיקה שלך." חלקים עם 0 מושמטים. מתחתיו: "מחושב בקוד מתוך התוצאות. אינו המלצה." נשמר ב-`results.summary` ומחושב מחדש בכל `compare`.

### 6.5 ביצועים

Comparison וצבירה מסתיימים תוך פחות מ-2 שניות. הזמן הזה לא כולל את F18, שהוא קריאת מודל שרצה אחריהם.

---

## 7. Checklist

נוצר **בקוד** (`lib/checklist.js`) ברגע שנבחר Go, בלי קריאת AI:

1. **מקור:** כל דרישה אטומית עם `requirement_target = submission_obligation`, או ש-`evidence_required` שלה אינו `null`.
2. **שם הפריט:** `evidence_required`. אם הוא ריק, `requirement_text`.
3. **איחוד:** פריטים עם אותו `evidence_required` בדיוק מאוחדים, עם רשימת `requirement_ids` שהם מכסים.
4. **פריט:**
   ```json
   { "item_id": "C-001", "name": "…", "requirement_ids": ["A02-R-004"],
     "source": { "page": 17, "section": "4.2.1" },
     "done": false, "status": "open", "due_date": null, "note": null }
   ```
   ‏`due_date` ו-`note` הם Could.
5. **אחוז התקדמות:** מספר הפריטים שהושלמו חלקי מספר הפריטים, מחושב בדפדפן.
6. **שינוי החלטה:** אם ההחלטה משתנה ל-No-Go, ה-Checklist נשמר ולא מוצג. אם ההחלטה חוזרת ל-Go, ה-Checklist הקיים מוצג שוב ולא נוצר מחדש.

הכתיבה נעשית ישירות מהדפדפן ל-`tenders.checklist`, תחת RLS. אין צורך בפונקציה.

---

## 8. פעולות ישירות מהדפדפן (בלי הפונקציה)

| פעולה | איך |
|---|---|
| כניסה ויציאה | `supabase.auth` |
| העלאת PDF | בדיקת סוג וגודל (PDF, עד 50MB), חישוב SHA-256 ב-Web Crypto, העלאה ל-`tender-pdfs`, יצירת שורה ב-`tenders` |
| פרופיל ו-Business Facts | קריאה וכתיבה ל-`business_profile` |
| "השלם נתון" | כתיבת `value` ו-`status=known` ל-Fact, ואז "בדוק שוב" (`step=compare`) |
| Go / No-Go | עדכון `decision` ו-`decision_updated_at`. ב-Go הראשון נוצר Checklist (7) |
| Checklist | עדכון פריטים |
| דיווח על טעות AI | `insert` ל-`ai_error_reports` |
| דחיפות | חישוב ב-`js/urgency.js` בזמן טעינת המסך |

---

## 9. ניהול עלויות

- **`ai_usage`:** כל קריאה למודל מוסיפה רשומה: `step`, ‏`region_id`, רכיב וגרסה, מודל, `input_tokens`, ‏`output_tokens`, ‏`thought_tokens`, משך הריצה, עלות משוערת לפי `data/pricing.json`, וסטטוס.
- **לפני כל קריאה למודל** (`lib/budget.js`):
  - סכום העלות המשוערת של החודש בכל `tenders` (בשם המשתמש) מול `MONTHLY_AI_BUDGET_USD`.
  - סכום העלות של המכרז מול `TENDER_AI_BUDGET_USD`.
  - חריגה → `402` ב-JSON, עם הודעה ברורה, ובלי קריאה למודל.
- "בדוק שוב" מריץ רק `compare`: קוד ו-F18.
- **Spend Cap** של $30 בחודש בפרויקט של המפתח ב-AI Studio. הוא חוסם קריאות בעיכוב של כ-10 דקות, ולכן התקרות בקוד נשארות הקו הראשון.

---

## 10. אבטחה

| נושא | מימוש |
|---|---|
| מפתח Gemini | רק ב-ENV של Vercel |
| Supabase Secret key | רק ב-Credentials של n8n. לא ב-Vercel ולא בריפו |
| דפדפן | Publishable key בלבד, מוגן ב-RLS |
| הפונקציה | JWT חובה. פונה ל-Supabase בשם המשתמש |
| CORS | `ALLOWED_ORIGIN` בלבד, ותשובה ל-`OPTIONS` |
| קלט | מזהים בלבד. `tender_id` ו-`region_id` נבדקים מול הרשומה |
| פלט שגיאה | JSON עם קוד והודעה ידידותית. בלי מפתח ובלי הודעה גולמית של ספק |
| Gemini | `store: true` ל-Background, ושמירה של 7 ימים אצל Google. נשלחים רק מכרזים פומביים ופרופיל בדיוני |
| הגנה על דפים | בהרשאות הטבלה, לא בהסתרת הדף |

---

## 11. טיפול בשגיאות

| מצב | קוד | התנהגות |
|---|---|---|
| אין JWT או JWT לא תקף | 401 | הפניה למסך הכניסה |
| המכרז לא נמצא או לא שייך למשתמש | 404 | הודעה |
| השלב כבר רץ | 409 | הדפדפן ממתין ובודק שוב |
| חריגה מתקציב | 402 | "הגעת לתקרת העלות" |
| PDF לא נקרא באופן אמין | 422 | "המסמך אינו נקרא באופן אמין. PDF סרוק אינו נתמך ב-MVP" |
| כשל Gemini, ‏Timeout או פלט לא שלם | 502 | Retry אוטומטי אחד, ואז "נסה שוב" |
| פלט לא עובר Ajv | 502 | Retry אחד, ואז האזור מסומן כשגיאה |
| 0 דרישות אחרי `validate` | 200 | "לא אותרו דרישות. בדוק את המסמך" |
| קובץ Gemini פג תוקף | — | הדפדפן מריץ `upload` שוב |
| Gemini עדיין עובד | 200 | `status: waiting`. הדפדפן בודק שוב בעוד כמה שניות |
| Gemini לא סיים אחרי 15 דקות | 502 | השלב או האזור מסומן `failed`, ומוצג "נסה שוב" |

לכל תשובה יש מבנה אחיד: `{ ok, step, status, data | error: { code, message } }`.

---

## 12. אוטומציה: n8n

```text
Schedule (פעם ביום) → Supabase (Secret key, קריאה בלבד):
  tenders where decision='go'
    and submission_deadline between now() and now()+7 days
→ אם יש תוצאות: Gmail → כתובת בדיקה (מייל מסכם)
```

- רץ ב-Docker על שרת Oracle. השרת צריך להיות פעיל.
- לא משנה נתונים. לא מחליף את חישוב הדחיפות במסך.

---

## 13. פריסה

| רכיב | איך |
|---|---|
| צד לקוח | `git push` ל-`main` → GitHub Pages |
| צד שרת | אותו `push` → Vercel. משתני הסביבה מוגדרים בפרויקט. Redeploy אחרי כל שינוי בהם |
| Supabase | טבלאות, RLS, Bucket ומשתמש אחד נוצרים ידנית בדשבורד, או ב-SQL שנשמר בריפו |
| n8n | Workflow מיובא ל-n8n על השרת. Credentials מוגדרים שם |
| AI Studio | Spend Cap של $30 בחודש, ושמירת Interactions ל-7 ימים |
| לפני הצגה | בדיקה שפרויקט Supabase פעיל, ושהשרת של n8n פעיל |

---

## 14. בדיקות

| סוג | מה נבדק | איך |
|---|---|---|
| יחידה | Comparison Engine, צבירת Parent/Child, יחידות, תאריכים, מונים | `node:test`, על מקרים מהקורפוס |
| יחידה | Merge/Dedup | אזורים חופפים, דרישות זהות, דרישות דומות אבל שונות, Parent/Child |
| יחידה | Checklist | יצירה, איחוד, שינוי החלטה |
| תאימות | תבנית V3.6 מול V3.5 | הפרמטרים של ה-Benchmark מפיקים Prompt זהה |
| AI Regression | Mapper, ‏Extractor V3.6, ‏F15, ‏F18 | `ai-tests.md` |
| אינטגרציה | ששת השלבים | Background: קריאה ארוכה שמסתיימת תקין, וסגירת הלשונית במצב `waiting` והמשך אחרי חזרה. הרצה מקבילה של `map` ו-`metadata`, ‏Idempotency (409), ‏Retry לשלב בודד, כשל `metadata` שלא עוצר, העלאה חוזרת אחרי תפוגה, תקרות תקציב |
| מקצה לקצה | ה-Flow מ-PRD 1.4 | על שני מכרזי הקורפוס, כולל מדידת זמנים מול PRD 6.2 |

---

## הנחות

- **הנחה:** מבנה הריפו, שמות הקבצים והתיקיות (2).
- **הנחה:** אזור שה-Mapper החזיר בלי עמודים לא נשלח ל-Extractor ומסומן לבדיקה ידנית (4.4). לאישור ב-M2.
- **הנחה:** n8n קורא מ-Supabase עם Secret key, ששמור רק ב-Credentials של n8n, לקריאה בלבד.
- **הנחה:** הדפדפן בודק שלב במצב `waiting` כל 10 שניות.
- **הנחה:** זמן המתנה מרבי של 15 דקות לקריאה ברקע. ייקבע לפי מדידה ב-M2.
- **הנחה:** מקביליות של `extract` עם K=5. ייקבע לפי מדידה ב-M2.
- **הנחה:** נעילה "תקועה" פגה אחרי 330 שניות (300 שניות של Vercel ועוד מרווח).
- **הנחה:** המונים של ארבעת המצבים סופרים רק דרישות עם `requirement_target = business_fact`. דרישות מסוג אחר (התחייבויות הגשה, כללי ניקוד, מטא-דאטה) מוצגות ברשימה עם תווית היעד שלהן, ולא נכנסות למונים.
- **הנחה:** ערכי `status` בטבלה `ai_error_reports`, ושהסטטוס מתעדכן ידנית ב-Supabase.

## פריטים פתוחים

1. **Extractor V3.6:** בדיקות קבלה ב-M2, לפני שהוא מוגדר כ-Baseline.
2. **Merge/Dedup:** בדיקות ייעודיות לפני שהוא מוגדר כמאומת.
3. **F15 ו-F18:** ‏Prompts ו-Schemas חדשים, שצריך לכתוב ולבדוק ב-`ai-tests.md`.
4. **`region-context.json`:** לכתוב 16 ניסוחים, אחד לכל `region_type`. ניסוח `technical_mandatory` חייב להיות זהה ל-REGION CONTEXT של ה-Benchmark, כדי שבדיקת התאימות תעבור.
5. **זמני ריצה:** מדידת זמן העיבוד הכולל מול היעד של 10 דקות (PRD 6.2). Background עוקף את מגבלת 300 השניות, ולכן שער החלטה 1 נבדק מול היעד הזה.
