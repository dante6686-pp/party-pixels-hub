-- Private relationship state; clients use the checked API below.
create table pp_private.friendships (
 low_id uuid references public.profiles(player_id) on delete cascade,
 high_id uuid references public.profiles(player_id) on delete cascade,
 sender_id uuid not null references public.profiles(player_id) on delete cascade,
 request_id uuid not null default gen_random_uuid(),
 state text not null check(state in ('pending','accepted','closed')),
 updated_at timestamptz not null default now(),
 primary key(low_id,high_id), check(low_id < high_id),
 check(sender_id in (low_id,high_id))
);
create index friendships_high on pp_private.friendships(high_id);
create index friendships_sender on pp_private.friendships(sender_id);
alter table pp_private.friendships enable row level security;
revoke all on pp_private.friendships from public,anon,authenticated;

create function pp_private.friends_api(p_owner uuid,p_action text,p_target uuid default null,p_request uuid default null,p_query text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); lo uuid; hi uuid; r pp_private.friendships; result jsonb;
begin
 if me is null or me is distinct from p_owner then raise exception 'PLAYER_CHANGED'; end if;
 if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and (banned_until is null or banned_until<now())) or not exists(select 1 from public.profiles where player_id=me) then raise exception 'PROFILE_REQUIRED'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('player_id',p.player_id,'handle',p.handle,'display_name',p.display_name,'avatar_key',p.avatar_key,'request_id',f.request_id,'relation',case when f.state='accepted' then 'friend' when f.sender_id=me then 'outgoing' else 'incoming' end) order by p.handle),'[]'::jsonb) into result
  from pp_private.friendships f join public.profiles p on p.player_id=case when f.low_id=me then f.high_id else f.low_id end
  where (f.low_id=me or f.high_id=me) and f.state<>'closed';
  return result;
 elsif p_action='search' then
  if p_query is null or p_query !~ '^[a-z0-9_]{3,20}$' then raise exception 'INVALID_QUERY'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select p.player_id,p.handle,p.display_name,p.avatar_key,f.request_id,
    case when f.state='accepted' then 'friend' when f.state='pending' then case when f.sender_id=me then 'outgoing' else 'incoming' end else 'none' end as relation
   from public.profiles p left join pp_private.friendships f on f.low_id=least(me,p.player_id) and f.high_id=greatest(me,p.player_id)
   where p.player_id<>me and left(p.handle,length(p_query))=p_query
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
  if r.updated_at>now()-interval '1 day' then raise exception 'COOLDOWN'; end if;
  if (select count(*) from pp_private.friendships where state<>'closed' and (low_id=me or high_id=me))>=200 or (select count(*) from pp_private.friendships where state<>'closed' and (low_id=p_target or high_id=p_target))>=200 or (select count(*) from pp_private.friendships where sender_id=me and state='pending')>=20 then raise exception 'FRIEND_LIMIT'; end if;
  insert into pp_private.friendships(low_id,high_id,sender_id,state) values(lo,hi,me,'pending') on conflict(low_id,high_id) do update set sender_id=me,state='pending',request_id=gen_random_uuid(),updated_at=now();
 else
  if r.request_id is null or p_request is distinct from r.request_id then raise exception 'STALE_REQUEST'; end if;
  if p_action='accept' and r.sender_id<>me and r.state in ('pending','accepted') then
   update pp_private.friendships set state='accepted',updated_at=now() where low_id=lo and high_id=hi;
  elsif (p_action='decline' and r.sender_id<>me and r.state='pending') or (p_action='cancel' and r.sender_id=me and r.state='pending') or (p_action='remove' and r.state='accepted') then
   update pp_private.friendships set state='closed',updated_at=now() where low_id=lo and high_id=hi;
  elsif r.state<>'closed' then raise exception 'INVALID_TRANSITION'; end if;
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function pp_private.friends_api(uuid,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function pp_private.friends_api(uuid,text,uuid,uuid,text) to authenticated;
create function public.pp_friends(p_owner uuid,p_action text,p_target uuid default null,p_request uuid default null,p_query text default '') returns jsonb language sql security invoker set search_path='' as $$ select pp_private.friends_api(p_owner,p_action,p_target,p_request,p_query) $$;
revoke all on function public.pp_friends(uuid,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.pp_friends(uuid,text,uuid,uuid,text) to authenticated;
