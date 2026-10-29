-- The Marching Archives: community correction submissions (Phase 4)
-- Review this migration and back up your database before running it.
begin;

create table if not exists public.archive_correction_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind text not null check (kind in ('correction','missing_result','other')),
  subject text not null check (char_length(subject) between 5 and 180),
  record_url text,
  season_year integer check (season_year between 1800 and 2200),
  details text not null check (char_length(details) between 20 and 5000),
  evidence_url text,
  contact_email text not null check (char_length(contact_email) between 5 and 254),
  status text not null default 'new' check (status in ('new','reviewing','resolved','dismissed')),
  staff_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz
);

create index if not exists archive_corrections_created_idx on public.archive_correction_submissions(created_at desc);
create index if not exists archive_corrections_status_idx on public.archive_correction_submissions(status, created_at desc);
create index if not exists archive_corrections_email_idx on public.archive_correction_submissions(lower(contact_email), created_at desc);

alter table public.archive_correction_submissions enable row level security;
revoke all on public.archive_correction_submissions from anon, authenticated;
grant select, update on public.archive_correction_submissions to authenticated;

-- Only active archive staff may read submissions or edit their review state.
create policy archive_corrections_staff_read on public.archive_correction_submissions
  for select to authenticated using (public.tma_can_manage());
create policy archive_corrections_staff_update on public.archive_correction_submissions
  for update to authenticated using (public.tma_can_manage())
  with check (public.tma_can_manage());

-- Anonymous visitors can ONLY insert through this narrow validated RPC.
-- The honeypot and per-email quota deter basic spam, but are not comprehensive bot protection.
create or replace function public.submit_archive_correction(
  p_kind text, p_subject text, p_record_url text,
  p_season_year integer, p_details text, p_evidence_url text,
  p_contact_email text, p_website text default ''
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_email text := lower(trim(p_contact_email));
begin
  if coalesce(trim(p_website), '') <> '' then
    raise exception 'Submission could not be accepted';
  end if;
  if p_kind not in ('correction','missing_result','other')
     or char_length(trim(coalesce(p_subject,''))) not between 5 and 180
     or char_length(trim(coalesce(p_details,''))) not between 20 and 5000
     or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or char_length(v_email) > 254
     or (p_season_year is not null and p_season_year not between 1800 and 2200)
  then raise exception 'Invalid submission fields'; end if;
  if coalesce(trim(p_record_url),'') <> '' and
     (char_length(p_record_url) > 2000 or p_record_url !~* '^https?://[^[:space:]]+$') then
    raise exception 'Record URL must begin with http:// or https://';
  end if;
  if coalesce(trim(p_evidence_url),'') <> '' and
     (char_length(p_evidence_url) > 2000 or p_evidence_url !~* '^https?://[^[:space:]]+$') then
    raise exception 'Evidence URL must begin with http:// or https://';
  end if;
  -- Serializes requests for the same email to make the quota atomic.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_email));
  if (select count(*) from public.archive_correction_submissions
      where lower(contact_email) = v_email and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Submission limit reached for this contact. Try again tomorrow.';
  end if;
  insert into public.archive_correction_submissions
    (kind, subject, record_url, season_year, details, evidence_url, contact_email)
  values (p_kind, trim(p_subject), nullif(trim(coalesce(p_record_url,'')),''),
          p_season_year, trim(p_details), nullif(trim(coalesce(p_evidence_url,'')),''), v_email)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_archive_correction(text,text,text,integer,text,text,text,text) from public;
grant execute on function public.submit_archive_correction(text,text,text,integer,text,text,text,text) to anon, authenticated;
commit;
