-- Public game feedback, private writes and moderation queue.
create table pp_private.game_ratings(
 player_id uuid not null references public.profiles(player_id) on delete cascade,
 game_id text not null check(game_id in ('magazyn-auto','quick-math','two-seconds')),
 stars integer not null check(stars between 1 and 5),
 updated_at timestamptz not null default clock_timestamp(),primary key(player_id,game_id)
);
create index game_ratings_game on pp_private.game_ratings(game_id);
create table pp_private.game_comments(
 id bigint generated always as identity primary key,
 player_id uuid not null references public.profiles(player_id) on delete cascade,
 game_id text not null check(game_id in ('magazyn-auto','quick-math','two-seconds')),
 request_id uuid not null,body text not null check(char_length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default clock_timestamp(),deleted_at timestamptz,
 unique(player_id,request_id)
);
create index game_comments_page on pp_private.game_comments(game_id,id desc) where deleted_at is null;
create index game_comments_owner_time on pp_private.game_comments(player_id,created_at desc);
create table pp_private.game_comment_reports(
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles(player_id) on delete cascade,
 comment_id bigint not null references pp_private.game_comments(id) on delete cascade,request_id uuid not null,
 reason text not null check(reason in ('harassment','spam','inappropriate','other')),
 snapshot jsonb not null,created_at timestamptz not null default clock_timestamp(),unique(reporter_id,request_id)
);
create index game_comment_reports_time on pp_private.game_comment_reports(reporter_id,created_at desc);
create index game_comment_reports_comment on pp_private.game_comment_reports(comment_id);
alter table pp_private.game_ratings enable row level security;
alter table pp_private.game_comments enable row level security;
alter table pp_private.game_comment_reports enable row level security;
revoke all on pp_private.game_ratings,pp_private.game_comments,pp_private.game_comment_reports from public,anon,authenticated;
revoke all on sequence pp_private.game_comments_id_seq from public,anon,authenticated;

-- Explicit public read projection: no request IDs, reports or auth data.
create function pp_private.feedback_read(p_game text default null,p_before bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();summary jsonb;comments jsonb;
begin
 if p_game is null then
  select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) into summary from (
   select game_id,round(avg(stars),1) as average,count(*) as votes from pp_private.game_ratings group by game_id
  ) s;return summary;
 end if;
 if p_game not in ('magazyn-auto','quick-math','two-seconds') then raise exception 'UNKNOWN_GAME';end if;
 if p_before is not null and p_before<=0 then raise exception 'INVALID_CURSOR';end if;
 select jsonb_build_object('average',round(avg(stars),1),'votes',count(*),'mine',max(stars) filter(where player_id=me)) into summary from pp_private.game_ratings where game_id=p_game;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_id desc),'[]'::jsonb) into comments from (
  select c.id::text as id,c.id as sort_id,c.body,c.created_at,p.player_id,p.handle,p.display_name,p.avatar_key
  from pp_private.game_comments c join public.profiles p on p.player_id=c.player_id
  where c.game_id=p_game and c.deleted_at is null and (p_before is null or c.id<p_before)
   and not exists(select 1 from pp_private.player_blocks b where (b.blocker_id=me and b.blocked_id=c.player_id) or (b.blocked_id=me and b.blocker_id=c.player_id))
  order by c.id desc limit 20
 ) c;
 return jsonb_build_object('rating',summary,'comments',comments);
end $$;
revoke all on function pp_private.feedback_read(text,bigint) from public,anon,authenticated;
grant usage on schema pp_private to anon;
grant execute on function pp_private.feedback_read(text,bigint) to anon,authenticated;
create function public.pp_game_feedback(p_game text default null,p_before bigint default null) returns jsonb language sql security invoker set search_path='' as $$select pp_private.feedback_read(p_game,p_before)$$;
revoke all on function public.pp_game_feedback(text,bigint) from public,anon,authenticated;
grant execute on function public.pp_game_feedback(text,bigint) to anon,authenticated;

create function pp_private.feedback_write(p_owner uuid,p_game text,p_action text,p_stars integer default null,p_body text default null,p_request uuid default null,p_comment bigint default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();c pp_private.game_comments;r pp_private.game_comment_reports;
begin
 if me is null or me is distinct from p_owner then raise exception 'PLAYER_CHANGED';end if;
 if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and (banned_until is null or banned_until<clock_timestamp())) or not exists(select 1 from public.profiles where player_id=me) then raise exception 'PROFILE_REQUIRED';end if;
 if p_game is null or p_game not in ('magazyn-auto','quick-math','two-seconds') then raise exception 'UNKNOWN_GAME';end if;
 perform pg_advisory_xact_lock(hashtextextended('feedback:'||me::text,0));
 if p_action='rate' then
  if p_stars is null or p_stars not between 1 and 5 then raise exception 'INVALID_RATING';end if;
  -- Same value retry is harmless, a changed vote is limited to once per 2 seconds.
  if exists(select 1 from pp_private.game_ratings where player_id=me and game_id=p_game and stars<>p_stars and updated_at>clock_timestamp()-interval '2 seconds') then raise exception 'RATE_LIMIT';end if;
  insert into pp_private.game_ratings(player_id,game_id,stars) values(me,p_game,p_stars)
   on conflict(player_id,game_id) do update set stars=excluded.stars,updated_at=case when pp_private.game_ratings.stars=excluded.stars then pp_private.game_ratings.updated_at else clock_timestamp() end;
  return jsonb_build_object('ok',true);
 elsif p_action='comment' then
  if p_request is null or p_body is null or char_length(btrim(p_body)) not between 1 and 1000 then raise exception 'INVALID_COMMENT';end if;
  select * into c from pp_private.game_comments where player_id=me and request_id=p_request;
  if found then
   if c.game_id<>p_game or c.body<>btrim(p_body) then raise exception 'DUPLICATE_CONFLICT';end if;
   if c.deleted_at is not null then raise exception 'COMMENT_REMOVED';end if;
   return jsonb_build_object('id',c.id::text);
  end if;
  if (select count(*) from pp_private.game_comments where player_id=me and created_at>clock_timestamp()-interval '1 minute')>=3 or (select count(*) from pp_private.game_comments where player_id=me and created_at>clock_timestamp()-interval '1 day')>=30 then raise exception 'COMMENT_LIMIT';end if;
  insert into pp_private.game_comments(player_id,game_id,body,request_id) values(me,p_game,btrim(p_body),p_request) returning * into c;return jsonb_build_object('id',c.id::text);
 elsif p_action='remove' then
  update pp_private.game_comments set deleted_at=coalesce(deleted_at,clock_timestamp()) where id=p_comment and player_id=me and game_id=p_game;
  if not found then raise exception 'FORBIDDEN';end if;return jsonb_build_object('ok',true);
 elsif p_action='report' then
  if p_request is null or p_reason is null or p_reason not in ('harassment','spam','inappropriate','other') then raise exception 'INVALID_REPORT';end if;
  select * into r from pp_private.game_comment_reports where reporter_id=me and request_id=p_request;
  if found then
   if r.comment_id is distinct from p_comment or r.reason<>p_reason then raise exception 'DUPLICATE_CONFLICT';end if;
   return jsonb_build_object('id',r.id);
  end if;
  select * into c from pp_private.game_comments where id=p_comment and game_id=p_game and deleted_at is null;
  if not found or c.player_id=me then raise exception 'INVALID_COMMENT';end if;
  if exists(select 1 from pp_private.player_blocks b where (b.blocker_id=me and b.blocked_id=c.player_id) or (b.blocked_id=me and b.blocker_id=c.player_id)) then raise exception 'CONTACT_UNAVAILABLE';end if;
  if (select count(*) from pp_private.game_comment_reports where reporter_id=me and created_at>clock_timestamp()-interval '1 day')>=10 then raise exception 'REPORT_LIMIT';end if;
  insert into pp_private.game_comment_reports(reporter_id,comment_id,request_id,reason,snapshot) values(me,c.id,p_request,p_reason,jsonb_build_object('game_id',c.game_id,'player_id',c.player_id,'body',c.body,'created_at',c.created_at)) returning * into r;
  return jsonb_build_object('id',r.id);
 end if;
 raise exception 'INVALID_ACTION';
end $$;
revoke all on function pp_private.feedback_write(uuid,text,text,integer,text,uuid,bigint,text) from public,anon,authenticated;
grant execute on function pp_private.feedback_write(uuid,text,text,integer,text,uuid,bigint,text) to authenticated;
create function public.pp_game_feedback_write(p_owner uuid,p_game text,p_action text,p_stars integer default null,p_body text default null,p_request uuid default null,p_comment bigint default null,p_reason text default null) returns jsonb language sql security invoker set search_path='' as $$select pp_private.feedback_write(p_owner,p_game,p_action,p_stars,p_body,p_request,p_comment,p_reason)$$;
revoke all on function public.pp_game_feedback_write(uuid,text,text,integer,text,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.pp_game_feedback_write(uuid,text,text,integer,text,uuid,bigint,text) to authenticated;

-- Rankings read the same public, server-written best scores used by the games.
create function public.pp_game_ranking(p_game text) returns jsonb language sql stable security invoker set search_path='' as $$
 with ranked as (
  select b.player_id,p.handle,p.display_name,p.avatar_key,b.value,b.attempts,b.verification_status,
   rank() over(order by case when p_game='quick-math' then -b.value else b.value end) as place,
   row_number() over(order by case when p_game='quick-math' then -b.value else b.value end,b.player_id) as position
  from public.player_bests b join public.profiles p on p.player_id=b.player_id
  where b.game_id=p_game and b.ruleset_version=1 and p_game in ('quick-math','two-seconds')
 ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.position) from ranked r where position<=20),'[]'::jsonb),'mine',(select to_jsonb(r) from ranked r where player_id=auth.uid()));
$$;
revoke all on function public.pp_game_ranking(text) from public,anon,authenticated;
grant execute on function public.pp_game_ranking(text) to anon,authenticated;
