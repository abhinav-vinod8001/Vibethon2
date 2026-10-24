-- JobSathi: initial Supabase/PostgreSQL schema.
-- Run ONCE in a fresh Supabase project's SQL Editor as the project administrator.
-- Supabase already provides the database, auth.users, auth.uid(), and API roles.
-- This migration deliberately fails if these application tables already exist.
-- It creates no demo accounts and does not migrate the old SQLite database.
begin;

create schema jobsathi_private;
revoke all on schema jobsathi_private from public, anon, authenticated;
grant usage on schema jobsathi_private to authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  location text not null check (char_length(btrim(location)) between 2 and 100),
  target_role text not null check (char_length(btrim(target_role)) between 2 and 120),
  language text not null default 'Malayalam' check (char_length(language) <= 50),
  experience text not null check (char_length(btrim(experience)) between 10 and 6000),
  skills text not null default '' check (char_length(skills) <= 2000),
  availability text not null default '' check (char_length(availability) <= 500),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  company text not null check (char_length(btrim(company)) between 2 and 120),
  location text not null check (char_length(btrim(location)) between 2 and 100),
  category text not null default 'Other' check (char_length(category) <= 50),
  type text not null check (type in ('Full-time', 'Part-time', 'Contract')),
  salary_min integer check (salary_min between 0 and 10000000),
  salary_max integer check (salary_max between 0 and 10000000),
  description text not null check (char_length(btrim(description)) between 20 and 6000),
  requirements text not null check (char_length(btrim(requirements)) between 10 and 3000),
  shift text not null check (char_length(btrim(shift)) between 2 and 100),
  deadline date,
  status text not null default 'active' check (status in ('active', 'closed')),
  version integer not null default 1 check (version > 0),
  -- JSON preserves the current application's embedding representation.
  -- A pgvector index and trusted embedding-generation workflow are later work.
  embedding jsonb,
  embedding_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_salary_range check (salary_min is null or salary_max is null or salary_max >= salary_min),
  constraint jobs_embedding_pair check ((embedding is null) = (embedding_model is null)),
  constraint jobs_embedding_array check (
    embedding is null or (
      jsonb_typeof(embedding) = 'array'
      and not jsonb_path_exists(embedding, '$[*] ? (@.type() != "number")')
    )
  )
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  candidate_id uuid not null references auth.users(id) on delete restrict,
  -- Immutable copy of the confirmed profile at application time.
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  job_version integer not null check (job_version > 0),
  status text not null default 'submitted'
    check (status in ('submitted', 'shortlisted', 'contacted', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_candidate_job unique (job_id, candidate_id)
);

create index jobs_owner_created_idx on public.jobs(owner_id, created_at desc);
create index jobs_active_created_idx on public.jobs(created_at desc) where status = 'active';
create index applications_candidate_created_idx on public.applications(candidate_id, created_at desc);
create index applications_job_created_idx on public.applications(job_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

-- Narrow helpers avoid recursive jobs <-> applications RLS policy evaluation.
-- The caller cannot supply another user's identity.
create function jobsathi_private.owns_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id and j.owner_id = (select auth.uid())
  );
$$;

create function jobsathi_private.applied_to_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.applications a
    where a.job_id = p_job_id and a.candidate_id = (select auth.uid())
  );
$$;

revoke all on function jobsathi_private.owns_job(uuid) from public, anon, authenticated;
revoke all on function jobsathi_private.applied_to_job(uuid) from public, anon, authenticated;
grant execute on function jobsathi_private.owns_job(uuid) to authenticated;
grant execute on function jobsathi_private.applied_to_job(uuid) to authenticated;

create policy profiles_read_own on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy jobs_read_open on public.jobs for select to anon, authenticated
  using (status = 'active' and (deadline is null or deadline >= (now() at time zone 'UTC')::date));

create policy jobs_read_related on public.jobs for select to authenticated
  using (owner_id = (select auth.uid()) or jobsathi_private.applied_to_job(id));

create policy applications_read_related on public.applications for select to authenticated
  using (candidate_id = (select auth.uid()) or jobsathi_private.owns_job(job_id));

-- API users can read under RLS, but all writes use the checked RPCs below.
-- This prevents direct API requests from fabricating profile snapshots or status.
revoke all on table public.profiles, public.jobs, public.applications from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.jobs to anon, authenticated;
grant select on table public.profiles, public.applications to authenticated;

create function public.save_profile(p_profile jsonb, p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_confirmed is distinct from true then
    raise exception 'Review and confirm your profile first.' using errcode = '22023';
  end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception 'A profile object is required.' using errcode = '22023';
  end if;

  insert into public.profiles(user_id, name, location, target_role, language, experience, skills, availability)
  values (
    v_user, btrim(p_profile->>'name'), btrim(p_profile->>'location'),
    btrim(p_profile->>'targetRole'), coalesce(p_profile->>'language', 'Malayalam'),
    btrim(p_profile->>'experience'), btrim(coalesce(p_profile->>'skills', '')),
    btrim(coalesce(p_profile->>'availability', ''))
  )
  on conflict (user_id) do update set
    name = excluded.name, location = excluded.location, target_role = excluded.target_role,
    language = excluded.language, experience = excluded.experience,
    skills = excluded.skills, availability = excluded.availability, updated_at = now()
  returning * into v_profile;
  return to_jsonb(v_profile);
end;
$$;

create function public.create_job(p_job jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_deadline date;
  v_job public.jobs%rowtype;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_job is null or jsonb_typeof(p_job) <> 'object' then
    raise exception 'A job object is required.' using errcode = '22023';
  end if;
  v_deadline := nullif(p_job->>'deadline', '')::date;
  if v_deadline is not null and v_deadline < (now() at time zone 'UTC')::date then
    raise exception 'The deadline must be today or later.' using errcode = '22023';
  end if;

  insert into public.jobs(owner_id, title, company, location, category, type,
    salary_min, salary_max, description, requirements, shift, deadline)
  values (
    v_user, btrim(p_job->>'title'), btrim(p_job->>'company'), btrim(p_job->>'location'),
    coalesce(p_job->>'category', 'Other'), p_job->>'type',
    (p_job->>'salaryMin')::integer, (p_job->>'salaryMax')::integer,
    btrim(p_job->>'description'), btrim(p_job->>'requirements'),
    btrim(p_job->>'shift'), v_deadline
  ) returning * into v_job;
  return to_jsonb(v_job);
end;
$$;

create function public.set_job_status(p_job_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_job public.jobs%rowtype;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('active', 'closed') then
    raise exception 'Invalid job status.' using errcode = '22023';
  end if;
  update public.jobs set status = p_status, version = version + 1, updated_at = now()
  where id = p_job_id and owner_id = v_user returning * into v_job;
  if not found then raise exception 'Job not found in your workspace.' using errcode = 'P0002'; end if;
  return to_jsonb(v_job);
end;
$$;

create function public.submit_application(p_job_id uuid, p_version integer, p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_profile public.profiles%rowtype;
  v_application public.applications%rowtype;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_confirmed is distinct from true or p_version is null or p_version < 1 then
    raise exception 'Confirm the application and provide the job version.' using errcode = '22023';
  end if;

  -- A concurrent close/version update must wait until this submission commits.
  select * into v_job from public.jobs where id = p_job_id for share;
  if not found then raise exception 'Job not found.' using errcode = 'P0002'; end if;
  if v_job.status <> 'active' or v_job.version <> p_version
     or (v_job.deadline is not null and v_job.deadline < (now() at time zone 'UTC')::date) then
    raise exception 'This job changed, closed, or expired. Refresh before applying.' using errcode = '40001';
  end if;

  select * into v_profile from public.profiles where user_id = v_user;
  if not found then
    raise exception 'Save a confirmed profile before applying.' using errcode = '22023';
  end if;

  insert into public.applications(job_id, candidate_id, job_version, snapshot)
  values (p_job_id, v_user, v_job.version, jsonb_build_object(
    'name', v_profile.name, 'location', v_profile.location, 'targetRole', v_profile.target_role,
    'language', v_profile.language, 'experience', v_profile.experience,
    'skills', v_profile.skills, 'availability', v_profile.availability
  )) returning * into v_application;
  -- UNIQUE(job_id, candidate_id) rejects simultaneous duplicate submissions too.
  return to_jsonb(v_application);
end;
$$;

create function public.set_application_status(p_application_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_application public.applications%rowtype;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('shortlisted', 'contacted', 'withdrawn') then
    raise exception 'Invalid application status.' using errcode = '22023';
  end if;
  select * into v_application from public.applications where id = p_application_id for update;
  if not found then raise exception 'Application unavailable.' using errcode = '42501'; end if;
  select owner_id into v_owner from public.jobs where id = v_application.job_id;
  if (p_status = 'withdrawn' and v_application.candidate_id <> v_user)
     or (p_status <> 'withdrawn' and v_owner <> v_user) then
    raise exception 'Application unavailable.' using errcode = '42501';
  end if;
  if v_application.status = 'withdrawn' then
    raise exception 'A withdrawn application cannot be changed.' using errcode = '22023';
  end if;
  update public.applications set status = p_status, updated_at = now()
  where id = p_application_id returning * into v_application;
  return to_jsonb(v_application);
end;
$$;

-- Functions are executable by PUBLIC by default: restrict every new RPC explicitly.
revoke all on function public.save_profile(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.create_job(jsonb) from public, anon, authenticated;
revoke all on function public.set_job_status(uuid, text) from public, anon, authenticated;
revoke all on function public.submit_application(uuid, integer, boolean) from public, anon, authenticated;
revoke all on function public.set_application_status(uuid, text) from public, anon, authenticated;
grant execute on function public.save_profile(jsonb, boolean) to authenticated;
grant execute on function public.create_job(jsonb) to authenticated;
grant execute on function public.set_job_status(uuid, text) to authenticated;
grant execute on function public.submit_application(uuid, integer, boolean) to authenticated;
grant execute on function public.set_application_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
