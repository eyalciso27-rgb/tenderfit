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

## קבצים נוספים

| קובץ | תוכן |
|---|---|
| `CLAUDE.md` | הוראות קבע ל-Claude Code: מסמכי האמת, חוקים שאסור לעבור, ואיך עובדים |
| `KICKOFF_M1.md` | צעדים ידניים ו-Prompt פתיחה לשלב M1 |
| `docs/` | עותק של מסמכי האפיון ותמונות העיצוב (מקור: תיקיית האפיון). שינוי באפיון = עדכון שם והעתקה מחדש |
