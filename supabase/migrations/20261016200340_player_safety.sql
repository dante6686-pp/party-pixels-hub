
create table pp_private.player_blocks(
 blocker_id uuid not null references public.profiles(player_id) on delete cascade,
 blocked_id uuid not null references public.profiles(player_id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
create index blocks_target on pp_private.player_blocks(blocked_id);
create table pp_private.player_reports(
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references public.profiles(player_id) on delete cascade,
 target_id uuid not null references public.profiles(player_id) on delete cascade,
 request_id uuid not null,
 kind text not null check(kind in ('profile','message')),
 reason text not null check(reason in ('harassment','spam','inappropriate','other')),
 details text not null check(char_length(details)<=1000),
 snapshot jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(reporter_id,request_id),check(reporter_id<>target_id)
);
create index reports_target on pp_private.player_reports(target_id);
create index reports_owner_time on pp_private.player_reports(reporter_id,created_at desc);
alter table pp_private.player_blocks enable row level security;
alter table pp_private.player_reports enable row level security;
revoke all on pp_private.player_blocks,pp_private.player_reports from public,anon,authenticated;

create function pp_private.safety_api(p_owner uuid,p_action text,p_peer uuid default null,p_message bigint default null,p_reason text default null,p_details text default '',p_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();lo uuid;hi uuid;r pp_private.player_reports;snapshot jsonb;target uuid;result jsonb;
begin
 if me is null or me is distinct from p_owner then raise exception 'PLAYER_CHANGED';end if;
 if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and (banned_until is null or banned_until<now())) or not exists(select 1 from public.profiles where player_id=me) then raise exception 'PROFILE_REQUIRED';end if;
 if p_action='blocks' then
  select coalesce(jsonb_agg(jsonb_build_object('player_id',p.player_id,'handle',p.handle,'display_name',p.display_name,'avatar_key',p.avatar_key) order by p.handle),'[]'::jsonb) into result from pp_private.player_blocks b join public.profiles p on p.player_id=b.blocked_id where b.blocker_id=me;return result;
 end if;
 if p_peer is null or p_peer=me or not exists(select 1 from public.profiles where player_id=p_peer) then raise exception 'INVALID_TARGET';end if;
 lo:=least(me,p_peer);hi:=greatest(me,p_peer);
 if p_action='status' then return jsonb_build_object('blocked_by_me',exists(select 1 from pp_private.player_blocks where blocker_id=me and blocked_id=p_peer),'contact_allowed',not exists(select 1 from pp_private.player_blocks where (blocker_id=me and blocked_id=p_peer) or (blocker_id=p_peer and blocked_id=me)));end if;
 perform pg_advisory_xact_lock(hashtextextended('friends:'||lo::text,0));
 perform pg_advisory_xact_lock(hashtextextended('friends:'||hi::text,0));
 if p_action='block' then
  insert into pp_private.player_blocks(blocker_id,blocked_id) values(me,p_peer) on conflict do nothing;
  update pp_private.friendships set state='closed',closed_reason='cancel',updated_at=now() where low_id=lo and high_id=hi and state<>'closed';
  return jsonb_build_object('ok',true);
 elsif p_action='unblock' then
  delete from pp_private.player_blocks where blocker_id=me and blocked_id=p_peer;return jsonb_build_object('ok',true);
 elsif p_action in ('report_profile','report_message') then
  if p_request is null or p_reason is null or p_reason not in ('harassment','spam','inappropriate','other') or p_details is null or char_length(p_details)>1000 then raise exception 'INVALID_REPORT';end if;
  select * into r from pp_private.player_reports where reporter_id=me and request_id=p_request;
  if found then
   if r.target_id<>p_peer or r.reason<>p_reason or r.details<>btrim(p_details) or r.kind<>replace(p_action,'report_','') or (r.snapshot->>'message_id')::bigint is distinct from p_message then raise exception 'DUPLICATE_CONFLICT';end if;
   return jsonb_build_object('id',r.id);
  end if;
  if (select count(*) from pp_private.player_reports where reporter_id=me and created_at>clock_timestamp()-interval '1 day')>=10 then raise exception 'REPORT_LIMIT';end if;
  if p_action='report_message' then
   select jsonb_build_object('message_id',m.id::text,'body',m.body,'created_at',m.created_at) into snapshot from pp_private.direct_messages m where m.id=p_message and me in(m.low_id,m.high_id) and m.sender_id=p_peer;
   if snapshot is null then raise exception 'INVALID_MESSAGE';end if;
  else
   if p_message is not null then raise exception 'INVALID_REPORT';end if;
   select jsonb_build_object('handle',handle,'display_name',display_name,'bio',bio,'avatar_key',avatar_key,'banner_key',banner_key) into snapshot from public.profiles where player_id=p_peer;
  end if;
  insert into pp_private.player_reports(reporter_id,target_id,request_id,kind,reason,details,snapshot) values(me,p_peer,p_request,replace(p_action,'report_',''),p_reason,btrim(p_details),snapshot) returning * into r;
  return jsonb_build_object('id',r.id);
 end if;
 raise exception 'INVALID_ACTION';
end $$;
revoke all on function pp_private.safety_api(uuid,text,uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function pp_private.safety_api(uuid,text,uuid,bigint,text,text,uuid) to authenticated;
create function public.pp_safety(p_owner uuid,p_action text,p_peer uuid default null,p_message bigint default null,p_reason text default null,p_details text default '',p_request uuid default null) returns jsonb language sql security invoker set search_path='' as $$select pp_private.safety_api(p_owner,p_action,p_peer,p_message,p_reason,p_details,p_request)$$;
revoke all on function public.pp_safety(uuid,text,uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.pp_safety(uuid,text,uuid,bigint,text,text,uuid) to authenticated;

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

create or replace function pp_private.messages_api(p_owner uuid,p_action text,p_peer uuid default null,p_body text default null,p_request uuid default null,p_before bigint default null,p_read bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();lo uuid;hi uuid;r pp_private.direct_messages;result jsonb;can_send boolean;
begin
 if me is null or me is distinct from p_owner then raise exception 'PLAYER_CHANGED';end if;
 if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and (banned_until is null or banned_until<now())) or not exists(select 1 from public.profiles where player_id=me) then raise exception 'PROFILE_REQUIRED';end if;
 if p_action='inbox' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.latest_id desc),'[]'::jsonb) into result from (
   select p.player_id,p.handle,p.display_name,p.avatar_key,left(m.body,100) as preview,m.created_at,
   m.id as latest_id,
   exists(select 1 from pp_private.direct_messages u where u.low_id=m.low_id and u.high_id=m.high_id and u.sender_id<>me and u.id>coalesce(rr.last_id,0)) as unread
   from (select distinct on(low_id,high_id) * from pp_private.direct_messages where me in(low_id,high_id) and not exists(select 1 from pp_private.player_blocks bb where bb.blocker_id in(low_id,high_id) and bb.blocked_id in(low_id,high_id)) order by low_id,high_id,id desc) m
   join public.profiles p on p.player_id=case when m.low_id=me then m.high_id else m.low_id end
   left join pp_private.direct_message_reads rr on rr.player_id=me and rr.peer_id=p.player_id
   order by m.id desc limit 200
  ) x;return result;
 end if;
 if p_peer is null or p_peer=me then raise exception 'INVALID_PEER';end if;
 lo:=least(me,p_peer);hi:=greatest(me,p_peer);
 if p_action='send' and exists(select 1 from pp_private.player_blocks where (blocker_id=me and blocked_id=p_peer) or (blocker_id=p_peer and blocked_id=me)) then raise exception 'CONTACT_UNAVAILABLE';end if;
 if p_action='send' then
  perform pg_advisory_xact_lock(hashtextextended('friends:'||lo::text,0));
  perform pg_advisory_xact_lock(hashtextextended('friends:'||hi::text,0));
  if p_request is null or p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'INVALID_MESSAGE';end if;
  select * into r from pp_private.direct_messages where sender_id=me and request_id=p_request;
  if found then
   if r.low_id<>lo or r.high_id<>hi or r.body<>btrim(p_body) then raise exception 'DUPLICATE_CONFLICT';end if;
   return jsonb_build_object('id',r.id::text);
  end if;
  if not exists(select 1 from pp_private.friendships where low_id=lo and high_id=hi and state='accepted') then raise exception 'FRIENDS_ONLY';end if;
  if (select count(*) from pp_private.direct_messages where sender_id=me and created_at>clock_timestamp()-interval '1 minute')>=30 then raise exception 'RATE_LIMIT';end if;
  insert into pp_private.direct_messages(low_id,high_id,sender_id,request_id,body) values(lo,hi,me,p_request,btrim(p_body)) returning * into r;
  return jsonb_build_object('id',r.id::text);
 elsif p_action='history' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_id),'[]'::jsonb) into result from (
   select m.id::text as id,m.id as sort_id,m.sender_id,m.body,m.created_at from pp_private.direct_messages m where m.low_id=lo and m.high_id=hi and (p_before is null or m.id<p_before) order by m.id desc limit 50
  ) x;
  select exists(select 1 from pp_private.friendships where low_id=lo and high_id=hi and state='accepted') and not exists(select 1 from pp_private.player_blocks where (blocker_id=me and blocked_id=p_peer) or (blocker_id=p_peer and blocked_id=me)) into can_send;
  return jsonb_build_object('messages',result,'can_send',can_send);
 elsif p_action='read' then
  if p_read is null or not exists(select 1 from pp_private.direct_messages where id=p_read and low_id=lo and high_id=hi) then raise exception 'INVALID_READ';end if;
  insert into pp_private.direct_message_reads(player_id,peer_id,last_id) values(me,p_peer,p_read)
  on conflict(player_id,peer_id) do update set last_id=greatest(pp_private.direct_message_reads.last_id,excluded.last_id);
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'INVALID_ACTION';
end $$;
