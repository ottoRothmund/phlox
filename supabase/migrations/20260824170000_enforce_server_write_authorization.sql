-- Anonymous clients must not be able to call the write RPCs directly.
-- Phlox routes every write through its server, which validates the repository
-- against public GitHub and applies rate limits. The database now enforces that
-- by requiring a shared server secret that is never shipped to browsers.
--
-- This migration also stops exposing pseudonymous visitor_id values through the
-- public API: aggregate counts stay readable, individual votes do not.

create table if not exists public.phlox_write_secret (
  id boolean primary key default true check (id),
  secret text not null check (char_length(secret) >= 32)
);

alter table public.phlox_write_secret enable row level security;
revoke all on table public.phlox_write_secret from anon, authenticated;

create or replace function public.assert_phlox_write_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected text;
begin
  select s.secret into expected from public.phlox_write_secret as s where s.id;

  if expected is null then
    raise exception 'phlox write secret is not configured' using errcode = '28000';
  end if;

  -- Compare digests so the check does not leak the secret through timing.
  if p_secret is null
     or encode(extensions.digest(p_secret, 'sha256'), 'hex')
        is distinct from encode(extensions.digest(expected, 'sha256'), 'hex') then
    raise exception 'not authorized' using errcode = '28000';
  end if;
end;
$$;

revoke all on function public.assert_phlox_write_secret(text)
  from public, anon, authenticated;

-- Aggregates must remain public while the underlying votes become private, so the
-- totals view runs as its owner instead of the caller.
alter view public.repository_reaction_totals set (security_invoker = false);

drop policy if exists "repository reactions are publicly readable"
  on public.repository_reactions;
revoke all on table public.repository_reactions from anon, authenticated;
grant select on public.repository_reaction_totals to anon, authenticated;

-- Reviews stay publicly readable, minus the pseudonymous author id.
revoke all on table public.repository_reviews from anon, authenticated;
grant select (id, repo_full_name, display_name, kind, body, created_at)
  on public.repository_reviews to anon, authenticated;

create or replace function public.set_repository_reaction(
  p_repo_full_name text,
  p_visitor_id uuid,
  p_reaction text,
  p_secret text default null
)
returns table (
  repo_full_name text,
  likes bigint,
  dislikes bigint,
  current_reaction text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_repo text := lower(trim(p_repo_full_name));
begin
  perform public.assert_phlox_write_secret(p_secret);

  if char_length(normalized_repo) not between 3 and 201
    or normalized_repo !~ '^[^/[:space:]]+/[^/[:space:]]+$' then
    raise exception 'invalid repository name' using errcode = '22023';
  end if;

  if p_reaction is null then
    delete from public.repository_reactions as stored_reaction
    where stored_reaction.repo_full_name = normalized_repo
      and stored_reaction.visitor_id = p_visitor_id;
  elsif p_reaction in ('like', 'dislike') then
    insert into public.repository_reactions (repo_full_name, visitor_id, reaction)
    values (normalized_repo, p_visitor_id, p_reaction)
    on conflict on constraint repository_reactions_pkey
    do update set reaction = excluded.reaction, updated_at = now();
  else
    raise exception 'invalid reaction' using errcode = '22023';
  end if;

  return query
  select
    normalized_repo,
    count(*) filter (where stored_reaction.reaction = 'like')::bigint,
    count(*) filter (where stored_reaction.reaction = 'dislike')::bigint,
    p_reaction
  from public.repository_reactions as stored_reaction
  where stored_reaction.repo_full_name = normalized_repo;
end;
$$;

create or replace function public.create_repository_review(
  p_repo_full_name text,
  p_visitor_id uuid,
  p_display_name text,
  p_kind text,
  p_body text,
  p_secret text default null
)
returns setof public.repository_reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_repo text := lower(trim(p_repo_full_name));
  normalized_name text := trim(p_display_name);
  normalized_body text := trim(p_body);
begin
  perform public.assert_phlox_write_secret(p_secret);

  if char_length(normalized_repo) not between 3 and 201
    or normalized_repo !~ '^[^/[:space:]]+/[^/[:space:]]+$' then
    raise exception 'invalid repository name' using errcode = '22023';
  end if;

  if char_length(normalized_name) not between 2 and 40
    or char_length(normalized_body) not between 2 and 2000
    or p_kind not in ('comment', 'review') then
    raise exception 'invalid review' using errcode = '22023';
  end if;

  return query
  insert into public.repository_reviews (
    repo_full_name, visitor_id, display_name, kind, body
  ) values (
    normalized_repo, p_visitor_id, normalized_name, p_kind, normalized_body
  )
  returning *;
end;
$$;

create or replace function public.register_repository_topics(
  p_repo_full_name text,
  p_topics text[],
  p_secret text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_repo text := lower(trim(p_repo_full_name));
  normalized_topics text[];
begin
  perform public.assert_phlox_write_secret(p_secret);

  if char_length(normalized_repo) not between 3 and 201
    or normalized_repo !~ '^[^/[:space:]]+/[^/[:space:]]+$' then
    raise exception 'invalid repository name' using errcode = '22023';
  end if;

  select coalesce(array_agg(candidate.topic), '{}'::text[])
  into normalized_topics
  from (
    select distinct lower(trim(unnested)) as topic
    from unnest(coalesce(p_topics, '{}'::text[])) as unnested
    where lower(trim(unnested)) ~ '^[a-z0-9][a-z0-9._+-]{0,49}$'
    limit 20
  ) as candidate;

  delete from public.repository_topics as stored_topic
  where stored_topic.repo_full_name = normalized_repo
    and not (stored_topic.topic_slug = any (normalized_topics));

  insert into public.repository_topics as stored_topic (repo_full_name, topic_slug)
  select normalized_repo, topic
  from unnest(normalized_topics) as topic
  on conflict (repo_full_name, topic_slug)
  do update set last_seen_at = now();
end;
$$;

-- Retire the unauthenticated signatures the database linter flagged.
drop function if exists public.set_repository_reaction(text, uuid, text);
drop function if exists public.create_repository_review(text, uuid, text, text, text);
drop function if exists public.register_repository_topics(text, text[]);

revoke all on function public.set_repository_reaction(text, uuid, text, text)
  from public;
revoke all on function public.create_repository_review(text, uuid, text, text, text, text)
  from public;
revoke all on function public.register_repository_topics(text, text[], text)
  from public;

grant execute on function public.set_repository_reaction(text, uuid, text, text)
  to anon, authenticated;
grant execute on function public.create_repository_review(text, uuid, text, text, text, text)
  to anon, authenticated;
grant execute on function public.register_repository_topics(text, text[], text)
  to anon, authenticated;
