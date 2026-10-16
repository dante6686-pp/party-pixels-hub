-- Technical games v1. No XP or rewards; scores have explicit trust levels.
create schema pp_private;
revoke all on schema pp_private from public, anon, authenticated;
grant usage on schema pp_private to authenticated;
create table pp_private.game_sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (game_id in ('quick-math','two-seconds')),
  ruleset_version integer not null default 1 check (ruleset_version=1),
  challenge jsonb not null,
  started_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '10 minutes'
);
create index game_sessions_owner_started on pp_private.game_sessions(player_id,started_at);
create table pp_private.score_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references pp_private.game_sessions(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  payload jsonb not null,
  receipt jsonb not null,
  unique(player_id,request_id)
);
alter table pp_private.game_sessions enable row level security;
alter table pp_private.score_submissions enable row level security;
revoke all on pp_private.game_sessions, pp_private.score_submissions from public,anon,authenticated;

create table public.player_bests (
  player_id uuid not null references public.profiles(player_id) on delete cascade,
  game_id text not null check(game_id in ('quick-math','two-seconds')),
  ruleset_version integer not null default 1 check(ruleset_version=1),
  value integer not null check(value>=0),
  unit text not null check(unit in ('points','milliseconds')),
  verification_status text not null check(verification_status in ('validated','unverified')),
  attempts integer not null default 1 check(attempts>0),
  primary key(player_id,game_id,ruleset_version)
);
alter table public.player_bests enable row level security;
revoke all on public.player_bests from public,anon,authenticated;
grant select on public.player_bests to anon,authenticated;
create policy bests_public_read on public.player_bests for select to anon,authenticated using(true);

-- Privileged writes live in a non-exposed schema, guarded by fresh account checks.
create function pp_private.start_game(p_game_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid; challenge jsonb;
begin
  if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null and (banned_until is null or banned_until<clock_timestamp())) then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists(select 1 from public.profiles where player_id=uid) then raise exception 'PROFILE_REQUIRED'; end if;
  if p_game_id is null or p_game_id not in ('quick-math','two-seconds') then raise exception 'UNKNOWN_GAME'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if (select count(*) from pp_private.game_sessions where player_id=uid and started_at>clock_timestamp()-interval '1 minute')>=20 then raise exception 'RATE_LIMITED'; end if;
  if p_game_id='quick-math' then
    select jsonb_agg(jsonb_build_object('a',floor(random()*20)::integer+1,'b',floor(random()*20)::integer+1)) into challenge from generate_series(1,5);
  else challenge:='{"targetMs":2000}'::jsonb; end if;
  insert into pp_private.game_sessions(player_id,game_id,challenge) values(uid,p_game_id,challenge) returning id into sid;
  return jsonb_build_object('sessionId',sid,'gameId',p_game_id,'rulesetVersion',1,'challenge',challenge);
end $$;

create function pp_private.submit_score(p_session_id uuid,p_request_id uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); s pp_private.game_sessions; old pp_private.score_submissions; val integer; trust text; unit_name text; receipt jsonb;
begin
  if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null and (banned_until is null or banned_until<clock_timestamp())) then raise exception 'AUTH_REQUIRED'; end if;
  if p_session_id is null or p_request_id is null or p_result is null or octet_length(p_result::text)>2048 then raise exception 'INVALID_RESULT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select * into old from pp_private.score_submissions where player_id=uid and request_id=p_request_id;
  if found then
    if old.session_id=p_session_id and old.payload=p_result then return old.receipt; end if;
    raise exception 'DUPLICATE_CONFLICT';
  end if;
  select * into s from pp_private.game_sessions where id=p_session_id and player_id=uid for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  if s.expires_at<=clock_timestamp() then raise exception 'SESSION_EXPIRED'; end if;
  if exists(select 1 from pp_private.score_submissions where session_id=s.id) then raise exception 'DUPLICATE_CONFLICT'; end if;
  if jsonb_typeof(p_result) is distinct from 'object' then raise exception 'INVALID_RESULT'; end if;
  if s.game_id='quick-math' then
    if p_result-'answers'<>'{}'::jsonb or jsonb_typeof(p_result->'answers') is distinct from 'array' then raise exception 'INVALID_RESULT'; end if;
    if jsonb_array_length(p_result->'answers')<>5 then raise exception 'INVALID_RESULT'; end if;
    if exists(select 1 from jsonb_array_elements(p_result->'answers') a where jsonb_typeof(a)<>'number' or a::text !~ '^[0-9]{1,3}$') then raise exception 'INVALID_RESULT'; end if;
    select count(*)::integer into val from generate_series(0,4) i where (p_result->'answers'->>i)::integer=(s.challenge->i->>'a')::integer+(s.challenge->i->>'b')::integer;
    trust:='validated';unit_name:='points';
  else
    if p_result-'value'<>'{}'::jsonb or jsonb_typeof(p_result->'value') is distinct from 'number' or (p_result->>'value') !~ '^[0-9]{1,5}$' then raise exception 'INVALID_RESULT'; end if;
    val:=(p_result->>'value')::integer;
    if val>10000 then raise exception 'INVALID_RESULT'; end if;
    trust:='unverified';unit_name:='milliseconds';
  end if;
  receipt:=jsonb_build_object('submissionId',gen_random_uuid(),'sessionId',s.id,'gameId',s.game_id,'value',val,'unit',unit_name,'verificationStatus',trust);
  insert into pp_private.score_submissions(session_id,player_id,request_id,payload,receipt) values(s.id,uid,p_request_id,p_result,receipt);
  insert into public.player_bests(player_id,game_id,value,unit,verification_status)
    values(uid,s.game_id,val,unit_name,trust)
    on conflict(player_id,game_id,ruleset_version) do update set
      value=case when excluded.game_id='quick-math' then greatest(public.player_bests.value,excluded.value) else least(public.player_bests.value,excluded.value) end,
      attempts=public.player_bests.attempts+1;
  return receipt;
end $$;

revoke execute on function pp_private.start_game(text),pp_private.submit_score(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function pp_private.start_game(text),pp_private.submit_score(uuid,uuid,jsonb) to authenticated;
create function public.pp_start_game(p_game_id text) returns jsonb language sql security invoker set search_path='' as $$select pp_private.start_game(p_game_id)$$;
create function public.pp_submit_score(p_session_id uuid,p_request_id uuid,p_result jsonb) returns jsonb language sql security invoker set search_path='' as $$select pp_private.submit_score(p_session_id,p_request_id,p_result)$$;
revoke execute on function public.pp_start_game(text),public.pp_submit_score(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.pp_start_game(text),public.pp_submit_score(uuid,uuid,jsonb) to authenticated;
