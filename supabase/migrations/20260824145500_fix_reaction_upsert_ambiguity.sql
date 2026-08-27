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
    delete from public.repository_reactions as stored_reaction
    where stored_reaction.repo_full_name = normalized_repo
      and stored_reaction.visitor_id = p_visitor_id;
  elsif p_reaction in ('like', 'dislike') then
    insert into public.repository_reactions (
      repo_full_name,
      visitor_id,
      reaction
    ) values (
      normalized_repo,
      p_visitor_id,
      p_reaction
    )
    on conflict on constraint repository_reactions_pkey
    do update set
      reaction = excluded.reaction,
      updated_at = now();
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
