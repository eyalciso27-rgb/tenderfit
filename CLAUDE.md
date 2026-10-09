# CLAUDE.md — TenderFit

הוראות קבע ל-Claude Code בריפו הזה. קרא אותן בתחילת כל משימה.

> **AI extracts and normalizes; Code compares; Human decides.**

## 1. מה המוצר

TenderFit: עסק קטן מעלה מכרז PDF. Gemini מחלץ דרישות אטומיות עם מקור. הקוד משווה אותן ל-Business Facts של העסק. המשתמש רואה עומד / פער / דורש בדיקה / חסר מידע, מחליט Go / No-Go ומנהל Checklist.

## 2. מסמכי האמת (`docs/`) — סדר עדיפות

| נושא | המסמך שקובע |
|---|---|
| מה המוצר, מה בתוך ה-MVP ומה לא | `docs/product-10-definitions.md`, `docs/MVP.md` |
| דרישות, זרימות, מקרי קצה | `docs/PRD.md` |
| כלים, תלויות, מגבלות | `docs/course-stack.md`, ואחריו `docs/tech-stack.md` |
| מבנה, טבלאות, שלבי עיבוד, אלגוריתמים | `docs/ARCHITECTURE.md` |
| עיצוב, צבעים, רכיבים, ניסוח | `docs/DESIGN.md`, `docs/design/*.png`, Figma: https://www.figma.com/design/sz5IqrzOwwZtTzLU5bjbTc |
| סדר העבודה ובדיקות הסיום | `docs/MILESTONES.md` |
| Prompts, Schemas והגדרות AI | `ai/` (קפוא) ו-`docs/TenderFit_Extractor_V3.5_API_Technical_Specification.md` |

**אם יש סתירה בין מסמכים, או משהו חסר וחשוב: עצור ושאל.** אל תכריע לבד, ואל תמציא דרישה.

## 3. חוקים שאסור לעבור

### סטאק
- צד לקוח: HTML, CSS ו-Vanilla JS (ES Modules) ב-GitHub Pages. **בלי** React, TypeScript, Next.js וכלי בנייה.
- צד שרת: **פונקציה אחת** `api/tenderfit.js` ב-Vercel (Node.js 24.x, ESM). קוד משותף ב-`lib/`.
- תלויות npm: **רק** `@google/genai`, `@supabase/supabase-js`, `ajv`. אין להוסיף תלות בלי לשאול.
- נתונים: Supabase. **עד 3 טבלאות**: `tenders`, `business_profile`, `ai_error_reports`. רשימות של שורה → עמודת JSON.
- לא בסטאק: Realtime, פונקציות בתוך Supabase, Firebase, Make, Push, שירות דיוור, `generateContent`.

### סודות
- אין מפתח בקוד, ב-HTML, ב-JSON או ב-commit. `GEMINI_API_KEY` רק במשתני הסביבה של Vercel.
- **אין Supabase Secret key ב-Vercel.** הפונקציה פונה ל-Supabase עם Publishable key + ה-JWT של המשתמש (RLS). אין להשתמש במפתחות הישנים `anon` ו-`service_role`.
- הדפדפן לא קורא ל-Gemini לעולם.

### AI
- **אסור לערוך שום קובץ תחת `ai/`.** כל שינוי ב-Prompt, Schema, Model או Temperature = גרסה חדשה בתיקייה חדשה + Regression לפי `ai-tests.md`.
- בכל טעינה של קבצי `ai/` בודקים SHA-256 מול `BASELINE_MANIFEST.json`. אי-התאמה = כשל.
- מודל: `gemini-3.1-pro-preview` לכל הקריאות (Mapper, ‏Extractor, ‏F15, ‏F18).
- קריאה: `client.interactions.create()` עם input בסדר **document ואז text**, ו-`response_format` כרשימה. `store: true`, ‏`background: true`. בלי `tools`. ה-`interaction.id` נשמר ב-`processing`, והבדיקה החוזרת היא `client.interactions.get(id)` (ARCHITECTURE 4.5).
- פלט: רק אחרי `status` = `completed`: ‏`JSON.parse` ואז Ajv. אסור "לתקן" JSON ידנית. כל `status` סופי אחר = כשל. קריאה שלא הסתיימה תוך 15 דקות = כשל.
- ה-Schema משתמש ב-`"nullable": true`. Ajv בודק מול עותק בזיכרון (`nullable` → `[T,"null"]`, ו-`null` מתווסף ל-enum). הקובץ שנשלח ל-Gemini לא משתנה.

### לוגיקה
- **השוואה, חישוב, תאריכים, דחיפות, Merge, אחוז עמידה וסיכום מצב: בקוד, לא במודל.**
- בכל ספק התוצאה היא **"דורש בדיקה"**, לא "עומד".
- Parent לא נספר במונים. התוצאה שלו נגזרת מה-Children (ARCHITECTURE 6.3).
- `business_fact_key` מנורמל דרך aliases לפני כל שימוש. אסור להשוות מפתח גולמי.
- Merge/Dedup: איחוד **רק** בהתאמה מלאה. בספק, שתי הרשומות נשמרות ומסומנות לבדיקה.

### UI
- RTL, Mobile-first מ-375px, Heebo. צבעים כמשתני CSS לפי DESIGN 3.
- מצב לעולם לא בצבע בלבד: מילה + אייקון.
- אסור להציג "המלצה", "המלצת AI" או "ציון התאמה" (DESIGN 11). Go / No-Go הוא החלטת המשתמש בלבד.
- מספרים, תאריכים ומספרי סעיפים בתוך עברית עטופים ב-`<bdi>`.

## 4. איך עובדים

- עובדים לפי `docs/MILESTONES.md`, **שלב אחד בכל פעם**. בסוף שלב מריצים את בדיקות ה-Definition of Done שלו, מדווחים מה עבר ומה לא, **ועוצרים עד לאישור מפורש** לפני השלב הבא.
- **בשערי החלטה (1א, 1ב, 2) עוצרים** ומציגים את המדידה. לא ממשיכים בלי אישור.
- לפני שכותבים קוד: קוראים את סעיף ה-ARCHITECTURE הרלוונטי.
- בונים את הטבלה לפני המסך.
- כל פונקציה בשרת מחזירה תמיד JSON, גם בשגיאה, בלי הודעת שגיאה גולמית של ספק.
- בדיקות יחידה ב-`node:test`, בלי תלות נוספת.
- כל קריאה ל-Gemini נרשמת ב-`ai_usage` (tokens, משך, עלות משוערת). לפני כל קריאה בודקים תקרות תקציב.
- ענף `main` בלבד. commit קטן וברור לכל משימה.
- עברית פשוטה בממשק. מונחים מקצועיים באנגלית נשארים באנגלית.

## 5. מבנה הריפו

ראה `docs/ARCHITECTURE.md` סעיף 2. עיקרי:
`index.html` ושאר הדפים בשורש · `css/` · `js/` · `api/tenderfit.js` · `lib/` · `ai/` (קפוא) · `data/` · `tests/` · `reference/run_mapper.py` (ייחוס בלבד, לא נפרס) · `docs/`.
