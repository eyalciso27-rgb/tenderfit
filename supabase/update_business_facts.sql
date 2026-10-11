-- Run this in Supabase SQL Editor to populate/update business_facts
-- with all 31 canonical facts with Hebrew titles, descriptions and fictitious data.

do $$
declare
  target_user_id uuid;
begin
  select user_id into target_user_id
  from public.business_profile
  order by created_at
  limit 1;

  if target_user_id is null then
    select id into target_user_id
    from auth.users
    order by created_at
    limit 1;
  end if;

  if target_user_id is null then
    raise exception 'No user found in auth.users or business_profile';
  end if;

  insert into public.business_profile (
    user_id,
    legal_name,
    company_number,
    contact_name,
    phone,
    email,
    business_facts
  ) values (
    target_user_id,
    'אורן פתרונות דיגיטליים בע״מ',
    '515151515',
    'נועה כהן',
    '03-5550100',
    'demo@example.com',
    jsonb_build_object(
      'bidder_system_relationship', jsonb_build_object(
        'title_he', 'זיקת המציע למערכת המוצעת',
        'description_he', 'האם המציע הוא יצרן המערכת או ספק מורשה בישראל',
        'business_fact_type', 'enum',
        'unit', null,
        'value', 'authorized_supplier',
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'systems_installed_since_2023_count', jsonb_build_object(
        'title_he', 'מספר מערכות שהותקנו מאז 2023',
        'description_he', 'מספר מערכות מהסוג המוצע שסופקו והוקמו מאז 1.1.2023',
        'business_fact_type', 'number',
        'unit', 'systems',
        'value', 8,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'qualifying_active_clients_count', jsonb_build_object(
        'title_he', 'מספר לקוחות פעילים שעומדים בסף',
        'description_he', 'מספר לקוחות פעילים שכל אחד עומד בספי נפח המסרים והדיוור שנקבעו',
        'business_fact_type', 'number',
        'unit', 'clients',
        'value', 6,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'simultaneous_sms_throughput', jsonb_build_object(
        'title_he', 'קצב הפצת SMS בו-זמנית',
        'description_he', 'יכולת תעבורה בו-זמנית של מסרוני SMS',
        'business_fact_type', 'number',
        'unit', 'SMS',
        'value', 1500,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_sms_all_israel_and_international_carriers', jsonb_build_object(
        'title_he', 'תמיכה בכל מפעילי הסלולר בארץ ובחו״ל',
        'description_he', 'ממשק למשלוח SMS בישראל ובחו"ל מול ספקי התקשורת הרלוונטיים',
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'registered_entity_in_israel', jsonb_build_object(
        'title_he', 'תאגיד רשום בישראל כדין',
        'description_he', 'המציע הוא תאגיד רשום בישראל כדין',
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array('israeli_registered_entity'),
        'source', 'user',
        'updated_at', now()
      ),
      'required_legal_licenses_valid', jsonb_build_object(
        'title_he', 'תוקף רישיונות והיתרים לפי דין',
        'description_he', 'כל הרישיונות/ההיתרים/ההרשאות הנדרשים לפי דין תקפים',
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'public_entities_transactions_compliant', jsonb_build_object(
        'title_he', 'עמידה בחוק עסקאות גופים ציבוריים',
        'description_he', 'עמידה בדרישות חוק עסקאות גופים ציבוריים',
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'going_concern_warning_absent', jsonb_build_object(
        'title_he', 'היעדר הערת עסק חי בדוחות כספיים',
        'description_he', 'אין אזהרת עסק חי בדוחות הכספיים המבוקרים לשתי שנות המס האחרונות',
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'maximum_supported_attachment_size_mb', jsonb_build_object(
        'title_he', 'גודל קובץ מצורף מרבי',
        'description_he', 'גודל קובץ מצורף מרבי שנתמך',
        'business_fact_type', 'number',
        'unit', 'MB',
        'value', 25,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_monthly_and_yearly_reports', jsonb_build_object(
        'title_he', 'הפקת דוחות חודשיים ושנתיים',
        'description_he', 'הפקת דוחות חודשיים ושנתיים',
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_adaptive_sms_length_per_operator', jsonb_build_object(
        'title_he', 'התאמת אורך SMS לפי מפעיל',
        'description_he', 'התאמת אורך SMS לכל מפעיל סלולרי',
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_text_to_voice_conversion_kosher_phones', jsonb_build_object(
        'title_he', 'המרת טקסט לקול לטלפונים כשרים',
        'description_he', 'המרת הודעת טקסט להודעה קולית והפצה לטלפונים כשרים לפי ניסוח המקור',
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_continuous_chat', jsonb_build_object(
        'title_he', 'ניהול שיח מתמשך ב-WhatsApp',
        'description_he', 'ניהול שיח מתמשך עם הנמען בערוץ WhatsApp',
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_smtp_interface', jsonb_build_object(
        'title_he', 'תמיכה בממשק SMTP',
        'description_he', 'תמיכה בממשק SMTP להפצת הודעות',
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_api_rest_ws_soap', jsonb_build_object(
        'title_he', 'ממשקי API (REST/SOAP/WS)',
        'description_he', 'API התומך REST/WS/SOAP לפי דרישות המכרז',
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'food_service_avg_daily_diners_experience', jsonb_build_object(
        'title_he', 'ממוצע סועדים יומי בניסיון בהסעדה',
        'description_he', 'היקף סועדים יומי ממוצע בניסיון בהפעלת מערך הסעדה',
        'business_fact_type', 'number',
        'unit', 'diners',
        'value', 700,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'food_service_experience_start_date', jsonb_build_object(
        'title_he', 'מועד תחילת ניסיון בהפעלת הסעדה',
        'description_he', 'מועד תחילת ניסיון רלוונטי בהפעלת מערכי הסעדה לצורך ניקוד איכות',
        'business_fact_type', 'date',
        'unit', null,
        'value', '2019-01-01',
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'simultaneous_food_service_sites_count', jsonb_build_object(
        'title_he', 'מספר אתרי הסעדה בו-זמנית',
        'description_he', 'מספר אתרי הסעדה שהופעלו בו-זמנית בתקופה הרלוונטית',
        'business_fact_type', 'number',
        'unit', 'sites',
        'value', 3,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'simultaneous_food_service_total_daily_diners', jsonb_build_object(
        'title_he', 'סה״כ סועדים יומיים באתרים בו-זמנית',
        'description_he', 'היקף סועדים יומי מצטבר באתרים שהופעלו בו-זמנית',
        'business_fact_type', 'number',
        'unit', 'diners',
        'value', 1400,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'food_service_reference_clients_count', jsonb_build_object(
        'title_he', 'מספר לקוחות ממליצים להסעדה',
        'description_he', 'מספר לקוחות ממליצים רלוונטיים לשירותי הסעדה',
        'business_fact_type', 'number',
        'unit', 'clients',
        'value', 5,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'dairy_kitchen_daily_diners', jsonb_build_object(
        'title_he', 'סועדים יומיים במטבח חלבי',
        'description_he', 'היקף סועדים יומי בניסיון בהפעלת מטבח חלבי',
        'business_fact_type', 'number',
        'unit', 'diners',
        'value', 450,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'dairy_kitchen_experience_years', jsonb_build_object(
        'title_he', 'שנות ניסיון במטבח חלבי',
        'description_he', 'מספר שנות ניסיון בהפעלת מטבח חלבי',
        'business_fact_type', 'number',
        'unit', 'years',
        'value', 6,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'refreshment_services_annual_value', jsonb_build_object(
        'title_he', 'היקף שנתי של שירותי כיבוד',
        'description_he', 'היקף שנתי של שירותי כיבוד ללשכות וחדרי דיונים באתר אחד',
        'business_fact_type', 'currency',
        'unit', 'ILS',
        'value', 400000,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'head_chef_professional_profile', jsonb_build_object(
        'title_he', 'פרופיל מקצועי של שף ראשי',
        'description_he', 'ניסיון, מקצועיות ורקע של השף/טבח הראשי המוצע',
        'business_fact_type', 'string',
        'unit', null,
        'value', 'שף ראשי בעל 12 שנות ניסיון בהפעלת מטבחים מוסדיים ותעודת מקצוע סוג 5',
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'operations_manager_professional_profile', jsonb_build_object(
        'title_he', 'פרופיל מקצועי של מנהל תפעול',
        'description_he', 'ניסיון מקצועי של המנהל התפעולי בתחומי תברואה, בטיחות מזון, תפעול צוותים וחומרי גלם',
        'business_fact_type', 'string',
        'unit', null,
        'value', 'מנהל תפעול בעל תואר ראשון ו-9 שנות ניסיון בניהול בטיחות מזון, תברואה ותפעול אתרי הסעדה',
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'valid_kosher_certificate', jsonb_build_object(
        'title_he', 'תעודת כשרות תקפה מהרבנות הראשית',
        'description_he', 'תעודת כשרות תקפה מטעם הרבנות הראשית',
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'valid_food_service_licenses', jsonb_build_object(
        'title_he', 'רישיונות תקפים להסעדה ומכירת מזון',
        'description_he', 'קיומם של רישיונות תקפים רלוונטיים לאספקת שירותי הסעדה ומכירת מזון',
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'labor_law_convictions_last_3_years', jsonb_build_object(
        'title_he', 'הרשעות בדיני עבודה (3 שנים אחרונות)',
        'description_he', 'מספר הרשעות רלוונטיות בהפרת דיני עבודה בשלוש השנים האחרונות',
        'business_fact_type', 'number',
        'unit', 'convictions',
        'value', 0,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'labor_law_financial_sanctions_last_3_years', jsonb_build_object(
        'title_he', 'עיצומים כספיים בדיני עבודה (3 שנים אחרונות)',
        'description_he', 'מספר עיצומים כספיים רלוונטיים בשל הפרות דיני עבודה בשלוש השנים האחרונות',
        'business_fact_type', 'number',
        'unit', 'sanctions',
        'value', 0,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'labor_law_fines_last_year', jsonb_build_object(
        'title_he', 'קנסות בדיני עבודה (שנה אחרונה)',
        'description_he', 'מספר קנסות רלוונטיים בשנה האחרונה',
        'business_fact_type', 'number',
        'unit', 'fines',
        'value', 0,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      )
    )
  )
  on conflict (user_id) do update set
    business_facts = excluded.business_facts,
    updated_at = now();
end $$;
