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
      'registered_entity_in_israel', jsonb_build_object(
        'business_fact_type', 'boolean',
        'unit', null,
        'value', true,
        'status', 'known',
        'aliases', jsonb_build_array('israeli_registered_entity'),
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
