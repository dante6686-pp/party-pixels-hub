create table public.hub_brand(id boolean primary key default true check(id),variant text not null default 'base' check(variant in('base','halloween','valentine')),revision bigint not null default 0);
alter table public.hub_brand enable row level security;
revoke all on public.hub_brand from public,anon,authenticated;grant select on public.hub_brand to anon,authenticated;
create policy brand_read on public.hub_brand for select to anon,authenticated using(true);
insert into public.hub_brand(id)values(true);
create function public.pp_brand(p_variant text,p_expected bigint)returns jsonb language plpgsql security definer set search_path='' as $$declare r public.hub_brand;begin
 if auth.uid() is null or not exists(select 1 from pp_private.style_editors where player_id=auth.uid()) or exists(select 1 from auth.users where id=auth.uid()and banned_until>now())then raise exception 'EDITOR_REQUIRED';end if;
 if p_variant not in('base','halloween','valentine')or p_variant is null then raise exception 'INVALID_VARIANT';end if;
 select * into r from public.hub_brand where id=true for update;if r.revision is distinct from p_expected then raise exception 'REVISION_CONFLICT';end if;
 update public.hub_brand set variant=p_variant,revision=revision+1 where id=true returning * into r;return to_jsonb(r);end $$;
revoke all on function public.pp_brand(text,bigint) from public,anon;grant execute on function public.pp_brand(text,bigint) to authenticated;
create table pp_private.starter_accounts(player_id uuid primary key references public.profiles(player_id)on delete cascade,created_at timestamptz not null default now(),frame boolean not null default false,banner boolean not null default false,title boolean not null default false,pinned jsonb not null default '[]');
create table pp_private.starter_tasks(player_id uuid not null references public.profiles(player_id)on delete cascade,task text not null check(task in('round','perfect','timing','duel','rematch','days')),earned_at timestamptz not null default now(),claimed_at timestamptz,primary key(player_id,task));
create table pp_private.starter_days(player_id uuid not null references public.profiles(player_id)on delete cascade,day date not null,primary key(player_id,day));
create table pp_private.starter_rewards(player_id uuid not null references public.profiles(player_id)on delete cascade,reward text not null check(reward in('welcome','frame','banner','finish')),earned_at timestamptz not null default now(),primary key(player_id,reward));
create table pp_private.pixel_ledger(player_id uuid not null references public.profiles(player_id)on delete cascade,source text not null,amount integer not null check(amount=20),xp integer not null check(xp in(100,150,200)),created_at timestamptz not null default now(),primary key(player_id,source));
alter table pp_private.starter_accounts enable row level security;alter table pp_private.starter_tasks enable row level security;alter table pp_private.starter_days enable row level security;alter table pp_private.starter_rewards enable row level security;alter table pp_private.pixel_ledger enable row level security;
revoke all on pp_private.starter_accounts,pp_private.starter_tasks,pp_private.starter_days,pp_private.starter_rewards,pp_private.pixel_ledger from public,anon,authenticated;
create function pp_private.starter_points(p_task text)returns integer language sql immutable set search_path='' as $$select case p_task when 'round'then 10 when 'perfect'then 20 when 'timing'then 15 when 'duel'then 20 when 'rematch'then 15 when 'days'then 20 else 0 end$$;
revoke all on function pp_private.starter_points(text)from public,anon,authenticated;
create function pp_private.starter_sync(p_player uuid)returns void language plpgsql security definer set search_path='' as $$begin
 insert into pp_private.starter_accounts(player_id)values(p_player)on conflict do nothing;
 perform 1 from pp_private.starter_accounts where player_id=p_player for update;
 insert into pp_private.starter_tasks(player_id,task)select p_player,'round'where exists(select 1 from pp_private.score_submissions where player_id=p_player and receipt->>'gameId'='quick-math' and receipt->>'verificationStatus'='validated')on conflict do nothing;
 insert into pp_private.starter_tasks(player_id,task)select p_player,'perfect'where exists(select 1 from pp_private.score_submissions where player_id=p_player and receipt->>'gameId'='quick-math'and receipt->>'verificationStatus'='validated'and(receipt->>'value')::int=5)on conflict do nothing;
 insert into pp_private.starter_tasks(player_id,task)select p_player,'timing'where exists(select 1 from pp_private.score_submissions where player_id=p_player and receipt->>'gameId'='two-seconds'and(receipt->>'value')::int<=200)on conflict do nothing;
 insert into pp_private.starter_tasks(player_id,task)select p_player,'duel'where exists(select 1 from pp_private.duels where p_player in(host,guest)and state='finished'and reason='completed')on conflict do nothing;
 insert into pp_private.starter_tasks(player_id,task)select p_player,'rematch'where exists(select 1 from pp_private.duels where p_player in(host,guest)and state='finished'and reason='completed'and round>=2)on conflict do nothing;
 insert into pp_private.starter_days(player_id,day)select p_player,(s.started_at at time zone 'Europe/Warsaw')::date from pp_private.game_sessions s join pp_private.score_submissions x on x.session_id=s.id where s.player_id=p_player on conflict do nothing;
 insert into pp_private.starter_days(player_id,day)select p_player,(last_played_at at time zone 'Europe/Warsaw')::date from pp_private.player_library where player_id=p_player and last_played_at is not null on conflict do nothing;
 insert into pp_private.starter_tasks(player_id,task)select p_player,'days'where(select count(*)from pp_private.starter_days where player_id=p_player)>=3 on conflict do nothing;
 end $$;
revoke all on function pp_private.starter_sync(uuid)from public,anon,authenticated;
create function pp_private.starter_events()returns trigger language plpgsql security definer set search_path='' as $$declare p uuid;begin
 if tg_table_name='duels' then
  if new.state='finished'and new.reason='completed'and(old.state is distinct from new.state)then
   for p in select x from unnest(array[new.host,new.guest])x order by x loop insert into pp_private.starter_days(player_id,day)values(p,(clock_timestamp()at time zone'Europe/Warsaw')::date)on conflict do nothing;perform pp_private.starter_sync(p);end loop;
  end if;
 elsif tg_table_name='profiles'then insert into pp_private.starter_accounts(player_id)values(new.player_id)on conflict do nothing;
 elsif tg_table_name='player_library'then
  if new.last_played_at is not null then insert into pp_private.starter_days(player_id,day)values(new.player_id,(new.last_played_at at time zone'Europe/Warsaw')::date)on conflict do nothing;perform pp_private.starter_sync(new.player_id);end if;
 else perform pp_private.starter_sync(new.player_id);end if;return new;end $$;
revoke all on function pp_private.starter_events()from public,anon,authenticated;
create trigger starter_profile after insert on public.profiles for each row execute function pp_private.starter_events();
create trigger starter_score after insert on pp_private.score_submissions for each row execute function pp_private.starter_events();
create trigger starter_duel after update on pp_private.duels for each row execute function pp_private.starter_events();
create trigger starter_played after insert or update on pp_private.player_library for each row execute function pp_private.starter_events();
create function public.pp_progress_public(p_player uuid)returns jsonb language plpgsql stable security definer set search_path='' as $$declare a pp_private.starter_accounts;visible boolean;xp_total integer;begin
 if not exists(select 1 from public.profiles where player_id=p_player)then return '{}'::jsonb;end if;
 select * into a from pp_private.starter_accounts where player_id=p_player;
 visible:=p_player=auth.uid()or coalesce((select show_badges from pp_private.player_settings where player_id=p_player),true);
 select coalesce(sum(xp),0)::int into xp_total from pp_private.pixel_ledger where player_id=p_player;
 return jsonb_build_object('level',case when visible then 1+xp_total/100 else null end,'frame',coalesce(a.frame,false),'banner',coalesce(a.banner,false),'title',case when a.title then 'Dusza imprezy' else null end,'badges',case when visible then (select coalesce(jsonb_agg(k),'[]')from(select 'level10' as k where xp_total>=900 union all select 'starter'where exists(select 1 from pp_private.starter_rewards where player_id=p_player and reward='finish'))x)else '[]'::jsonb end,'pinned',case when visible then coalesce(a.pinned,'[]')else '[]'::jsonb end);
 end $$;
revoke all on function public.pp_progress_public(uuid)from public;grant execute on function public.pp_progress_public(uuid)to anon,authenticated;
create function public.pp_starter(p_action text default 'get',p_key text default null,p_enabled boolean default null,p_pinned jsonb default null)returns jsonb language plpgsql security definer set search_path='' as $$declare me uuid:=auth.uid();points integer;threshold integer;begin
 if me is null or not exists(select 1 from public.profiles where player_id=me)or not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and(banned_until is null or banned_until<now()))then raise exception 'PROFILE_REQUIRED';end if;
 perform pp_private.starter_sync(me);
 select coalesce(sum(pp_private.starter_points(task)),0)::int into points from pp_private.starter_tasks where player_id=me;
 if p_action='claim_task'then
  update pp_private.starter_tasks set claimed_at=coalesce(claimed_at,now())where player_id=me and task=p_key;
  if not found then raise exception 'TASK_LOCKED';end if;
  insert into pp_private.pixel_ledger(player_id,source,amount,xp)values(me,'starter:'||p_key,20,pp_private.starter_points(p_key)*10)on conflict do nothing;
 elsif p_action='claim_reward'then
  threshold:=case p_key when'welcome'then 10 when'frame'then 40 when'banner'then 70 when'finish'then 100 else null end;
  if threshold is null or points<threshold then raise exception 'REWARD_LOCKED';end if;
  insert into pp_private.starter_rewards(player_id,reward)values(me,p_key)on conflict do nothing;
 elsif p_action='equip'then
  if p_key not in('frame','banner','title')or p_key is null or p_enabled is null then raise exception 'INVALID_EQUIP';end if;
  if p_enabled and not exists(select 1 from pp_private.starter_rewards where player_id=me and reward=case when p_key='title'then'finish'else p_key end)then raise exception 'REWARD_LOCKED';end if;
  update pp_private.starter_accounts set frame=case when p_key='frame'then p_enabled else frame end,banner=case when p_key='banner'then p_enabled else banner end,title=case when p_key='title'then p_enabled else title end where player_id=me;
 elsif p_action='pin'then
  if jsonb_typeof(p_pinned)is distinct from'array'or jsonb_array_length(p_pinned)>3 then raise exception'INVALID_BADGES';end if;
  if exists(select 1 from jsonb_array_elements_text(p_pinned)v where not((public.pp_progress_public(me)->'badges')?v))then raise exception'BADGE_LOCKED';end if;
  if(select count(distinct v)from jsonb_array_elements_text(p_pinned)v)<>jsonb_array_length(p_pinned)then raise exception'INVALID_BADGES';end if;
  update pp_private.starter_accounts set pinned=p_pinned where player_id=me;
 elsif p_action<>'get'then raise exception'INVALID_ACTION';end if;
 return jsonb_build_object('points',points,'tasks',(select coalesce(jsonb_agg(jsonb_build_object('key',task,'earned_at',earned_at,'claimed',claimed_at is not null)),'[]')from pp_private.starter_tasks where player_id=me),'rewards',(select coalesce(jsonb_agg(reward),'[]')from pp_private.starter_rewards where player_id=me),'pixels',(select coalesce(sum(amount),0)from pp_private.pixel_ledger where player_id=me),'xp',(select coalesce(sum(xp),0)from pp_private.pixel_ledger where player_id=me),'days',least(3,(select count(*)from pp_private.starter_days where player_id=me)),'profile',public.pp_progress_public(me));
end $$;
revoke all on function public.pp_starter(text,text,boolean,jsonb)from public,anon;grant execute on function public.pp_starter(text,text,boolean,jsonb)to authenticated;
