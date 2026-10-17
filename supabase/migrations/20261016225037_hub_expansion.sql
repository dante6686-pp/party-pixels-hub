-- Hub expansion
create table pp_private.player_settings(player_id uuid primary key references public.profiles(player_id) on delete cascade,allow_invites boolean not null default true,show_presence boolean not null default false,show_badges boolean not null default true,last_seen timestamptz,playing text check(playing in ('magazyn-auto','quick-math','two-seconds','nocna-portiernia')));
create table pp_private.moderators(player_id uuid primary key references public.profiles(player_id) on delete cascade);
create table pp_private.moderation_audit(id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles(player_id) on delete set null,action text not null,details jsonb not null,created_at timestamptz not null default clock_timestamp());
create table pp_private.player_badges(player_id uuid not null references public.profiles(player_id) on delete cascade,badge text not null check(badge in ('first-profile','first-round','perfect-five','first-friend','first-comment')),earned_at timestamptz not null default clock_timestamp(),primary key(player_id,badge));
create index player_badges_badge on pp_private.player_badges(badge);
alter table pp_private.game_comments add column parent_id bigint references pp_private.game_comments(id) on delete cascade;
alter table pp_private.game_comments add column hidden_at timestamptz;
create index game_comment_replies on pp_private.game_comments(parent_id,id) where parent_id is not null;
create table pp_private.reply_notifications(id bigint generated always as identity primary key,recipient_id uuid not null references public.profiles(player_id) on delete cascade,actor_id uuid not null references public.profiles(player_id) on delete cascade,comment_id bigint not null unique references pp_private.game_comments(id) on delete cascade,parent_id bigint not null references pp_private.game_comments(id) on delete cascade,game_id text not null,created_at timestamptz not null default clock_timestamp(),read_at timestamptz);
create index reply_notifications_recipient on pp_private.reply_notifications(recipient_id,id desc) where read_at is null;
create index reply_notifications_actor on pp_private.reply_notifications(actor_id);
create index reply_notifications_parent on pp_private.reply_notifications(parent_id);
alter table pp_private.player_reports add column handled_at timestamptz;
alter table pp_private.game_comment_reports add column handled_at timestamptz;
alter table pp_private.player_settings enable row level security;
revoke all on pp_private.player_settings from public,anon,authenticated;
alter table pp_private.moderators enable row level security;
revoke all on pp_private.moderators from public,anon,authenticated;
alter table pp_private.moderation_audit enable row level security;
revoke all on pp_private.moderation_audit from public,anon,authenticated;
alter table pp_private.player_badges enable row level security;
revoke all on pp_private.player_badges from public,anon,authenticated;
alter table pp_private.reply_notifications enable row level security;
revoke all on pp_private.reply_notifications from public,anon,authenticated;
revoke all on sequence pp_private.reply_notifications_id_seq from public,anon,authenticated;
alter table pp_private.player_library drop constraint player_library_game_id_check;
alter table pp_private.player_library add constraint player_library_game_id_check check(game_id in ('magazyn-auto','quick-math','two-seconds','nocna-portiernia'));
alter table pp_private.game_ratings drop constraint game_ratings_game_id_check;
alter table pp_private.game_ratings add constraint game_ratings_game_id_check check(game_id in ('magazyn-auto','quick-math','two-seconds','nocna-portiernia'));
alter table pp_private.game_comments drop constraint game_comments_game_id_check;
alter table pp_private.game_comments add constraint game_comments_game_id_check check(game_id in ('magazyn-auto','quick-math','two-seconds','nocna-portiernia'));

create or replace function pp_private.library_api(p_owner uuid,p_action text,p_game text default null,p_favorite boolean default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();result jsonb;save jsonb;
begin
 if me is null or me is distinct from p_owner then raise exception 'PLAYER_CHANGED';end if;
 if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and (banned_until is null or banned_until<now())) or not exists(select 1 from public.profiles where player_id=me) then raise exception 'PROFILE_REQUIRED';end if;
 if p_action='get' then
  select coalesce(jsonb_agg(jsonb_build_object('game_id',game_id,'favorite',favorite,'last_played_at',last_played_at) order by game_id),'[]'::jsonb) into result from pp_private.player_library where player_id=me;
  select jsonb_build_object('mission',(checkpoint->>'mission')::integer,'updated_at',updated_at) into save from pp_private.game_checkpoints where player_id=me and game_id='magazyn-auto';
  return jsonb_build_object('games',result,'checkpoint',save);
 end if;
 if p_game is null or p_game not in ('magazyn-auto','quick-math','two-seconds','nocna-portiernia') then raise exception 'INVALID_GAME';end if;
 if p_action='favorite' and p_favorite is not null then
  insert into pp_private.player_library(player_id,game_id,favorite) values(me,p_game,p_favorite)
  on conflict(player_id,game_id) do update set favorite=excluded.favorite;
 elsif p_action='played' then
  insert into pp_private.player_library(player_id,game_id,last_played_at) values(me,p_game,clock_timestamp())
  on conflict(player_id,game_id) do update set last_played_at=greatest(pp_private.player_library.last_played_at,excluded.last_played_at);
 else raise exception 'INVALID_ACTION';end if;
 return jsonb_build_object('ok',true);
end $$;

create or replace function pp_private.feedback_read(p_game text default null,p_before bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();summary jsonb;comments jsonb;
begin
 if p_game is null then
  select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) into summary from (
   select game_id,round(avg(stars),1) as average,count(*) as votes from pp_private.game_ratings group by game_id
  ) s;return summary;
 end if;
 if p_game not in ('magazyn-auto','quick-math','two-seconds','nocna-portiernia') then raise exception 'UNKNOWN_GAME';end if;
 if p_before is not null and p_before<=0 then raise exception 'INVALID_CURSOR';end if;
 select jsonb_build_object('average',round(avg(stars),1),'votes',count(*),'mine',max(stars) filter(where player_id=me)) into summary from pp_private.game_ratings where game_id=p_game;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_id desc),'[]'::jsonb) into comments from (
  select c.id::text as id,c.id as sort_id,c.body,c.created_at,(select count(*) from pp_private.game_comments r where r.parent_id=c.id and r.deleted_at is null and r.hidden_at is null and not exists(select 1 from pp_private.player_blocks b where (b.blocker_id=me and b.blocked_id=r.player_id) or (b.blocked_id=me and b.blocker_id=r.player_id))) as replies,p.player_id,p.handle,p.display_name,p.avatar_key
  from pp_private.game_comments c join public.profiles p on p.player_id=c.player_id
  where c.game_id=p_game and c.deleted_at is null and c.hidden_at is null and c.parent_id is null and (p_before is null or c.id<p_before)
   and not exists(select 1 from pp_private.player_blocks b where (b.blocker_id=me and b.blocked_id=c.player_id) or (b.blocked_id=me and b.blocker_id=c.player_id))
  order by c.id desc limit 20
 ) c;
 return jsonb_build_object('rating',summary,'comments',comments);
end $$;

create or replace function pp_private.feedback_write(p_owner uuid,p_game text,p_action text,p_stars integer default null,p_body text default null,p_request uuid default null,p_comment bigint default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();c pp_private.game_comments;r pp_private.game_comment_reports;
begin
 if me is null or me is distinct from p_owner then raise exception 'PLAYER_CHANGED';end if;
 if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and (banned_until is null or banned_until<clock_timestamp())) or not exists(select 1 from public.profiles where player_id=me) then raise exception 'PROFILE_REQUIRED';end if;
 if p_game is null or p_game not in ('magazyn-auto','quick-math','two-seconds','nocna-portiernia') then raise exception 'UNKNOWN_GAME';end if;
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
  select * into c from pp_private.game_comments where id=p_comment and game_id=p_game and deleted_at is null and hidden_at is null;
  if not found or c.player_id=me then raise exception 'INVALID_COMMENT';end if;
  if exists(select 1 from pp_private.player_blocks b where (b.blocker_id=me and b.blocked_id=c.player_id) or (b.blocked_id=me and b.blocker_id=c.player_id)) then raise exception 'CONTACT_UNAVAILABLE';end if;
  if (select count(*) from pp_private.game_comment_reports where reporter_id=me and created_at>clock_timestamp()-interval '1 day')>=10 then raise exception 'REPORT_LIMIT';end if;
  insert into pp_private.game_comment_reports(reporter_id,comment_id,request_id,reason,snapshot) values(me,c.id,p_request,p_reason,jsonb_build_object('game_id',c.game_id,'player_id',c.player_id,'body',c.body,'created_at',c.created_at)) returning * into r;
  return jsonb_build_object('id',r.id);
 end if;
 raise exception 'INVALID_ACTION';
end $$;

create or replace function pp_private.friends_api(p_owner uuid,p_action text,p_target uuid default null,p_request uuid default null,p_query text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); lo uuid; hi uuid; r pp_private.friendships; result jsonb;
begin
 if me is null or me is distinct from p_owner then raise exception 'PLAYER_CHANGED'; end if;
 if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and (banned_until is null or banned_until<now())) or not exists(select 1 from public.profiles where player_id=me) then raise exception 'PROFILE_REQUIRED'; end if;
 if p_action in ('send','accept') and exists(select 1 from pp_private.player_blocks where (blocker_id=me and blocked_id=p_target) or (blocker_id=p_target and blocked_id=me)) then raise exception 'CONTACT_UNAVAILABLE';end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('player_id',p.player_id,'handle',p.handle,'display_name',p.display_name,'avatar_key',p.avatar_key,'request_id',f.request_id,'relation',case when f.state='accepted' then 'friend' when f.sender_id=me then 'outgoing' else 'incoming' end) order by p.handle),'[]'::jsonb) into result
  from pp_private.friendships f join public.profiles p on p.player_id=case when f.low_id=me then f.high_id else f.low_id end
  where (f.low_id=me or f.high_id=me) and f.state<>'closed' and not exists(select 1 from pp_private.player_blocks bb where (bb.blocker_id=me and bb.blocked_id=p.player_id) or (bb.blocker_id=p.player_id and bb.blocked_id=me));
  return result;
 elsif p_action='search' then
  if p_query is null or p_query !~ '^[a-z0-9_]{3,20}$' then raise exception 'INVALID_QUERY'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select p.player_id,p.handle,p.display_name,p.avatar_key,f.request_id,
    case when f.state='accepted' then 'friend' when f.state='pending' then case when f.sender_id=me then 'outgoing' else 'incoming' end else 'none' end as relation
   from public.profiles p left join pp_private.friendships f on f.low_id=least(me,p.player_id) and f.high_id=greatest(me,p.player_id)
   where p.player_id<>me and not exists(select 1 from pp_private.player_blocks bb where (bb.blocker_id=me and bb.blocked_id=p.player_id) or (bb.blocker_id=p.player_id and bb.blocked_id=me)) and left(p.handle,length(p_query))=p_query
   order by (p.handle=p_query) desc,p.handle limit 20
  ) x;
  return result;
 end if;
 if p_action is null or p_action not in ('send','accept','decline','cancel','remove') then raise exception 'INVALID_ACTION'; end if;
 if p_target is null or p_target=me then raise exception 'INVALID_TARGET'; end if;
 lo:=least(me,p_target); hi:=greatest(me,p_target);
 -- Ordered user locks serialize pair transitions and both players' list limits.
 perform pg_advisory_xact_lock(hashtextextended('friends:'||lo::text,0));
 perform pg_advisory_xact_lock(hashtextextended('friends:'||hi::text,0));
 select * into r from pp_private.friendships where low_id=lo and high_id=hi for update;
 if p_action='send' then
  if exists(select 1 from pp_private.player_settings where player_id=p_target and not allow_invites) then raise exception 'INVITES_DISABLED';end if;
  if not exists(select 1 from public.profiles where player_id=p_target) then raise exception 'INVALID_TARGET'; end if;
  if r.state in ('pending','accepted') then return jsonb_build_object('ok',true); end if;
  if r.closed_reason is distinct from 'cancel' and r.updated_at>now()-interval '1 day' then raise exception 'COOLDOWN'; end if;
  if (select count(*) from pp_private.friendships where state<>'closed' and (low_id=me or high_id=me))>=200 or (select count(*) from pp_private.friendships where state<>'closed' and (low_id=p_target or high_id=p_target))>=200 or (select count(*) from pp_private.friendships where sender_id=me and state='pending')>=20 then raise exception 'FRIEND_LIMIT'; end if;
  insert into pp_private.friendships(low_id,high_id,sender_id,state) values(lo,hi,me,'pending') on conflict(low_id,high_id) do update set sender_id=me,state='pending',request_id=gen_random_uuid(),updated_at=now(),closed_reason=null;
 else
  if r.request_id is null or p_request is distinct from r.request_id then raise exception 'STALE_REQUEST'; end if;
  if p_action='accept' and r.sender_id<>me and r.state in ('pending','accepted') then
   update pp_private.friendships set state='accepted',updated_at=now() where low_id=lo and high_id=hi;
  elsif (p_action='decline' and r.sender_id<>me and r.state='pending') or (p_action='cancel' and r.sender_id=me and r.state='pending') or (p_action='remove' and r.state='accepted') then
   update pp_private.friendships set state='closed',updated_at=now(),closed_reason=p_action where low_id=lo and high_id=hi;
  elsif r.state<>'closed' then raise exception 'INVALID_TRANSITION'; end if;
 end if;
 return jsonb_build_object('ok',true);
end $$;
create function pp_private.checked_player(p_owner uuid) returns uuid language plpgsql security definer set search_path='' as $$declare me uuid:=auth.uid();begin
 if me is null or me is distinct from p_owner then raise exception 'PLAYER_CHANGED';end if;
 if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and (banned_until is null or banned_until<clock_timestamp())) or not exists(select 1 from public.profiles where player_id=me) then raise exception 'PROFILE_REQUIRED';end if;return me;end $$;
revoke all on function pp_private.checked_player(uuid) from public,anon,authenticated;
create function pp_private.settings_api(p_owner uuid,p_action text,p_invites boolean default null,p_presence boolean default null,p_badges boolean default null,p_game text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare me uuid:=pp_private.checked_player(p_owner);s pp_private.player_settings;result jsonb;begin
 if p_action='save' then
  if p_invites is null or p_presence is null or p_badges is null then raise exception 'INVALID_SETTINGS';end if;
  perform pg_advisory_xact_lock(hashtextextended('friends:'||me::text,0));
  insert into pp_private.player_settings(player_id,allow_invites,show_presence,show_badges) values(me,p_invites,p_presence,p_badges) on conflict(player_id) do update set allow_invites=excluded.allow_invites,show_presence=excluded.show_presence,show_badges=excluded.show_badges,last_seen=case when excluded.show_presence then pp_private.player_settings.last_seen else null end,playing=case when excluded.show_presence then pp_private.player_settings.playing else null end;
 elsif p_action='heartbeat' then
  if p_game is not null and p_game not in ('magazyn-auto','quick-math','two-seconds','nocna-portiernia') then raise exception 'INVALID_GAME';end if;
  update pp_private.player_settings set last_seen=clock_timestamp(),playing=p_game where player_id=me and show_presence and (last_seen is null or last_seen<clock_timestamp()-interval '10 seconds' or playing is distinct from p_game);return jsonb_build_object('ok',true);
 elsif p_action='friends' then
  select coalesce(jsonb_agg(jsonb_build_object('player_id',s.player_id,'game',s.playing)),'[]'::jsonb) into result from pp_private.friendships f join pp_private.player_settings s on s.player_id=case when f.low_id=me then f.high_id else f.low_id end join auth.users u on u.id=s.player_id where me in(f.low_id,f.high_id) and f.state='accepted' and s.show_presence and s.last_seen>clock_timestamp()-interval '90 seconds' and (u.banned_until is null or u.banned_until<clock_timestamp()) and not exists(select 1 from pp_private.player_blocks b where (b.blocker_id=me and b.blocked_id=s.player_id) or (b.blocked_id=me and b.blocker_id=s.player_id));return result;
 elsif p_action<>'get' then raise exception 'INVALID_ACTION';end if;
 select * into s from pp_private.player_settings where player_id=me;
 return jsonb_build_object('allow_invites',coalesce(s.allow_invites,true),'show_presence',coalesce(s.show_presence,false),'show_badges',coalesce(s.show_badges,true),'is_moderator',exists(select 1 from pp_private.moderators where player_id=me));end $$;
revoke all on function pp_private.settings_api(uuid,text,boolean,boolean,boolean,text) from public,anon,authenticated;
grant execute on function pp_private.settings_api(uuid,text,boolean,boolean,boolean,text) to authenticated;
create function public.pp_settings(p_owner uuid,p_action text,p_invites boolean default null,p_presence boolean default null,p_badges boolean default null,p_game text default null) returns jsonb language sql security invoker set search_path='' as $$select pp_private.settings_api(p_owner,p_action,p_invites,p_presence,p_badges,p_game)$$;
revoke all on function public.pp_settings(uuid,text,boolean,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.pp_settings(uuid,text,boolean,boolean,boolean,text) to authenticated;

create function pp_private.reply_api(p_owner uuid,p_game text,p_parent bigint,p_action text,p_body text default null,p_request uuid default null,p_after bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$declare me uuid:=auth.uid();root pp_private.game_comments;c pp_private.game_comments;result jsonb;begin
 select * into root from pp_private.game_comments where id=p_parent and game_id=p_game and parent_id is null and deleted_at is null and hidden_at is null;
 if not found or exists(select 1 from pp_private.player_blocks b where (b.blocker_id=me and b.blocked_id=root.player_id) or (b.blocked_id=me and b.blocker_id=root.player_id)) then raise exception 'COMMENT_UNAVAILABLE';end if;
 if p_action='read' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_id),'[]'::jsonb) into result from (select c.id::text as id,c.id as sort_id,c.body,c.created_at,p.player_id,p.handle,p.display_name,p.avatar_key from pp_private.game_comments c join public.profiles p on p.player_id=c.player_id where c.parent_id=p_parent and c.deleted_at is null and c.hidden_at is null and (p_after is null or c.id>p_after) and not exists(select 1 from pp_private.player_blocks b where (b.blocker_id=me and b.blocked_id=c.player_id) or (b.blocked_id=me and b.blocker_id=c.player_id)) order by c.id limit 20) x;return result;end if;
 me:=pp_private.checked_player(p_owner);
 if p_action<>'post' or p_body is null or char_length(btrim(p_body)) not between 1 and 1000 or p_request is null then raise exception 'INVALID_COMMENT';end if;
 perform pg_advisory_xact_lock(hashtextextended('feedback:'||me::text,0));
 perform 1 from pp_private.game_comments where id=p_parent and deleted_at is null and hidden_at is null for update;if not found then raise exception 'COMMENT_UNAVAILABLE';end if;
 select * into c from pp_private.game_comments where player_id=me and request_id=p_request;
 if found then
  if c.parent_id is distinct from p_parent or c.game_id<>p_game or c.body<>btrim(p_body) then raise exception 'DUPLICATE_CONFLICT';end if;
  if c.deleted_at is not null or c.hidden_at is not null then raise exception 'COMMENT_UNAVAILABLE';end if;return jsonb_build_object('id',c.id::text);end if;
 if (select count(*) from pp_private.game_comments where player_id=me and created_at>clock_timestamp()-interval '1 minute')>=3 or (select count(*) from pp_private.game_comments where player_id=me and created_at>clock_timestamp()-interval '1 day')>=30 then raise exception 'COMMENT_LIMIT';end if;
 insert into pp_private.game_comments(player_id,game_id,request_id,body,parent_id) values(me,p_game,p_request,btrim(p_body),p_parent) returning * into c;return jsonb_build_object('id',c.id::text);end $$;
revoke all on function pp_private.reply_api(uuid,text,bigint,text,text,uuid,bigint) from public,anon,authenticated;
grant execute on function pp_private.reply_api(uuid,text,bigint,text,text,uuid,bigint) to anon,authenticated;
create function public.pp_comment_thread(p_owner uuid,p_game text,p_parent bigint,p_action text,p_body text default null,p_request uuid default null,p_after bigint default null) returns jsonb language sql security invoker set search_path='' as $$select pp_private.reply_api(p_owner,p_game,p_parent,p_action,p_body,p_request,p_after)$$;
revoke all on function public.pp_comment_thread(uuid,text,bigint,text,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.pp_comment_thread(uuid,text,bigint,text,text,uuid,bigint) to anon,authenticated;

create function pp_private.reply_events() returns trigger language plpgsql security definer set search_path='' as $$declare recipient uuid;begin
 if new.parent_id is not null then select player_id into recipient from pp_private.game_comments where id=new.parent_id;
 if recipient<>new.player_id then insert into pp_private.reply_notifications(recipient_id,actor_id,comment_id,parent_id,game_id) values(recipient,new.player_id,new.id,new.parent_id,new.game_id);end if;end if;
 insert into pp_private.player_badges(player_id,badge) values(new.player_id,'first-comment') on conflict do nothing;return new;end $$;
revoke all on function pp_private.reply_events() from public,anon,authenticated;
create trigger comment_reply_events after insert on pp_private.game_comments for each row execute function pp_private.reply_events();
create function pp_private.notifications_api(p_owner uuid,p_action text,p_id bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$declare me uuid:=pp_private.checked_player(p_owner);result jsonb;total bigint;begin
 if p_action='read' then update pp_private.reply_notifications set read_at=coalesce(read_at,clock_timestamp()) where id=p_id and recipient_id=me;if not found then raise exception 'FORBIDDEN';end if;return jsonb_build_object('ok',true);elsif p_action<>'list' then raise exception 'INVALID_ACTION';end if;
 select count(*) into total from pp_private.reply_notifications n join pp_private.game_comments c on c.id=n.comment_id join pp_private.game_comments root on root.id=n.parent_id where n.recipient_id=me and n.read_at is null and c.deleted_at is null and c.hidden_at is null and root.deleted_at is null and root.hidden_at is null and not exists(select 1 from pp_private.player_blocks b where (b.blocker_id=me and b.blocked_id=n.actor_id) or (b.blocked_id=me and b.blocker_id=n.actor_id));
 select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_id desc),'[]'::jsonb) into result from (select n.id::text as id,n.id as sort_id,n.parent_id::text as parent_id,n.game_id,n.created_at,p.handle,p.display_name,p.avatar_key from pp_private.reply_notifications n join public.profiles p on p.player_id=n.actor_id join pp_private.game_comments c on c.id=n.comment_id join pp_private.game_comments root on root.id=n.parent_id where n.recipient_id=me and n.read_at is null and c.deleted_at is null and c.hidden_at is null and root.deleted_at is null and root.hidden_at is null and not exists(select 1 from pp_private.player_blocks b where (b.blocker_id=me and b.blocked_id=n.actor_id) or (b.blocked_id=me and b.blocker_id=n.actor_id)) order by n.id desc limit 50) x;return jsonb_build_object('rows',result,'unread',total);end $$;
revoke all on function pp_private.notifications_api(uuid,text,bigint) from public,anon,authenticated;
grant execute on function pp_private.notifications_api(uuid,text,bigint) to authenticated;
create function public.pp_notifications(p_owner uuid,p_action text,p_id bigint default null) returns jsonb language sql security invoker set search_path='' as $$select pp_private.notifications_api(p_owner,p_action,p_id)$$;
revoke all on function public.pp_notifications(uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.pp_notifications(uuid,text,bigint) to authenticated;

create function pp_private.award_badges() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_table_name='profiles' then insert into pp_private.player_badges(player_id,badge) values(new.player_id,'first-profile') on conflict do nothing;
 elsif tg_table_name='score_submissions' then
  insert into pp_private.player_badges(player_id,badge) values(new.player_id,'first-round') on conflict do nothing;
  if new.receipt->>'gameId'='quick-math' and new.receipt->>'verificationStatus'='validated' and (new.receipt->>'value')::int=5 then insert into pp_private.player_badges(player_id,badge) values(new.player_id,'perfect-five') on conflict do nothing;end if;
 elsif tg_table_name='friendships' and new.state='accepted' then insert into pp_private.player_badges(player_id,badge) values(new.low_id,'first-friend'),(new.high_id,'first-friend') on conflict do nothing;end if;return new;end $$;
revoke all on function pp_private.award_badges() from public,anon,authenticated;
create trigger profile_badge after insert on public.profiles for each row execute function pp_private.award_badges();
create trigger score_badge after insert on pp_private.score_submissions for each row execute function pp_private.award_badges();
create trigger friend_badge after insert or update on pp_private.friendships for each row execute function pp_private.award_badges();
insert into pp_private.player_badges(player_id,badge,earned_at) select player_id,'first-profile',created_at from public.profiles on conflict do nothing;
insert into pp_private.player_badges(player_id,badge) select distinct player_id,'first-round' from public.player_bests on conflict do nothing;
insert into pp_private.player_badges(player_id,badge) select distinct player_id,'perfect-five' from public.player_bests where game_id='quick-math' and value=5 and verification_status='validated' on conflict do nothing;
insert into pp_private.player_badges(player_id,badge) select low_id,'first-friend' from pp_private.friendships where state='accepted' union select high_id,'first-friend' from pp_private.friendships where state='accepted' on conflict do nothing;
insert into pp_private.player_badges(player_id,badge) select distinct player_id,'first-comment' from pp_private.game_comments where deleted_at is null and hidden_at is null on conflict do nothing;
create function pp_private.badges_read(p_player uuid) returns jsonb language sql stable security definer set search_path='' as $$select coalesce(jsonb_agg(jsonb_build_object('badge',badge,'earned_at',earned_at) order by earned_at,badge),'[]'::jsonb) from pp_private.player_badges where player_id=p_player and (p_player=auth.uid() or coalesce((select show_badges from pp_private.player_settings where player_id=p_player),true))$$;
revoke all on function pp_private.badges_read(uuid) from public,anon,authenticated;
grant execute on function pp_private.badges_read(uuid) to anon,authenticated;
create function public.pp_badges(p_player uuid) returns jsonb language sql security invoker set search_path='' as $$select pp_private.badges_read(p_player)$$;
revoke all on function public.pp_badges(uuid) from public,anon,authenticated;
grant execute on function public.pp_badges(uuid) to anon,authenticated;

create function pp_private.moderation_api(p_owner uuid,p_action text,p_report uuid default null,p_kind text default null,p_comment bigint default null,p_target uuid default null,p_handle text default null,p_days integer default null,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$declare me uuid:=pp_private.checked_player(p_owner);result jsonb;target uuid;begin
 if not exists(select 1 from pp_private.moderators where player_id=me) then raise exception 'MODERATOR_REQUIRED';end if;
 if p_action='list' then
  if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'INVALID_PAGE';end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) into result from (
   select * from (select r.id,r.kind,r.reason,r.details,r.snapshot,r.created_at,r.target_id,p.handle,p.display_name,null::text as comment_id from pp_private.player_reports r join public.profiles p on p.player_id=r.target_id where r.handled_at is null union all select r.id,'comment',r.reason,''::text,r.snapshot,r.created_at,c.player_id,p.handle,p.display_name,c.id::text from pp_private.game_comment_reports r join pp_private.game_comments c on c.id=r.comment_id join public.profiles p on p.player_id=c.player_id where r.handled_at is null) pending order by created_at desc,id limit 50 offset p_offset
  ) x;return result;
 elsif p_action='account' then
  if p_handle is null or p_handle !~ '^[a-z0-9_]{3,20}$' then raise exception 'INVALID_TARGET';end if;
  select jsonb_build_object('player_id',p.player_id,'handle',p.handle,'display_name',p.display_name,'banned_until',u.banned_until,'moderator',exists(select 1 from pp_private.moderators where player_id=p.player_id)) into result from public.profiles p join auth.users u on u.id=p.player_id where p.handle=p_handle;return result;
 elsif p_action in ('hide_comment','restore_comment') then
  update pp_private.game_comments set hidden_at=case when p_action='hide_comment' then clock_timestamp() else null end where id=p_comment returning player_id into target;if not found then raise exception 'INVALID_COMMENT';end if;
 elsif p_action='resolve' then
  if p_kind='comment' then update pp_private.game_comment_reports set handled_at=coalesce(handled_at,clock_timestamp()) where id=p_report;else update pp_private.player_reports set handled_at=coalesce(handled_at,clock_timestamp()) where id=p_report;end if;
  if not found then raise exception 'INVALID_REPORT';end if;
 elsif p_action in ('ban','unban') then
  if p_target is null or p_target=me or exists(select 1 from pp_private.moderators where player_id=p_target) then raise exception 'PROTECTED_ACCOUNT';end if;
  if p_action='ban' and (p_days is null or p_days not in (1,7)) then raise exception 'INVALID_DURATION';end if;
  update auth.users set banned_until=case when p_action='ban' then clock_timestamp()+make_interval(days=>p_days) else null end where id=p_target;if not found then raise exception 'INVALID_TARGET';end if;target:=p_target;
 else raise exception 'INVALID_ACTION';end if;
 insert into pp_private.moderation_audit(actor_id,action,details) values(me,p_action,jsonb_build_object('target',target,'report',p_report,'kind',p_kind,'comment',p_comment,'days',p_days));return jsonb_build_object('ok',true);end $$;
revoke all on function pp_private.moderation_api(uuid,text,uuid,text,bigint,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function pp_private.moderation_api(uuid,text,uuid,text,bigint,uuid,text,integer,integer) to authenticated;
create function public.pp_moderation(p_owner uuid,p_action text,p_report uuid default null,p_kind text default null,p_comment bigint default null,p_target uuid default null,p_handle text default null,p_days integer default null,p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$select pp_private.moderation_api(p_owner,p_action,p_report,p_kind,p_comment,p_target,p_handle,p_days,p_offset)$$;
revoke all on function public.pp_moderation(uuid,text,uuid,text,bigint,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.pp_moderation(uuid,text,uuid,text,bigint,uuid,text,integer,integer) to authenticated;
