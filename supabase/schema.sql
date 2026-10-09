-- TenderFit M1 schema. Run once in the Supabase SQL editor.

create table if not exists public.tenders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'מכרז ללא שם',
  tender_number text,
  publisher text,
  submission_deadline timestamptz,
  pdf_path text not null,
  pdf_hash text not null,
  gemini_file jsonb not null default '{}'::jsonb,
  processing jsonb not null default '{"steps":{},"regions":{}}'::jsonb,
  regions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  region_outputs jsonb not null default '{}'::jsonb,
  requirements jsonb not null default '[]'::jsonb,
  dedup_log jsonb not null default '[]'::jsonb,
  results jsonb not null default '{}'::jsonb,
  fit_analysis jsonb,
  checklist jsonb,
  ai_usage jsonb not null default '[]'::jsonb,
  decision text check (decision in ('go', 'no_go')),
  decision_updated_at timestamptz,
  analysis_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  legal_name text not null default '',
  company_number text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  business_facts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_error_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  requirement_id text not null,
  ai_result jsonb not null,
  user_explanation text not null,
  status text not null default 'new' check (status in ('new', 'in_review', 'resolved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.tenders enable row level security;
alter table public.business_profile enable row level security;
alter table public.ai_error_reports enable row level security;

drop policy if exists "tenders_select_own" on public.tenders;
create policy "tenders_select_own"
  on public.tenders for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "tenders_insert_own" on public.tenders;
create policy "tenders_insert_own"
  on public.tenders for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "tenders_update_own" on public.tenders;
create policy "tenders_update_own"
  on public.tenders for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "business_profile_select_own" on public.business_profile;
create policy "business_profile_select_own"
  on public.business_profile for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "business_profile_insert_own" on public.business_profile;
create policy "business_profile_insert_own"
  on public.business_profile for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "business_profile_update_own" on public.business_profile;
create policy "business_profile_update_own"
  on public.business_profile for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "ai_error_reports_select_own" on public.ai_error_reports;
create policy "ai_error_reports_select_own"
  on public.ai_error_reports for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "ai_error_reports_insert_own" on public.ai_error_reports;
create policy "ai_error_reports_insert_own"
  on public.ai_error_reports for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "ai_error_reports_update_own" on public.ai_error_reports;
create policy "ai_error_reports_update_own"
  on public.ai_error_reports for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tender-pdfs', 'tender-pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tender_pdfs_select_own" on storage.objects;
create policy "tender_pdfs_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tender-pdfs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "tender_pdfs_insert_own" on storage.objects;
create policy "tender_pdfs_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tender-pdfs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "tender_pdfs_update_own" on storage.objects;
create policy "tender_pdfs_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'tender-pdfs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'tender-pdfs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Intentionally no DELETE policy in the MVP.
