# tech-stack — TenderFit

**גרסה:** v2.1 · 9.10.2026 · החלטות 9.10: Pro לכל הקריאות, Background, עמודת פתרון בטבלת ההתאמה
**נגזר מ:** `course-stack.md` (8.10.2026), `PRD.md` (v1.3), `product-10-definitions.md` (v3.5), `MVP.md` (v1.2), `TenderFit_Extractor_V3.5_API_Technical_Specification.md`, `ai-tests.md`
**מעמד:** אחרי אישור, המסמך קובע יחד עם `course-stack.md` כל בחירה טכנולוגית. המסמך עוסק בבחירת טכנולוגיות בלבד. מבנה המערכת, חוזה השלבים וסדר הבנייה שייכים למסמכים אחרים.

**העיקרון:** סטאק הקורס כמו שהוא, ועליו התוספת הקטנה ביותר שה-PRD מחייב.

---

## 1. שלב 1: התאמת הדרישות לסטאק הקורס

✅ מכסה · 🟡 מכסה חלקית · ❌ לא מכסה

### 1.1 דרישות Must

| # | דרישה | כיסוי | מה חסר בסטאק הקורס | הפתרון |
|---|---|:-:|---|---|
| F01 | תשתית: GitHub Pages, פונקציה ב-Vercel, Supabase, RLS | ✅ | — | — |
| F02 | Login, משתמש אחד ידני | ✅ | רמת הרשאות 1 בקורס | — |
| F03 | רשימות קבועות ב-JSON | ✅ | — | — |
| F04 | נתוני דמו | ✅ | — | — |
| F06 | Business Facts דינמיים בעמודת JSON | ✅ | — | — |
| F07 | השלמת נתון חסר | ✅ | — | — |
| F08 | העלאת PDF עד 50MB ל-Storage פרטי | 🟡 | Storage מכסה. Supabase ממליצה על העלאה מתחדשת (TUS) מעל 6MB, והקורס לא קובע איך מעלים קובץ גדול. ראו 2.6 | העלאה רגילה של Supabase, בלי ספרייה נוספת (2.6) |
| F09 | Orchestration, בקשה נפרדת לכל שלב | 🟡 | הפונקציה מכסה. קריאה אחת ל-Pro עם Thinking High על מכרז של 171 עמ' עלולה לעבור 300 שניות (מגבלת Hobby). נפתר ב-Background של Gemini. ראו 2.3 | Background ב-Interactions API (2.3) |
| F11 | Requirement Mapper V1.2 | 🟡 | ברירת המחדל בקורס היא Gemini Flash. ה-Mapper אומת על `gemini-3.1-pro-preview` בלבד. חריגה מאושרת, ומחייבת מפתח בתשלום. ראו 2.1 | `gemini-3.1-pro-preview`, חריגה מאושרת (2.1) |
| F12 | Extractor V3.5 / V3.6 | 🟡 | כמו F11 | `gemini-3.1-pro-preview`, חריגה מאושרת (2.1) |
| F13 | Validation בקוד מול JSON Schema | 🟡 | הקורס דורש לבדוק את מבנה הפלט, אבל לא קובע כלי. ראו 2.4 | Ajv (2.4) |
| F14 | Merge/Dedup בקוד | ✅ | קוד בלבד | — |
| F15 | מטא-דאטה של המכרז | 🟡 | Prompt חדש. ראו 2.1 | `gemini-3.1-pro-preview` מההתחלה (2.1) |
| F16 | זיהוי Facts חסרים | ✅ | קוד בלבד | — |
| F17 | Comparison Engine ובדיקות יחידה | 🟡 | ההשוואה בקוד מכוסה. הקורס לא קובע כלי לבדיקות היחידה ש-PRD 6.4 דורש. ראו 2.10 | `node:test` (2.10) |
| F18 | Fit Analysis | 🟡 | Prompt חדש. ראו 2.1 | `gemini-3.1-pro-preview` מההתחלה (2.1) |
| F19 | בדוק שוב | ✅ | — | — |
| F20 | כותרת ודחיפות, בקוד | ✅ | — | — |
| F21 | תמונת מצב, בקוד | ✅ | — | — |
| F23 | רשימת דרישות ו-Source Evidence | ✅ | — | — |
| F24 | Go / No-Go | ✅ | — | — |
| F25 | יצירת Checklist | ✅ | — | — |
| F26 | ניהול Checklist | ✅ | — | — |
| F27 | דיווח על טעות AI | ✅ | טבלה שלישית | — |
| F29 | Freeze, ‏`ai-tests.md` ו-Regression | ✅ | ה-hash מחושב ב-`node:crypto` המובנה | — |
| F30 | Responsive, RTL ונגישות | ✅ | הגופן (Heebo) נקבע ב-`DESIGN.md` | — |
| PRD 5.5 | ניטור עלות לכל הרצה | 🟡 | הקורס עובד בשכבה החינמית ואין בו בקרת עלות. ראו 2.5 | Spend Cap ב-AI Studio ותקרות בקוד (2.5) |

### 1.2 דרישות Should

| # | דרישה | כיסוי | מה חסר | הפתרון |
|---|---|:-:|---|---|
| F05 | פרופיל בסיסי | ✅ | — | — |
| F10 | סטטוס עיבוד מפורט | ✅ | מתוך ה-Frontend, בלי Realtime | — |
| F22 | סיכום, מועדים וערבויות | ✅ | נשען על F15 | — |
| F28 | רשימת מכרזים | ✅ | — | — |
| F32 | תזכורת יומית ב-n8n במייל | 🟡 | n8n ו-Gmail מכוסים. הקורס לא קובע איפה n8n רץ, ו-Supabase מחליפה את סוג המפתח ש-n8n צריך. ראו 2.8 ו-2.9 | Docker על שרת Oracle, עם Secret key (2.8, 2.9) |

### 1.3 מסקנה

- **אין דרישת Must שלא ניתנת למימוש בסטאק הקורס.** לכן אין עצירה לפני ההמלצה.
- הסיכון הגדול הוא F09: מגבלת 300 השניות. הוא לא מוכח, ולכן נשאר פריט לאימות ב-M1, עם חלופה מוכנה בתוך הסטאק (2.3).

---

## 2. שלב 2: מחקר והשוואות

כל המקורות נבדקו ב-9.10.2026.

### 2.1 מודל ה-AI

| | `gemini-3.1-pro-preview` | `gemini-3.8-flash` | `gemini-2.5-pro` |
|---|---|---|---|
| התאמה לדרישה | ה-Mapper וה-Extractor **אומתו עליו** (Benchmark ב-`ai-tests.md`) | לא אומת. החלפה ל-Mapper ול-Extractor = גרסה חדשה ו-Regression מלא | לא אומת. אותו דבר |
| שילוב עם הסטאק | Gemini API, אותו SDK. PDF, ‏Structured Output ו-Thinking נתמכים | אותו SDK. PDF, ‏Structured Output ו-Thinking (low / medium / high) | אותו SDK |
| עלות לכל 1M Tokens | $2 קלט, $12 פלט (עד 200K). **אין שכבה חינמית** | $0.75 קלט, $3.75 פלט עד 31.12.2026. מ-1.1.2027: ‏$1.50 ו-$7.50. יש שכבה חינמית | $1.25 קלט, $10 פלט |
| בשלות | **Preview** מ-19.2.2026. אין תאריך כיבוי. מודל Preview יוצא משימוש בהודעה של שבועיים לפחות | **Stable**. Google ממליצה עליו לפרויקטים חדשים | Stable, אבל זמין רק למי שהשתמש בו לאחרונה |
| תיעוד | מלא, דף מודל רשמי | מלא, דף מודל רשמי | מלא |

**מסקנה:**
- **Mapper ו-Extractor:** ‏`gemini-3.1-pro-preview`. זו החריגה שכבר אושרה, והיחידה שעברה Benchmark.
- **F15 ו-F18:** גם הם רצים על `gemini-3.1-pro-preview`, מההתחלה. מודל אחד לכל הקריאות (החלטה מ-9.10.2026). `gemini-3.8-flash` נשאר החלופה אם Google תכבה את ה-Preview.
- **מפתח בתשלום לכל הקריאות.** Pro לא זמין בחינם, והקלטים הם מכרזים אמיתיים. בשכבה בתשלום התוכן לא משמש לשיפור המוצרים של Google.
- **סיכון Preview:** אם Google תודיע על כיבוי, החלופה היא מודל Stable, עם גרסה חדשה ו-Regression מלא. אין שדרוג שקט.

### 2.2 ממשק ה-API של Gemini

| | Interactions API | generateContent |
|---|---|---|
| התאמה | הפרוטוטייפ וה-Benchmark רצו עליו. תומך ב-`system_instruction`, ‏`thinking_level`, ‏`temperature`, ‏`store=false` ו-`background` | עובד, אבל ה-Baseline לא נבדק דרכו |
| שילוב | `@google/genai` תומך מגרסה 2.3.0 | אותו SDK |
| בשלות | **GA** מיוני 2026, ו-Google ממליצה עליו לכל פרויקט חדש | מוגדר Legacy, ועדיין נתמך במלואו |

**מסקנה:** Interactions API. הוא ה-GA, והוא מה שאומת.

### 2.3 קריאה ארוכה מ-300 שניות

קריאה ל-Pro עם Thinking High על מכרז ארוך עלולה לעבור את מגבלת 300 השניות של Vercel Hobby (שער החלטה 1 ב-`MVP.md`).

| | Background ב-Interactions API | Vercel Pro | Vercel Workflows |
|---|---|---|---|
| איך | `background=true`, והפונקציה בודקת את התוצאה בבקשה הבאה | Max Duration של 800 שניות | ריצה בלי מגבלת זמן |
| שילוב | בלי שירות חדש ובלי תלות חדשה | בלי שינוי קוד | רכיב חדש בסטאק |
| עלות | חינם. מחייב `store=true`: ה-Interaction נשמר אצל Google (בתשלום: 55 יום, ואפשר לקצר ל-7) | ‏$20 לחודש | לפי שימוש |
| חיסרון | לא תואם `store=false` שבהגדרות ה-Baseline. לא משנה את פלט המודל, אבל משנה את שמירת הנתונים | יוצא מהשכבה החינמית | חורג מהסטאק |

**מסקנה:** Background ב-Interactions API, **מההתחלה, לכל קריאות המודל** (החלטה מ-9.10.2026). הפונקציה שולחת את הקריאה עם `background=true` ומחזירה מזהה. הבקשה הבאה בודקת אם התשובה מוכנה. כך אף בקשה לא מתקרבת ל-300 שניות, בלי שירות חדש ובלי Vercel Pro.

- `store=true` במקום `store=false`. זה לא משנה את פלט המודל, ולכן לא נחשב גרסה חדשה של ה-Baseline.
- זמן השמירה אצל Google מוגדר ב-AI Studio ל-**7 ימים**, המינימום במפתח בתשלום.
- נשלחים רק מכרזים פומביים ופרופיל עסק בדיוני (PRD 5.6).

### 2.4 ולידציית JSON בשרת

| | Ajv | Zod | בדיקות ידניות |
|---|---|---|---|
| התאמה | בודק מול **אותו קובץ Schema** שנשלח ל-Gemini. תומך ב-`nullable` בלי הגדרה נוספת | ה-SDK תומך בו, אבל ה-Schema נכתב מחדש בקוד: שני מקורות אמת | אפשרי, אבל 21 שדות `nullable` ו-Parent/Child, וקל לטעות |
| שילוב | תלות אחת, בלי build | תלות אחת | בלי תלות |
| בשלות | ותיק ונפוץ מאוד | נפוץ | — |

**מסקנה:** Ajv.
**ממצא:** ב-Ajv, ‏`nullable` לא חל על `enum`. ב-Schema V3.5 יש שדות `nullable` עם `enum` (למשל `qualifier` ו-`comparison_operator`). לכן העותק לבדיקה בזיכרון צריך רק להוסיף `null` לרשימת ה-`enum` בשדות האלה. הקובץ שנשלח ל-Gemini לא משתנה. ה-Schema לא משתמש ב-`format`, ולכן אין צורך ב-`ajv-formats`.

### 2.5 בקרת עלות של Gemini

| | Spend Cap לפרויקט ב-AI Studio | Budget Alert ב-Google Cloud | בקרה בקוד בלבד |
|---|---|---|---|
| התאמה | תקרה חודשית בדולרים לפרויקט. קיים ממרץ 2026 | התראה במייל בלבד. לא עוצר חיוב | חוסם לפי עלות משוערת. לא רואה חיוב אמיתי |
| חיסרון | עיכוב של כ-10 דקות, והחריגה בזמן הזה על המשתמש | לא חוסם | תלוי בדיוק ההערכה |
| עלות | חינם | חינם | חינם |

**מסקנה:** Spend Cap של $30 לחודש בפרויקט של המפתח, ועליו התקרות בקוד (חודשית ולמכרז), שכבר נקבעו. Budget Alert מיותר כשיש Spend Cap.

### 2.6 העלאת PDF ל-Storage

| | העלאה רגילה ב-`supabase-js` | העלאה מתחדשת (TUS) | Signed Upload URL |
|---|---|---|---|
| התאמה | עובדת עד 50MB. Supabase ממליצה עליה עד 6MB | Supabase ממליצה עליה מעל 6MB, לאמינות | מיועדת להעלאה בלי משתמש מחובר. אצלנו יש משתמש |
| שילוב | בלי תלות נוספת | ספרייה נוספת בדפדפן (`tus-js-client`) | קוד נוסף בפונקציה |

**מסקנה:** העלאה רגילה. מכרזי הקורפוס הם קבצים בודדים, ולא צריך ספרייה נוספת. TUS נכנס רק אם העלאה של קובץ אמיתי נכשלת.

### 2.7 טעינת `supabase-js` בדפדפן

| | jsDelivr | unpkg | esm.sh |
|---|---|---|---|
| התאמה | כתובת ESM עם גרסה מקובעת | כתובת UMD | כתובת ESM |
| בשלות | מופיע בתיעוד של Supabase | מופיע בתיעוד של Supabase | לא מופיע בתיעוד של Supabase |

**מסקנה:** jsDelivr, כ-ES Module, בגרסה מקובעת בכתובת (לא `@2` ולא `latest`).

### 2.8 מפתחות Supabase

Supabase מוציאה משימוש את המפתחות `anon` ו-`service_role` עד סוף 2026, ומחליפה אותם:

| מפתח ישן | מפתח חדש | איפה הוא חי אצלנו |
|---|---|---|
| `anon` | Publishable, ‏`sb_publishable_...` | בדפדפן ובמשתני הסביבה של Vercel. מוגן ב-RLS. זה היוצא מן הכלל של חוק המפתחות |
| `service_role` | Secret, ‏`sb_secret_...` | רק ב-Credentials של n8n. עוקף RLS, ולכן ה-Workflow קורא בלבד |

**מסקנה:** מתחילים ישר עם המפתחות החדשים. ה-Credential של Supabase ב-n8n כבר מבקש Secret Key. מפתח Secret גם נחסם אוטומטית אם הוא נשלח מדפדפן.

### 2.9 איפה n8n רץ

| | התקנה עצמית ב-Docker, על שרת Oracle של בעל המוצר | n8n Cloud, ‏Starter | n8n על המחשב האישי |
|---|---|---|---|
| התאמה | רץ כל יום, גם כשהמחשב כבוי | רץ כל יום | רץ רק כשהמחשב דולק. לא מתאים לתזכורת יומית |
| שילוב | Docker הוא דרך ההתקנה ש-n8n ממליצה עליה | בלי תחזוקה | — |
| עלות | Community Edition חינם. השרת כבר קיים | ‏€20 לחודש (בתשלום שנתי). ניסיון בלי כרטיס אשראי, עד 1,000 הרצות | חינם |
| חיסרון | תחזוקה ועדכונים עליך | בתשלום | — |

**מסקנה:** התקנה עצמית ב-Docker על שרת Oracle, כמו שכבר הוחלט. חינם, ורץ גם כשהמחשב כבוי.

### 2.10 בדיקות יחידה ל-Comparison Engine

| | `node:test` | Vitest | Jest |
|---|---|---|---|
| שילוב | מובנה ב-Node.js. בלי תלות ובלי הגדרות | תלות נוספת | תלות נוספת, ותמיכה ב-ESM דורשת הגדרות |
| בשלות | Stable מאז Node.js 20 | נפוץ | נפוץ מאוד |

**מסקנה:** `node:test`. הקורס אומר לוותר על כל ספרייה שאפשר לוותר עליה.

### 2.11 שירותים שהמוצר לא צריך

| צורך | למה לא |
|---|---|
| תשלומים | המוצר לא גובה כסף ב-MVP |
| מפות | אין מיקום במוצר |
| SMS או WhatsApp | Won't ב-PRD 7.1 |
| שירות דיוור | אסור בקורס. המייל היחיד הוא F32, דרך n8n ו-Gmail |
| OCR או חילוץ טקסט | Won't ב-MVP (F31). Gemini קורא את ה-PDF ישירות |
| צפייה ב-PDF בתוך המוצר | לא דרישה. Source Evidence מוצג כעמוד, סעיף וציטוט |
| Push, ‏Realtime | אסור בקורס |

---

## 3. שלב 3: ההמלצה

### 3.1 ה-Technology Stack

| שכבה | בחירה | נימוק | מקור |
|---|---|---|---|
| צד לקוח | HTML, ‏CSS ו-Vanilla JS (ES Modules), ב-GitHub Pages | סטאק הקורס, והוא מכסה את כל המסכים | `course-stack.md` |
| ספרייה בדפדפן | `@supabase/supabase-js` ‏2.117.3, מ-jsDelivr כ-ES Module | הלקוח הרשמי, וטעינה מ-CDN בלי build מופיעה בתיעוד | [Supabase](https://supabase.com/docs/reference/javascript/installing) |
| גופן | Heebo מ-Google Fonts | נקבע ב-`DESIGN.md` | `DESIGN.md` |
| צד שרת | פונקציה אחת ב-Vercel, ‏Node.js ‏24.x, ‏JavaScript ESM | סטאק הקורס. ‏24.x היא ברירת המחדל, ו-20.x יוצאת משימוש | [Vercel Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) |
| מגבלות שרת | Hobby: עד 300 שניות לבקשה, 2GB זיכרון, 4.5MB לגוף הבקשה | מספיק לבקשה נפרדת לכל שלב, ולקובץ של עד 50MB בזיכרון | [Vercel Limits](https://vercel.com/docs/functions/limitations) |
| מודל: Mapper, ‏Extractor | `gemini-3.1-pro-preview` | המודל היחיד שעבר את ה-Benchmark. חריגה מאושרת | [Gemini Models](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview) |
| מודל: F15, ‏F18 | `gemini-3.1-pro-preview` | מודל אחד לכל הקריאות, באותה חריגה שכבר אושרה (החלטה מ-9.10.2026) | [Gemini Pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| ממשק ה-AI | Interactions API | GA, מומלץ לפרויקטים חדשים, ועליו אומת ה-Baseline | [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview) |
| SDK של AI | `@google/genai` ‏2.28.0 | ה-SDK הרשמי. תומך ב-Interactions ובהעלאת קבצים | [npm](https://www.npmjs.com/package/@google/genai) |
| ריצה ארוכה | Background ב-Interactions API, עם `store=true` ושמירה של 7 ימים | עוקף את מגבלת 300 השניות בלי שירות חדש | [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview) |
| קבצים ב-Gemini | Files API | חינם, עד 50MB או 1,000 עמודים ל-PDF, הקובץ נשמר 48 שעות | [Document Processing](https://ai.google.dev/gemini-api/docs/document-processing) · [Files API](https://ai.google.dev/gemini-api/docs/files) |
| ולידציה | `ajv` ‏8.20.0 | בודק מול אותו קובץ Schema, ותומך ב-`nullable` | [Ajv](https://ajv.js.org/json-schema.html) |
| בדיקות יחידה | `node:test` | מובנה ב-Node.js, בלי תלות | [Node.js](https://nodejs.org/api/test.html) |
| נתונים והתחברות | Supabase: ‏PostgreSQL עם 3 טבלאות, Auth ברמה 1, ‏RLS | סטאק הקורס, והשכבה החינמית מספיקה (500MB DB, ‏1GB קבצים) | [Supabase Pricing](https://supabase.com/pricing) |
| קבצים | Supabase Storage, ‏Bucket פרטי, העלאה רגילה | עד 50MB בשכבה החינמית, בלי ספרייה נוספת | [Supabase Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads) |
| מפתחות Supabase | Publishable ו-Secret | המפתחות הישנים יוצאים משימוש עד סוף 2026 | [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys) |
| אוטומציה | n8n Community Edition ב-Docker, על שרת Oracle | סטאק הקורס, חינם, ורץ גם כשהמחשב כבוי | [n8n Hosting](https://docs.n8n.io/hosting/) |
| מייל | n8n ו-Gmail של הסטודנט, לכתובת בדיקה | סטאק הקורס | `course-stack.md` |
| בקרת עלות | Spend Cap של $30 לחודש ב-AI Studio, ועליו תקרות בקוד | התקרה היחידה ש-Google מציעה לפרויקט | [Google Blog](https://blog.google/innovation-and-ai/technology/developers-tools/more-control-over-gemini-api-costs/) |
| גרסאות | Git ו-GitHub, ענף `main` | סטאק הקורס | `course-stack.md` |

### 3.2 התוספת לסטאק הקורס, ולא יותר

| תוספת | למה היא חובה |
|---|---|
| `gemini-3.1-pro-preview` ומפתח Gemini בתשלום | F11 ו-F12 אומתו רק עליו. חריגה מאושרת. משמש גם ל-F15 ול-F18 |
| `@google/genai` | העלאת PDF ל-Files API וקריאה ל-Interactions API מהפונקציה |
| `ajv` | F13: בדיקת המבנה שהקורס מחייב |
| Spend Cap ב-AI Studio | מפתח בתשלום מחייב תקרה. זו הגדרה, לא קוד |

`@supabase/supabase-js` הוא חלק מ-Supabase שבסטאק. ‏`node:test` ו-`node:crypto` מובנים ב-Node.js.
**בשרת: שלוש תלויות npm בלבד.** אין להוסיף תלות בלי לשאול.

### 3.3 חוק המפתחות, לכל רכיב

| מפתח | איפה הוא חי | בדפדפן? |
|---|---|:-:|
| מפתח Gemini | משתנה סביבה סודי ב-Vercel | ❌ |
| Supabase Publishable | בקוד הדפדפן ובמשתני הסביבה של Vercel. מוגן ב-RLS | ✅ |
| Supabase Secret | Credentials של n8n בלבד | ❌ |
| Gmail (OAuth) | Credentials של n8n בלבד | ❌ |

אין מפתח בקוד, בריפו או בקובץ הגדרות. אין מפתח Secret של Supabase ב-Vercel.

### 3.4 קיבוע גרסאות

| רכיב | גרסה, נכון ל-9.10.2026 |
|---|---|
| Node.js ב-Vercel | `24.x`, דרך `engines` ב-`package.json` |
| `@google/genai` | `2.28.0` |
| `@supabase/supabase-js` | `2.117.3`, בשרת ובכתובת ה-CDN |
| `ajv` | `8.20.0` |
| Gemini | שם מודל מלא בכל קריאה, ונשמר בכל תוצאה. בלי Alias |

גרסאות מקובעות ב-`package-lock.json`. עדכון גרסה נעשה ביד, ועדכון של `@google/genai` מחייב Regression.

---

## 4. מה השתנה מול v1.2 (בארכיון)

1. **Pro לכל הקריאות, כולל F15 ו-F18** (החלטה מ-9.10.2026). ללא שינוי מ-v1.2.
2. **Spend Cap ב-AI Studio** במקום Budget Alert ב-Google Cloud.
3. **מפתחות Publishable ו-Secret** של Supabase במקום `anon` ו-`service_role`.
4. **Node.js 24.x** במקום 22.x. ‏`supabase-js` דורש 22 לפחות.
5. **Ajv:** ‏`nullable` נתמך ישירות. העותק בזיכרון רק מוסיף `null` ל-`enum` בשדות nullable.
6. **`node:test`** לבדיקות היחידה.
7. **Background ב-Interactions API לכל קריאות המודל**, עם `store=true` ושמירה של 7 ימים (החלטה מ-9.10.2026). קודם: `store=false`.
8. **הוסר:** חוזה השלבים, משתני הסביבה ומבנה הפונקציה. הם מבנה מערכת, ולא בחירת טכנולוגיה.

---

## 5. פריטים לאימות ב-M1

1. Background עובד מתוך פונקציית Vercel: יצירת קריאה, בדיקת סטטוס בבקשה נפרדת, וקבלת הפלט המלא. זמן הריצה של Mapper ו-Extractor על המכרז בן 171 העמודים נמדד לצורך זמן העיבוד הכולל (יעד ≤ 10 דקות).
2. זמן השמירה מוגדר ל-7 ימים ב-AI Studio.
3. גישה ומכסות (Rate Limits) ל-`gemini-3.1-pro-preview` במפתח בתשלום, כולל קריאות `extract` במקביל.
4. `files.upload()` של `@google/genai` מקבל Blob בתוך פונקציית Vercel, והקובץ מגיע למצב `ACTIVE`.
5. ה-Schema של V3.5, עם `nullable`, מתקבל ב-Interactions API בגרסת ה-SDK המקובעת. התיעוד העדכני מציג רק `["string", "null"]`.
6. Spend Cap פעיל, וקריאה נחסמת אחרי חריגה.
7. העלאה רגילה של PDF אמיתי מהקורפוס ל-Storage מצליחה.

## הנחות

- **הנחה:** קובצי ה-PDF בקורפוס קטנים מ-50MB. לא נבדק גודל הקבצים עצמם.
- **הנחה:** תקרה של $30 לחודש מספיקה ל-M2. העלות למכרז עוד לא נמדדה מקצה לקצה.

## מקורות

- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3.1 Pro Preview](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview)
- [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)
- [Gemini Deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
- [Interactions API Overview](https://ai.google.dev/gemini-api/docs/interactions-overview)
- [Interactions API Guide](https://ai.google.dev/gemini-api/docs/interactions)
- [Structured Output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Document Processing](https://ai.google.dev/gemini-api/docs/document-processing)
- [Files API](https://ai.google.dev/gemini-api/docs/files)
- [Gemini API Spend Caps, Google Blog](https://blog.google/innovation-and-ai/technology/developers-tools/more-control-over-gemini-api-costs/)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Vercel Node.js Versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel Pricing](https://vercel.com/pricing)
- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys)
- [supabase-js Installing](https://supabase.com/docs/reference/javascript/installing)
- [n8n Pricing](https://n8n.io/pricing/)
- [n8n Hosting](https://docs.n8n.io/hosting/)
- [n8n Supabase Credentials](https://docs.n8n.io/integrations/builtin/credentials/supabase/)
- [Ajv JSON Schema](https://ajv.js.org/json-schema.html)
- [Node.js Test Runner](https://nodejs.org/api/test.html)
- [@google/genai ב-npm](https://www.npmjs.com/package/@google/genai)
