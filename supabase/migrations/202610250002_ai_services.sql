-- API translation cache and durable, public-job-only vector retrieval.
-- Apply after 202610250001. No candidate data is copied into the vector index.
-- The privileged service_role is used only by trusted server routes; browser
-- clients can read enabled languages/translations and call checked retrieval.
begin;

create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table public.app_languages (
  code text primary key check (code ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$'),
  native_name text not null check (char_length(native_name) between 1 and 80),
  name text not null check (char_length(name) between 1 and 80),
  speech_code text not null check (char_length(speech_code) between 1 and 30),
  pdf_supported boolean not null default false,
  enabled boolean not null default true,
  sort_order integer not null default 0
);

insert into public.app_languages(code,native_name,name,speech_code,pdf_supported,sort_order) values
  ('en','English','English','en-IN',true,0),
  ('ml','മലയാളം','Malayalam','ml-IN',true,1),
  ('ta','தமிழ்','Tamil','ta-IN',true,2),
  ('hi','हिन्दी','Hindi','hi-IN',true,3),
  ('te','తెలుగు','Telugu','te-IN',true,4);

create table public.ui_translations (
  cache_key text primary key check (char_length(cache_key) between 1 and 256),
  locale text not null references public.app_languages(code) on delete cascade,
  source_hash text not null check (char_length(source_hash) between 1 and 128),
  model text not null check (char_length(model) between 1 and 128),
  prompt_version text not null check (char_length(prompt_version) between 1 and 80),
  messages jsonb not null check (
    jsonb_typeof(messages) = 'object' and octet_length(messages::text) <= 524288
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ui_translations_locale_source_idx on public.ui_translations(locale, source_hash);

create table public.job_embeddings (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  job_version integer not null check (job_version > 0),
  model text not null check (char_length(model) between 1 and 128),
  content_hash text not null check (char_length(content_hash) between 1 and 128),
  embedding extensions.vector(768) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_embeddings_cosine_idx on public.job_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);
create index job_embeddings_model_idx on public.job_embeddings(model);

alter table public.app_languages enable row level security;
alter table public.ui_translations enable row level security;
alter table public.job_embeddings enable row level security;
create policy languages_read_enabled on public.app_languages for select to anon, authenticated
  using (enabled);
create policy translations_read_enabled on public.ui_translations for select to anon, authenticated
  using (exists (select 1 from public.app_languages l where l.code = locale and l.enabled));

revoke all on table public.app_languages, public.ui_translations, public.job_embeddings
  from public, anon, authenticated;
grant select on table public.app_languages, public.ui_translations to anon, authenticated;
grant usage on schema extensions to authenticated, service_role;
grant select, insert, update, delete on table public.app_languages, public.ui_translations,
  public.job_embeddings to service_role;

-- These are deliberately outside the REST-exposed public schema. Keys are
-- content-addressed by the server, not client-supplied prompts or identities.
create table jobsathi_private.ai_work (
  work_key text primary key,
  bucket text not null,
  state text not null check (state in ('working','done','failed')),
  lease_until timestamptz,
  retry_after timestamptz,
  attempts integer not null default 1,
  updated_at timestamptz not null default now()
);
create table jobsathi_private.ai_daily_usage (
  bucket text not null,
  usage_date date not null,
  used integer not null check (used >= 0),
  primary key(bucket, usage_date)
);
revoke all on table jobsathi_private.ai_work, jobsathi_private.ai_daily_usage
  from public, anon, authenticated, service_role;

create function jobsathi_private.validated_embedding(p_embedding jsonb)
returns extensions.vector language plpgsql immutable set search_path = ''
as $$
begin
  if p_embedding is null or jsonb_typeof(p_embedding) <> 'array' then
    raise exception 'A numeric embedding array is required.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_embedding) <> 768 then
    raise exception 'Embedding must have 768 dimensions.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_embedding) e(value)
    where jsonb_typeof(value) <> 'number') then
    raise exception 'Embedding values must be finite numbers.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_embedding) e(value)
    where abs((value #>> '{}')::numeric) > 3.4028234663852886e38::numeric)
    or not exists (select 1 from jsonb_array_elements(p_embedding) e(value)
      where abs((value #>> '{}')::numeric) >= 1.17549435e-38::numeric) then
    raise exception 'Embedding must be finite and nonzero.' using errcode = '22023';
  end if;
  return p_embedding::text::extensions.vector(768);
end;
$$;
revoke all on function jobsathi_private.validated_embedding(jsonb)
  from public, anon, authenticated, service_role;

create function public.store_job_embedding(
  p_job_id uuid, p_version integer, p_model text, p_content_hash text, p_embedding jsonb
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_embedding extensions.vector(768);
begin
  if p_model is null or char_length(btrim(p_model)) not between 1 and 128
    or p_content_hash is null or char_length(p_content_hash) not between 1 and 128 then
    raise exception 'A model and content hash are required.' using errcode = '22023';
  end if;
  -- The shared row lock makes a concurrent close/version update wait until
  -- this insert completes; its invalidation trigger will then delete it.
  select * into v_job from public.jobs where id = p_job_id for share;
  if not found or v_job.version is distinct from p_version or v_job.status <> 'active'
    or (v_job.deadline is not null and v_job.deadline < (now() at time zone 'UTC')::date) then
    return false;
  end if;
  v_embedding := jobsathi_private.validated_embedding(p_embedding);
  insert into public.job_embeddings(job_id,job_version,model,content_hash,embedding)
  values (p_job_id,p_version,p_model,p_content_hash,v_embedding)
  on conflict(job_id) do update set job_version=excluded.job_version, model=excluded.model,
    content_hash=excluded.content_hash, embedding=excluded.embedding, updated_at=now();
  return true;
end;
$$;

create function public.match_job_embeddings(
  p_embedding jsonb, p_model text, p_location text default '',
  p_category text default '', p_type text default '', p_limit integer default 5,
  p_min_similarity double precision default 0.25
) returns table(id uuid, similarity double precision, job_version integer)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_embedding extensions.vector(768);
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_model is null or char_length(btrim(p_model)) not between 1 and 128
    or p_min_similarity is null or p_min_similarity < -1 or p_min_similarity > 1
    or p_min_similarity = 'NaN'::double precision then
    raise exception 'Invalid retrieval model or similarity threshold.' using errcode = '22023';
  end if;
  v_embedding := jobsathi_private.validated_embedding(p_embedding);
  return query
    select j.id, (1 - (e.embedding operator(extensions.<=>) v_embedding))::double precision, j.version
    from public.job_embeddings e join public.jobs j on j.id=e.job_id
    where e.model=p_model and e.job_version=j.version and j.status='active'
      and (j.deadline is null or j.deadline >= (now() at time zone 'UTC')::date)
      and (coalesce(p_location,'')='' or strpos(lower(j.location),lower(p_location)) > 0)
      and (coalesce(p_category,'')='' or j.category=p_category)
      and (coalesce(p_type,'')='' or j.type=p_type)
      and 1 - (e.embedding operator(extensions.<=>) v_embedding) >= p_min_similarity
    order by e.embedding operator(extensions.<=>) v_embedding, j.id
    limit greatest(1,least(coalesce(p_limit,5),20));
end;
$$;

create function jobsathi_private.invalidate_job_embedding()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.version is distinct from old.version or new.status <> 'active'
    or row(new.title,new.company,new.location,new.category,new.type,new.salary_min,new.salary_max,
      new.description,new.requirements,new.shift,new.deadline)
      is distinct from row(old.title,old.company,old.location,old.category,old.type,old.salary_min,old.salary_max,
      old.description,old.requirements,old.shift,old.deadline) then
    delete from public.job_embeddings where job_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function jobsathi_private.invalidate_job_embedding()
  from public, anon, authenticated, service_role;
create trigger jobs_invalidate_embedding after update on public.jobs
  for each row execute function jobsathi_private.invalidate_job_embedding();

create function public.claim_ai_work(
  p_key text, p_bucket text, p_daily_limit integer, p_lease_seconds integer default 120
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_work jobsathi_private.ai_work%rowtype;
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now at time zone 'UTC')::date;
  v_limit integer;
  v_used integer;
begin
  if p_key is null or char_length(p_key) not between 1 and 256 or p_daily_limit is null
    or p_daily_limit < 1 or p_bucket is null then
    raise exception 'Invalid AI work claim.' using errcode = '22023';
  end if;
  if p_bucket='translations' then v_limit:=least(p_daily_limit,30);
  elsif p_bucket='job_embeddings' then v_limit:=least(p_daily_limit,1000);
  elsif p_bucket ~ '^rag:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then v_limit:=least(p_daily_limit,30);
  else raise exception 'Unknown AI budget bucket.' using errcode = '22023'; end if;

  -- Serialize a key across all serverless instances, then atomically charge
  -- the bucket/date row. Failed/abandoned attempts still consume their call.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key,0));
  select * into v_work from jobsathi_private.ai_work where work_key=p_key;
  if found then
    if v_work.bucket <> p_bucket then
      raise exception 'Work key belongs to another budget bucket.' using errcode = '22023';
    end if;
    if v_work.state='done' or (v_work.state='working' and v_work.lease_until > v_now)
      or (v_work.state='failed' and v_work.retry_after > v_now) then return false; end if;
  end if;
  insert into jobsathi_private.ai_daily_usage(bucket,usage_date,used) values(p_bucket,v_day,0)
    on conflict(bucket,usage_date) do nothing;
  update jobsathi_private.ai_daily_usage set used=used+1
    where bucket=p_bucket and usage_date=v_day and used<v_limit returning used into v_used;
  if not found then return false; end if;
  insert into jobsathi_private.ai_work(work_key,bucket,state,lease_until)
    values(p_key,p_bucket,'working',v_now+make_interval(secs=>greatest(30,least(coalesce(p_lease_seconds,120),300))))
    on conflict(work_key) do update set state='working',lease_until=excluded.lease_until,
      retry_after=null,attempts=jobsathi_private.ai_work.attempts+1,updated_at=v_now;
  return true;
end;
$$;

create function public.finish_ai_work(p_key text,p_success boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update jobsathi_private.ai_work set state=case when p_success is true then 'done' else 'failed' end,
    lease_until=null,retry_after=case when p_success is true then null else clock_timestamp()+interval '15 minutes' end,
    updated_at=clock_timestamp()
    where work_key=p_key and state='working';
end;
$$;

revoke all on function public.store_job_embedding(uuid,integer,text,text,jsonb)
  from public, anon, authenticated;
revoke all on function public.match_job_embeddings(jsonb,text,text,text,text,integer,double precision)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_ai_work(text,text,integer,integer)
  from public, anon, authenticated;
revoke all on function public.finish_ai_work(text,boolean)
  from public, anon, authenticated;
grant execute on function public.store_job_embedding(uuid,integer,text,text,jsonb) to service_role;
grant execute on function public.match_job_embeddings(jsonb,text,text,text,text,integer,double precision) to authenticated;
grant execute on function public.claim_ai_work(text,text,integer,integer) to service_role;
grant execute on function public.finish_ai_work(text,boolean) to service_role;

notify pgrst, 'reload schema';
commit;
