-- Run this in Supabase SQL Editor to populate/update business_facts
-- with all 31 canonical facts for the current/first user without affecting tenders.

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
    business_facts = excluded.business_facts,
    updated_at = now();
end $$;
