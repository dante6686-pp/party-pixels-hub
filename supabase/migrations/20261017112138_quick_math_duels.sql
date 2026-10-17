create table pp_private.duels(
 id uuid primary key default gen_random_uuid(),host uuid not null references public.profiles(player_id) on delete cascade,guest uuid not null references public.profiles(player_id) on delete cascade,
 state text not null default 'invited' check(state in('invited','lobby','playing','finished','cancelled','expired')),round integer not null default 1,
 host_ready boolean not null default false,guest_ready boolean not null default false,host_seen timestamptz not null default now(),guest_seen timestamptz,
 created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '5 minutes'),starts_at timestamptz,
 questions jsonb,solutions jsonb,host_score integer,guest_score integer,host_ms integer,guest_ms integer,winner uuid,reason text,
 check(host<>guest));
create index duels_host_time on pp_private.duels(host,created_at desc);
create index duels_guest_time on pp_private.duels(guest,created_at desc);
alter table pp_private.duels enable row level security;
revoke all on pp_private.duels from public,anon,authenticated;
create function public.pp_duel(p_action text,p_room uuid default null,p_peer uuid default null,p_round integer default null,p_answers jsonb default null,p_request uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();r pp_private.duels; peer uuid; qs jsonb:='[]';sol jsonb:='[]';a integer;b integer;i integer;op text;ans integer;score integer:=0;elapsed integer;now_at timestamptz:=clock_timestamp();
begin
 if me is null or not exists(select 1 from public.profiles where player_id=me) or not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and (banned_until is null or banned_until<now_at)) then raise exception 'PROFILE_REQUIRED';end if;
 if p_action='list' then
 return (select coalesce(jsonb_agg(x order by x.created_at desc),'[]') from(select d.id,d.host,d.guest,d.state,d.round,d.created_at,d.expires_at,p.handle,p.display_name from pp_private.duels d join public.profiles p on p.player_id=case when d.host=me then d.guest else d.host end where me in(d.host,d.guest) and ((d.state in('invited','lobby','playing') and d.expires_at>now_at) or(d.state='finished' and d.expires_at>now_at-interval '15 minutes')) and not exists(select 1 from pp_private.player_blocks where (blocker_id=me and blocked_id=p.player_id)or(blocker_id=p.player_id and blocked_id=me)) order by d.created_at desc limit 20)x);
 end if;
 if p_action='create' then
  if p_peer is null or p_peer=me or p_request is null then raise exception 'INVALID_PEER';end if;
  perform pg_advisory_xact_lock(hashtextextended(least(me,p_peer)::text,0));perform pg_advisory_xact_lock(hashtextextended(greatest(me,p_peer)::text,0));
  select * into r from pp_private.duels where id=p_request;
  if found then if r.host=me and r.guest=p_peer then p_room:=r.id;else raise exception 'REQUEST_CONFLICT';end if;
  else
   if not exists(select 1 from pp_private.friendships where low_id=least(me,p_peer) and high_id=greatest(me,p_peer) and state='accepted') or exists(select 1 from pp_private.player_blocks where(blocker_id=me and blocked_id=p_peer)or(blocker_id=p_peer and blocked_id=me)) then raise exception 'FRIENDS_ONLY';end if;
   if exists(select 1 from auth.users where id=p_peer and banned_until>now_at) then raise exception 'FRIENDS_ONLY';end if;
   if (select count(*) from pp_private.duels where host=me and created_at>now_at-interval '1 day')>=20 then raise exception 'INVITE_LIMIT';end if;
   if exists(select 1 from pp_private.duels where state in('invited','lobby','playing') and expires_at>now_at and (host in(me,p_peer) or guest in(me,p_peer))) then raise exception 'PLAYER_BUSY';end if;
   insert into pp_private.duels(id,host,guest)values(p_request,me,p_peer) returning * into r;p_room:=r.id;
  end if;
 end if;
 select * into r from pp_private.duels where id=p_room for update;
 if not found or me not in(r.host,r.guest) then raise exception 'ROOM_UNAVAILABLE';end if;
 peer:=case when me=r.host then r.guest else r.host end;
 if r.state in('invited','lobby','playing') then
  if exists(select 1 from pp_private.player_blocks where(blocker_id=me and blocked_id=peer)or(blocker_id=peer and blocked_id=me)) or exists(select 1 from auth.users where id=peer and banned_until>now_at) then r.state:='cancelled';r.reason:='contact';
  elsif r.expires_at<=now_at then if r.state='playing' then r.state:='finished';r.reason:='timeout';else r.state:='expired';r.reason:='expired';end if;
  elsif r.state in('lobby','playing') and (r.host_seen<now_at-interval '45 seconds' or coalesce(r.guest_seen,r.created_at)<now_at-interval '45 seconds') then
   if r.state='playing' then r.state:='finished';r.reason:='disconnect';r.winner:=case when r.host_seen<now_at-interval '45 seconds' and r.guest_seen<now_at-interval '45 seconds' then null when r.host_seen<now_at-interval '45 seconds' then r.guest else r.host end;else r.state:='cancelled';r.reason:='disconnect';end if;
  end if;
 end if;
 if p_action in('get','create','accept','ready','submit','rematch') then if me=r.host then r.host_seen:=now_at;else r.guest_seen:=now_at;end if;end if;
 if p_action='accept' and r.state='invited' and me=r.guest then
  if not exists(select 1 from pp_private.friendships where low_id=least(me,peer)and high_id=greatest(me,peer)and state='accepted') then raise exception 'FRIENDS_ONLY';end if;
  r.state:='lobby';r.expires_at:=now_at+interval '5 minutes';r.host_seen:=now_at;r.guest_seen:=now_at;
 elsif p_action='leave' and r.state in('invited','lobby','playing') then
  if r.state='playing' then r.state:='finished';r.winner:=peer;r.reason:='leave';else r.state:='cancelled';r.reason:='leave';end if;
 elsif p_action in('ready','rematch') then
  if p_round is distinct from r.round then raise exception 'STALE_ROUND';end if;
  if (p_action='ready' and r.state='lobby')or(p_action='rematch' and r.state='finished') then
   if exists(select 1 from pp_private.player_blocks where(blocker_id=me and blocked_id=peer)or(blocker_id=peer and blocked_id=me)) then raise exception 'FRIENDS_ONLY';end if;
   if me=r.host then r.host_ready:=true;else r.guest_ready:=true;end if;
   if r.host_ready and r.guest_ready then
    if p_action='rematch' then r.round:=r.round+1;end if;
    for i in 1..5 loop a:=floor(random()*20)::int+1;b:=floor(random()*20)::int+1;op:=case when random()<0.5 then '+' else '-' end;qs:=qs||jsonb_build_array(jsonb_build_object('a',a,'b',b,'op',op));sol:=sol||to_jsonb(case when op='+' then a+b else a-b end);end loop;
    r.questions:=qs;r.solutions:=sol;r.starts_at:=now_at+interval '5 seconds';r.expires_at:=r.starts_at+interval '2 minutes';r.state:='playing';r.host_score:=null;r.guest_score:=null;r.host_ms:=null;r.guest_ms:=null;r.winner:=null;r.reason:=null;r.host_ready:=false;r.guest_ready:=false;r.host_seen:=now_at;r.guest_seen:=now_at;
   end if;
  end if;
 elsif p_action='submit' then
  if p_round is distinct from r.round then raise exception 'STALE_ROUND';end if;
  if r.state='playing' and now_at>=r.starts_at then
   if (me=r.host and r.host_score is null)or(me=r.guest and r.guest_score is null) then
    if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)<>5 then raise exception 'INVALID_ANSWERS';end if;
    for i in 0..4 loop if jsonb_typeof(p_answers->i)='number' and (p_answers->>i)~'^-?[0-9]{1,4}$' and (p_answers->>i)::int=(r.solutions->>i)::int then score:=score+1;end if;end loop;
    elapsed:=greatest(0,floor(extract(epoch from(now_at-r.starts_at))*1000)::int);
    if me=r.host then r.host_score:=score;r.host_ms:=elapsed;else r.guest_score:=score;r.guest_ms:=elapsed;end if;
   end if;
   if r.host_score is not null and r.guest_score is not null then r.state:='finished';r.reason:='completed';end if;
  end if;
 elsif p_action not in('get','create','accept','leave') then raise exception 'INVALID_ACTION';
 end if;
 if r.state='finished' and r.reason in('completed','timeout') then
  if r.host_score is null and r.guest_score is null then r.winner:=null;
  elsif r.host_score is null then r.winner:=r.guest;
  elsif r.guest_score is null then r.winner:=r.host;
  elsif r.host_score>r.guest_score or(r.host_score=r.guest_score and r.host_ms<r.guest_ms)then r.winner:=r.host;
  elsif r.guest_score>r.host_score or(r.host_score=r.guest_score and r.guest_ms<r.host_ms)then r.winner:=r.guest;else r.winner:=null;end if;
 end if;
 update pp_private.duels set state=r.state,round=r.round,host_ready=r.host_ready,guest_ready=r.guest_ready,host_seen=r.host_seen,guest_seen=r.guest_seen,expires_at=r.expires_at,starts_at=r.starts_at,questions=r.questions,solutions=r.solutions,host_score=r.host_score,guest_score=r.guest_score,host_ms=r.host_ms,guest_ms=r.guest_ms,winner=r.winner,reason=r.reason where id=r.id;
 return jsonb_build_object('id',r.id,'state',r.state,'round',r.round,'host',r.host,'guest',r.guest,'host_ready',r.host_ready,'guest_ready',r.guest_ready,'starts_at',r.starts_at,'expires_at',r.expires_at,'server_now',now_at,'host_seen',r.host_seen,'guest_seen',r.guest_seen,'questions',case when r.state in('playing','finished')and now_at>=r.starts_at then r.questions else null end,'submitted',case when me=r.host then r.host_score is not null else r.guest_score is not null end,'peer_submitted',case when me=r.host then r.guest_score is not null else r.host_score is not null end,'host_score',case when r.state='finished' then r.host_score else null end,'guest_score',case when r.state='finished' then r.guest_score else null end,'host_ms',case when r.state='finished' then r.host_ms else null end,'guest_ms',case when r.state='finished' then r.guest_ms else null end,'winner',r.winner,'reason',r.reason,'players',(select jsonb_agg(jsonb_build_object('id',player_id,'handle',handle,'name',display_name,'avatar',avatar_key))from public.profiles where player_id in(r.host,r.guest)));
end $$;
revoke all on function public.pp_duel(text,uuid,uuid,integer,jsonb,uuid) from public,anon;
grant execute on function public.pp_duel(text,uuid,uuid,integer,jsonb,uuid) to authenticated;
