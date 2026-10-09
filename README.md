# TenderFit

מערכת AI לניתוח והתאמת מכרזים. אפיון מלא בתיקיית הפרויקט: PRD, tech-stack, ARCHITECTURE, DESIGN, MILESTONES.

> AI extracts and normalizes; Code compares; Human decides.

## M0 — Freeze (8–9.10.2026)

| תיקייה | תוכן |
|---|---|
| `ai/mapper-v1.2/` | Requirement Mapper V1.2 — MVP Validated, קבצי מקור |
| `ai/extractor-v3.5/` | Requirement Extractor V3.5 — שוחזר מהמפרט, נוקה מכנית ועבר Regression (`provenance/`, `validation/`) |
| `reference/run_mapper.py` | מימוש ייחוס בפייתון ל-API |
| `data/business-facts-registry.json` | Seed Registry של Business Facts |
| `ai-tests.md` | יומן Regression ובדיקות AI |

**כלל:** אין לערוך את `ai/` במקום. כל שינוי ב-Prompt, Schema, Model או Temperature = גרסה חדשה + Regression.
**סודות:** אין מפתחות בריפו. `GEMINI_API_KEY` רק במשתני הסביבה של Vercel.

## M1 — Walking Skeleton

השלד כולל כניסה ב־Supabase Auth, קריאה ישירה מוגנת RLS לשם העסק, פונקציית Vercel יחידה, ושלבי `upload` ו־`map` מינימליים. `map` נשלח ל־Gemini Interactions עם `background: true` ו־`store: true`, והדפדפן בודק את הסטטוס מדי <bdi>10</bdi> שניות.

הקמה:

1. צורים משתמש Auth ידני ב־Supabase, ואז מריצים ב־SQL Editor את `supabase/schema.sql` ואת `supabase/seed.sql`, לפי הסדר.
2. מעלים את PDF מכרז <bdi>20/2026</bdi> ל־Bucket `tender-pdfs`, בנתיב ששמור בשורת ה־Seed הראשונה: `{user_id}/10000000-0000-4000-8000-000000000001.pdf`.
3. מגדירים ב־Vercel: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ALLOWED_ORIGIN`, `MONTHLY_AI_BUDGET_USD=30`, `TENDER_AI_BUDGET_USD=12`.
4. מחליפים את שלושת ערכי המציין ב־`js/config.js` ב־Project URL, ב־Publishable key ובכתובת Vercel. אלה ערכים ציבוריים; אין להכניס Supabase Secret key או Gemini key.
5. מפעילים GitHub Pages מהשורש של `main`, מגדירים את כתובת Pages המדויקת ב־`ALLOWED_ORIGIN`, ומבצעים Redeploy ב־Vercel.

בדיקות מקומיות:

```powershell
npm install
npm test
```

## קבצים נוספים

| קובץ | תוכן |
|---|---|
| `CLAUDE.md` | הוראות קבע ל-Claude Code: מסמכי האמת, חוקים שאסור לעבור, ואיך עובדים |
| `KICKOFF_M1.md` | צעדים ידניים ו-Prompt פתיחה לשלב M1 |
| `docs/` | עותק של מסמכי האפיון ותמונות העיצוב (מקור: תיקיית האפיון). שינוי באפיון = עדכון שם והעתקה מחדש |
