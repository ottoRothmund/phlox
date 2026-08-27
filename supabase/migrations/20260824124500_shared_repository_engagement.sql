create extension if not exists pgcrypto;

create table public.repository_reactions (
  repo_full_name text not null check (
    char_length(repo_full_name) between 3 and 201
    and repo_full_name ~ '^[^/[:space:]]+/[^/[:space:]]+$'
  ),
  visitor_id uuid not null,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (repo_full_name, visitor_id)
);

alter table public.repository_reactions enable row level security;
create policy "repository reactions are publicly readable"
  on public.repository_reactions for select
  to anon, authenticated
  using (true);
grant select on public.repository_reactions to anon, authenticated;

create view public.repository_reaction_totals
with (security_invoker = true)
as
select
  repo_full_name,
  count(*) filter (where reaction = 'like')::bigint as likes,
  count(*) filter (where reaction = 'dislike')::bigint as dislikes
from public.repository_reactions
group by repo_full_name;

grant select on public.repository_reaction_totals to anon, authenticated;

create or replace function public.set_repository_reaction(
  p_repo_full_name text,
  p_visitor_id uuid,
  p_reaction text
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
  if char_length(normalized_repo) not between 3 and 201
    or normalized_repo !~ '^[^/[:space:]]+/[^/[:space:]]+$' then
    raise exception 'invalid repository name' using errcode = '22023';
  end if;

  if p_reaction is null then
    delete from public.repository_reactions r
    where r.repo_full_name = normalized_repo
      and r.visitor_id = p_visitor_id;
  elsif p_reaction in ('like', 'dislike') then
    insert into public.repository_reactions as r (
      repo_full_name,
      visitor_id,
      reaction
    ) values (
      normalized_repo,
      p_visitor_id,
      p_reaction
    )
    on conflict (repo_full_name, visitor_id)
    do update set
      reaction = excluded.reaction,
      updated_at = now();
  else
    raise exception 'invalid reaction' using errcode = '22023';
  end if;

  return query
  select
    normalized_repo,
    count(*) filter (where r.reaction = 'like')::bigint,
    count(*) filter (where r.reaction = 'dislike')::bigint,
    p_reaction
  from public.repository_reactions r
  where r.repo_full_name = normalized_repo;
end;
$$;

revoke all on function public.set_repository_reaction(text, uuid, text) from public;
grant execute on function public.set_repository_reaction(text, uuid, text) to anon, authenticated;

create table public.repository_reviews (
  id uuid primary key default gen_random_uuid(),
  repo_full_name text not null check (
    char_length(repo_full_name) between 3 and 201
    and repo_full_name ~ '^[^/[:space:]]+/[^/[:space:]]+$'
  ),
  visitor_id uuid not null,
  display_name text not null check (char_length(display_name) between 2 and 40),
  kind text not null check (kind in ('comment', 'review')),
  body text not null check (char_length(body) between 2 and 2000),
  created_at timestamptz not null default now()
);

create index repository_reviews_repo_created_idx
  on public.repository_reviews (repo_full_name, created_at desc);

alter table public.repository_reviews enable row level security;
create policy "repository reviews are publicly readable"
  on public.repository_reviews for select
  to anon, authenticated
  using (true);
grant select on public.repository_reviews to anon, authenticated;

create or replace function public.create_repository_review(
  p_repo_full_name text,
  p_visitor_id uuid,
  p_display_name text,
  p_kind text,
  p_body text
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
  if char_length(normalized_repo) not between 3 and 201
    or normalized_repo !~ '^[^/[:space:]]+/[^/[:space:]]+$' then
    raise exception 'invalid repository name' using errcode = '22023';
  end if;
  if char_length(normalized_name) not between 2 and 40 then
    raise exception 'display name must be 2 to 40 characters' using errcode = '22023';
  end if;
  if p_kind not in ('comment', 'review') then
    raise exception 'invalid review kind' using errcode = '22023';
  end if;
  if char_length(normalized_body) not between 2 and 2000 then
    raise exception 'body must be 2 to 2000 characters' using errcode = '22023';
  end if;

  return query
  insert into public.repository_reviews (
    repo_full_name,
    visitor_id,
    display_name,
    kind,
    body
  ) values (
    normalized_repo,
    p_visitor_id,
    normalized_name,
    p_kind,
    normalized_body
  )
  returning *;
end;
$$;

revoke all on function public.create_repository_review(text, uuid, text, text, text) from public;
grant execute on function public.create_repository_review(text, uuid, text, text, text) to anon, authenticated;

create table public.repository_topics (
  repo_full_name text not null check (
    char_length(repo_full_name) between 3 and 201
    and repo_full_name ~ '^[^/[:space:]]+/[^/[:space:]]+$'
  ),
  topic_slug text not null check (
    char_length(topic_slug) between 1 and 50
    and topic_slug ~ '^[a-z0-9][a-z0-9._+-]*$'
  ),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (repo_full_name, topic_slug)
);

create index repository_topics_slug_idx on public.repository_topics (topic_slug);

alter table public.repository_topics enable row level security;
create policy "repository topics are publicly readable"
  on public.repository_topics for select
  to anon, authenticated
  using (true);
grant select on public.repository_topics to anon, authenticated;

create view public.topic_catalog
with (security_invoker = true)
as
select
  topic_slug,
  count(*)::bigint as repository_count,
  max(last_seen_at) as last_seen_at
from public.repository_topics
group by topic_slug;

grant select on public.topic_catalog to anon, authenticated;

create or replace function public.register_repository_topics(
  p_repo_full_name text,
  p_topics text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_repo text := lower(trim(p_repo_full_name));
  normalized_topic text;
begin
  if char_length(normalized_repo) not between 3 and 201
    or normalized_repo !~ '^[^/[:space:]]+/[^/[:space:]]+$' then
    raise exception 'invalid repository name' using errcode = '22023';
  end if;
  if coalesce(array_length(p_topics, 1), 0) > 20 then
    raise exception 'too many topics' using errcode = '22023';
  end if;

  delete from public.repository_topics existing
  where existing.repo_full_name = normalized_repo
    and not exists (
      select 1
      from unnest(coalesce(p_topics, array[]::text[])) raw_topic
      where lower(trim(raw_topic)) = existing.topic_slug
    );

  for normalized_topic in
    select distinct lower(trim(raw_topic))
    from unnest(coalesce(p_topics, array[]::text[])) raw_topic
    where char_length(lower(trim(raw_topic))) between 1 and 50
      and lower(trim(raw_topic)) ~ '^[a-z0-9][a-z0-9._+-]*$'
  loop
    insert into public.repository_topics as existing (
      repo_full_name,
      topic_slug
    ) values (
      normalized_repo,
      normalized_topic
    )
    on conflict (repo_full_name, topic_slug)
    do update set last_seen_at = now();
  end loop;
end;
$$;

revoke all on function public.register_repository_topics(text, text[]) from public;
grant execute on function public.register_repository_topics(text, text[]) to anon, authenticated;
