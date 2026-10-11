-- Run after schema.sql and after creating the single Auth user manually.
-- The first tender is the M1 measurement row. Upload tender 20/2026 to its
-- exact pdf_path in the private tender-pdfs bucket before testing step=upload.

do $$
declare
  demo_user_id uuid;
begin
  select id into demo_user_id
  from auth.users
  order by created_at
  limit 1;

  if demo_user_id is null then
    raise exception 'Create the manual Supabase Auth user before running seed.sql';
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
    demo_user_id,
    'אורן פתרונות דיגיטליים בע״מ',
    '515151515',
    'נועה כהן',
    '03-5550100',
    'demo@example.com',
    jsonb_build_object(
      'bidder_system_relationship', jsonb_build_object(
        'business_fact_type', 'enum',
        'unit', null,
        'value', 'authorized_supplier',
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'systems_installed_since_2023_count', jsonb_build_object(
        'business_fact_type', 'number',
        'unit', 'systems',
        'value', 8,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'qualifying_active_clients_count', jsonb_build_object(
        'business_fact_type', 'number',
        'unit', 'clients',
        'value', 6,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'simultaneous_sms_throughput', jsonb_build_object(
        'business_fact_type', 'number',
        'unit', 'SMS',
        'value', 1500,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_sms_all_israel_and_international_carriers', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'registered_entity_in_israel', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array('israeli_registered_entity'),
        'source', 'user',
        'updated_at', now()
      ),
      'required_legal_licenses_valid', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'public_entities_transactions_compliant', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'going_concern_warning_absent', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'maximum_supported_attachment_size_mb', jsonb_build_object(
        'business_fact_type', 'number',
        'unit', 'MB',
        'value', 25,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_monthly_and_yearly_reports', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_adaptive_sms_length_per_operator', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_text_to_voice_conversion_kosher_phones', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_continuous_chat', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_smtp_interface', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'supports_api_rest_ws_soap', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'food_service_avg_daily_diners_experience', jsonb_build_object(
        'business_fact_type', 'number',
        'unit', 'diners',
        'value', 700,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'food_service_experience_start_date', jsonb_build_object(
        'business_fact_type', 'date',
        'unit', null,
        'value', '2019-01-01',
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'simultaneous_food_service_sites_count', jsonb_build_object(
        'business_fact_type', 'number',
        'unit', 'sites',
        'value', 3,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'simultaneous_food_service_total_daily_diners', jsonb_build_object(
        'business_fact_type', 'number',
        'unit', 'diners',
        'value', 1400,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'food_service_reference_clients_count', jsonb_build_object(
        'business_fact_type', 'number',
        'unit', 'clients',
        'value', 5,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'dairy_kitchen_daily_diners', jsonb_build_object(
        'business_fact_type', 'number',
        'unit', 'diners',
        'value', 450,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'dairy_kitchen_experience_years', jsonb_build_object(
        'business_fact_type', 'number',
        'unit', 'years',
        'value', 6,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'refreshment_services_annual_value', jsonb_build_object(
        'business_fact_type', 'currency',
        'unit', 'ILS',
        'value', 400000,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'head_chef_professional_profile', jsonb_build_object(
        'business_fact_type', 'string',
        'unit', null,
        'value', 'שף ראשי בעל 12 שנות ניסיון בהפעלת מטבחים מוסדיים ותעודת מקצוע סוג 5',
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'operations_manager_professional_profile', jsonb_build_object(
        'business_fact_type', 'string',
        'unit', null,
        'value', 'מנהל תפעול בעל תואר ראשון ו-9 שנות ניסיון בניהול בטיחות מזון, תברואה ותפעול אתרי הסעדה',
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'valid_kosher_certificate', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'valid_food_service_licenses', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'labor_law_convictions_last_3_years', jsonb_build_object(
        'business_fact_type', 'number',
        'unit', 'convictions',
        'value', 0,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'labor_law_financial_sanctions_last_3_years', jsonb_build_object(
        'business_fact_type', 'number',
        'unit', 'sanctions',
        'value', 0,
        'status', 'known',
        'aliases', jsonb_build_array(),
        'source', 'user',
        'updated_at', now()
      ),
      'labor_law_fines_last_year', jsonb_build_object(
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
    legal_name = excluded.legal_name,
    company_number = excluded.company_number,
    contact_name = excluded.contact_name,
    phone = excluded.phone,
    email = excluded.email,
    business_facts = excluded.business_facts,
    updated_at = now();

  insert into public.tenders (
    id, user_id, title, tender_number, publisher, submission_deadline,
    pdf_path, pdf_hash, processing
  ) values
    (
      '10000000-0000-4000-8000-000000000001',
      demo_user_id,
      'מכרז פומבי 20/2026 — שירותי הסעדה',
      '20/2026',
      'משרד החוץ',
      '2027-03-01T10:00:00+02:00',
      demo_user_id::text || '/10000000-0000-4000-8000-000000000001.pdf',
      repeat('0', 64),
      '{"steps":{"upload":{"status":"pending","attempts":0,"error":null},"map":{"status":"pending","attempts":0,"error":null}},"regions":{}}'::jsonb
    ),
    (
      '10000000-0000-4000-8000-000000000002',
      demo_user_id,
      'מכרז פומבי 2/2025 — מערכת הפצת מסרים',
      '2/2025',
      'מערך הדיגיטל הלאומי',
      '2027-04-15T12:00:00+03:00',
      demo_user_id::text || '/10000000-0000-4000-8000-000000000002.pdf',
      repeat('1', 64),
      '{"steps":{},"regions":{}}'::jsonb
    ),
    (
      '10000000-0000-4000-8000-000000000003',
      demo_user_id,
      'שירותי אחזקה למבני ציבור',
      '11/2026',
      'עיריית תל אביב–יפו',
      '2027-05-02T14:00:00+03:00',
      demo_user_id::text || '/10000000-0000-4000-8000-000000000003.pdf',
      repeat('2', 64),
      '{"steps":{},"regions":{}}'::jsonb
    ),
    (
      '10000000-0000-4000-8000-000000000004',
      demo_user_id,
      'אספקת ציוד מחשוב',
      '33/2026',
      'משרד החינוך',
      '2027-05-20T09:00:00+03:00',
      demo_user_id::text || '/10000000-0000-4000-8000-000000000004.pdf',
      repeat('3', 64),
      '{"steps":{},"regions":{}}'::jsonb
    ),
    (
      '10000000-0000-4000-8000-000000000005',
      demo_user_id,
      'ייעוץ ארגוני וליווי פרויקטים',
      '7/2026',
      'חברה ממשלתית לדוגמה',
      null,
      demo_user_id::text || '/10000000-0000-4000-8000-000000000005.pdf',
      repeat('4', 64),
      '{"steps":{},"regions":{}}'::jsonb
    )
  on conflict (id) do update set
    user_id = excluded.user_id,
    title = excluded.title,
    tender_number = excluded.tender_number,
    publisher = excluded.publisher,
    submission_deadline = excluded.submission_deadline,
    pdf_path = excluded.pdf_path,
    pdf_hash = excluded.pdf_hash,
    updated_at = now();
end $$;
