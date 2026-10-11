# F32 — תזכורות יומיות

הקובץ `f32-reminders.workflow.json` הוא Workflow לא פעיל לייבוא אל n8n.

לפני הפעלה:

1. מחברים Supabase Credential עם Secret key ו-Gmail Credential של הסטודנט.
2. מחליפים `CHANGE_TO_APPROVED_TEST_EMAIL@example.com` בכתובת בדיקה מאושרת.
3. מחליפים בקוד ה-Workflow את `https://CHANGE-ME.github.io/tenderfit` בכתובת האתר.
4. מריצים ידנית עם נתוני בדיקה ורק אז מפעילים את ה-Schedule היומי.

ה-Workflow שולח מייל על מכרזי Go שמועד ההגשה שלהם בתוך שבעה ימים ועל סעיפים שמענה הלקוח שלהם הוא `review` ותאריך היעד הגיע. סעיף ללא תאריך אינו שולח מייל. אחרי שליחת תזכורת לסעיף מתעדכן `reminder_sent_at`, כדי שלא תישלח שוב לאותו יעד.

אין בקובץ Credentials, כתובת אמיתית או Secret.
