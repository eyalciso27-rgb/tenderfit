# Prompt פתיחה ל-Claude Code — M1: Walking Skeleton

> להדביק ב-Claude Code בתיקיית הריפו. לפני כן: לבצע את "צעדים ידניים" למטה.

---

## צעדים ידניים (אתה, לפני Claude Code)

1. **GitHub:** ריפו ציבורי, ענף `main`, עם תוכן התיקייה `repo/`. ב-Settings → Pages: מקור `main`, תיקיית השורש.
2. **Supabase:** פרויקט חדש (תוכנית חינמית). לרשום: Project URL ו-Publishable key (`sb_publishable_...`). לא להשתמש ב-anon key הישן. ב-Authentication: לבטל הרשמה עצמית, וליצור ידנית משתמש אחד (אימייל + סיסמה).
3. **Vercel:** פרויקט חדש שמחובר לאותו ריפו. Environment Variables:
   `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ALLOWED_ORIGIN` (כתובת GitHub Pages), `MONTHLY_AI_BUDGET_USD=30`, `TENDER_AI_BUDGET_USD=12`.
4. **Google Cloud:** מפתח Gemini **בתשלום** (gemini-3.1-pro-preview לא זמין בשכבה החינמית), וב-AI Studio: ‏Spend Cap של $30 בחודש, ושמירת Interactions ל-7 ימים.
5. **קובץ בדיקה:** ה-PDF של מכרז 20/2026 (171 עמ'), להעלאה ידנית ל-Storage בשלב המדידה.

---

## ה-Prompt

```
קרא את CLAUDE.md, ואז את docs/MILESTONES.md (M1), docs/ARCHITECTURE.md (סעיפים 1–4, 10, 13) ו-docs/tech-stack.md.

המשימה: M1 — Walking Skeleton. אל תתחיל את M2.

בנה:
1. package.json ("type": "module", "engines": { "node": "24.x" }) עם שלוש התלויות בלבד: @google/genai, @supabase/supabase-js, ajv. vercel.json עם maxDuration: 300 ל-api/tenderfit.js.
2. supabase/schema.sql: שלוש הטבלאות בדיוק לפי ARCHITECTURE 3.1–3.3, RLS לפי 3.4 (select/insert/update רק כש-user_id = auth.uid(), בלי delete), ו-bucket פרטי tender-pdfs עם מדיניות לפי תיקיית auth.uid(). וגם supabase/seed.sql: עסק בדיוני ולפחות 5 שורות ב-tenders.
3. data/categories.json, data/units.json, data/pricing.json (מחירי gemini-3.1-pro-preview כמו ב-reference/run_mapper.py: $2/$12 למיליון עד 200K, $4/$18 מעליו).
4. api/tenderfit.js: CORS ל-ALLOWED_ORIGIN בלבד + OPTIONS, אימות JWT (401 בלי token), תשובת JSON אחידה { ok, step, status, data | error:{code,message} }, ולקוח Supabase בשם המשתמש. ערכי step מותרים: רק השישה שב-ARCHITECTURE 4.3. step לא מוכר מחזיר 400 ב-JSON. אין להוסיף ערכי step.
5. lib/baseline.js: טעינת קבצי ai/ ובדיקת SHA-256 מול BASELINE_MANIFEST.json. בדיקת יחידה ב-tests/.
6. index.html + js/config.js + js/supabase.js + js/auth.js: טופס כניסה (Supabase Auth מ-CDN בגרסה מקובעת), RTL, Heebo, משתני CSS לפי DESIGN 3. אחרי כניסה: קריאה ישירה ל-business_profile דרך supabase-js (RLS) והצגת שם העסק.
7. מדידה לשער 1א: מימוש מינימלי של step=upload ו-step=map לפי ARCHITECTURE 4.3–4.5 (Files API, המתנה ל-ACTIVE, Mapper V1.2 מ-ai/mapper-v1.2, סדר input document→text), עם רישום משך, tokens ועלות ב-ai_usage. בלי orchestration, בלי extract.

כללים: אל תערוך שום קובץ ב-ai/. אל תוסיף תלויות. אין סודות בקוד. אם משהו לא ברור או סותר — עצור ושאל.

בסוף: הרץ את בדיקות ה-Definition of Done של M1 מ-MILESTONES, ותן לי רשימה של מה שעבר, מה נכשל, ומה עליי לעשות ידנית (למשל להריץ את schema.sql ב-Supabase או להעלות את ה-PDF). אחרי שאריץ את המדידה, הצג את זמן הריצה של map מול שער 1א ועצור.
```

---

## מה מצפים לקבל בסוף M1

- [ ] התחברות לאתר החי עובדת. בלי כניסה אין נתונים.
- [ ] אחרי כניסה מוצג שם העסק הבדיוני. `step=upload` על מכרז מה-seed מחזיר JSON שנקרא מ-Supabase בשם המשתמש. בלי JWT מתקבל `401`.
- [ ] בדיקת ה-hash של `ai/` עוברת.
- [ ] **שער 1א:** קריאת `map` על המכרז בן 171 העמודים רצה ב-Background מתוך Vercel: שליחה, בדיקה חוזרת וקבלת פלט מלא. זמן הריצה נרשם. אם Background לא עובד, עוצרים (MILESTONES שער 1א).
