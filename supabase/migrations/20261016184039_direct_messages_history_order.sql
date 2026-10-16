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
   select m.id::text as id,m.id as sort_id,m.sender_id,m.body,m.created_at from pp_private.direct_messages m where m.low_id=lo and m.high_id=hi and (p_before is null or m.id<p_before) order by m.id desc limit 50
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
