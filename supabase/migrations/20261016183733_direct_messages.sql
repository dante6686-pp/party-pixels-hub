
create table pp_private.direct_messages(
 id bigint generated always as identity primary key,
 low_id uuid not null references public.profiles(player_id) on delete cascade,
 high_id uuid not null references public.profiles(player_id) on delete cascade,
 sender_id uuid not null references public.profiles(player_id) on delete cascade,
 request_id uuid not null,
 body text not null check(char_length(body) between 1 and 2000),
 created_at timestamptz not null default clock_timestamp(),
 check(low_id<high_id),check(sender_id in(low_id,high_id)),unique(sender_id,request_id)
);
create index dm_pair_history on pp_private.direct_messages(low_id,high_id,id desc);
create index dm_high on pp_private.direct_messages(high_id,id desc);
create index dm_sender_time on pp_private.direct_messages(sender_id,created_at desc);
create table pp_private.direct_message_reads(
 player_id uuid references public.profiles(player_id) on delete cascade,
 peer_id uuid references public.profiles(player_id) on delete cascade,
 last_id bigint not null default 0,
 primary key(player_id,peer_id)
);
create index dm_reads_peer on pp_private.direct_message_reads(peer_id);
alter table pp_private.direct_messages enable row level security;
alter table pp_private.direct_message_reads enable row level security;
revoke all on pp_private.direct_messages,pp_private.direct_message_reads from public,anon,authenticated;
revoke all on sequence pp_private.direct_messages_id_seq from public,anon,authenticated;

create function pp_private.messages_api(p_owner uuid,p_action text,p_peer uuid default null,p_body text default null,p_request uuid default null,p_before bigint default null,p_read bigint default null)
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
   from (select distinct on(low_id,high_id) * from pp_private.direct_messages where me in(low_id,high_id) order by low_id,high_id,id desc) m
   join public.profiles p on p.player_id=case when m.low_id=me then m.high_id else m.low_id end
   left join pp_private.direct_message_reads rr on rr.player_id=me and rr.peer_id=p.player_id
   order by m.id desc limit 200
  ) x;return result;
 end if;
 if p_peer is null or p_peer=me then raise exception 'INVALID_PEER';end if;
 lo:=least(me,p_peer);hi:=greatest(me,p_peer);
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
   select id::text as id,id as sort_id,sender_id,body,created_at from pp_private.direct_messages where low_id=lo and high_id=hi and (p_before is null or id<p_before) order by id desc limit 50
  ) x;
  select exists(select 1 from pp_private.friendships where low_id=lo and high_id=hi and state='accepted') into can_send;
  return jsonb_build_object('messages',result,'can_send',can_send);
 elsif p_action='read' then
  if p_read is null or not exists(select 1 from pp_private.direct_messages where id=p_read and low_id=lo and high_id=hi) then raise exception 'INVALID_READ';end if;
  insert into pp_private.direct_message_reads(player_id,peer_id,last_id) values(me,p_peer,p_read)
  on conflict(player_id,peer_id) do update set last_id=greatest(pp_private.direct_message_reads.last_id,excluded.last_id);
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'INVALID_ACTION';
end $$;
revoke all on function pp_private.messages_api(uuid,text,uuid,text,uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function pp_private.messages_api(uuid,text,uuid,text,uuid,bigint,bigint) to authenticated;
create function public.pp_messages(p_owner uuid,p_action text,p_peer uuid default null,p_body text default null,p_request uuid default null,p_before bigint default null,p_read bigint default null)
returns jsonb language sql security invoker set search_path='' as $$select pp_private.messages_api(p_owner,p_action,p_peer,p_body,p_request,p_before,p_read)$$;
revoke all on function public.pp_messages(uuid,text,uuid,text,uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.pp_messages(uuid,text,uuid,text,uuid,bigint,bigint) to authenticated;
