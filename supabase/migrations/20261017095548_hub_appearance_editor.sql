create table pp_private.style_editors(player_id uuid primary key references public.profiles(player_id) on delete cascade);
alter table pp_private.style_editors enable row level security;
revoke all on pp_private.style_editors from public,anon,authenticated;
insert into pp_private.style_editors select player_id from pp_private.moderators;
create table public.hub_appearance(id boolean primary key default true check(id),revision bigint not null default 0,settings jsonb not null,updated_at timestamptz not null default now());
alter table public.hub_appearance enable row level security;
revoke all on public.hub_appearance from public,anon,authenticated;
grant select on public.hub_appearance to anon,authenticated;
create policy appearance_read on public.hub_appearance for select to anon,authenticated using(true);
insert into public.hub_appearance(settings) values('{"titleSize":22,"coverRatio":2.5,"logoSize":90,"cardPadding":22,"cardGap":18,"cardRadius":20,"borderWidth":1,"textSize":12,"pagePadding":18,"accent":"#d7fa72","background":"#111116"}');
create table pp_private.appearance_history(revision bigint primary key,settings jsonb not null,created_at timestamptz not null default now(),actor uuid references auth.users(id) on delete set null);
alter table pp_private.appearance_history enable row level security;
revoke all on pp_private.appearance_history from public,anon,authenticated;
insert into pp_private.appearance_history(revision,settings) select revision,settings from public.hub_appearance;
create function public.pp_appearance(p_action text default 'get',p_expected bigint default null,p_settings jsonb default null,p_restore bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); current_row public.hub_appearance; candidate jsonb; k text; n numeric; lower_bound numeric; upper_bound numeric;
begin
 if me is null or not exists(select 1 from pp_private.style_editors where player_id=me) then raise exception 'EDITOR_REQUIRED';end if;
 if exists(select 1 from auth.users where id=me and banned_until>now()) then raise exception 'EDITOR_REQUIRED';end if;
 select * into current_row from public.hub_appearance where id=true for update;
 if p_action='get' then return jsonb_build_object('revision',current_row.revision,'settings',current_row.settings,'history',(select coalesce(jsonb_agg(x order by x.revision desc),'[]') from(select revision,settings,created_at from pp_private.appearance_history order by revision desc limit 20)x));end if;
 if p_action not in ('publish','restore') then raise exception 'INVALID_ACTION';end if;
 if p_expected is distinct from current_row.revision then raise exception 'REVISION_CONFLICT';end if;
 if p_action='restore' then select settings into candidate from pp_private.appearance_history where revision=p_restore;else candidate:=p_settings;end if;
 if candidate is null or jsonb_typeof(candidate)<>'object' then raise exception 'INVALID_SETTINGS';end if;
 if (select count(*) from jsonb_object_keys(candidate))<>11 then raise exception 'INVALID_SETTINGS';end if;
 for k,lower_bound,upper_bound in select * from(values('titleSize',16,28),('coverRatio',2,3),('logoSize',56,100),('cardPadding',14,28),('cardGap',10,28),('cardRadius',0,28),('borderWidth',1,3),('textSize',12,16),('pagePadding',12,28))v loop
  if jsonb_typeof(candidate->k) is distinct from 'number' then raise exception 'INVALID_SETTINGS';end if;
  n:=(candidate->>k)::numeric;if n<lower_bound or n>upper_bound then raise exception 'INVALID_SETTINGS';end if;
 end loop;
 if (candidate->>'accent') is null or (candidate->>'accent')!~'^#[a-fA-F0-9]{6}$' or (candidate->>'background') is null or (candidate->>'background')!~'^#[a-fA-F0-9]{6}$' then raise exception 'INVALID_SETTINGS';end if;
 for n in 0..2 loop
  if get_byte(decode(substr(candidate->>'accent',2),'hex'),n::int)<160 or get_byte(decode(substr(candidate->>'background',2),'hex'),n::int)>48 then raise exception 'INVALID_COLORS';end if;
 end loop;
 update public.hub_appearance set revision=revision+1,settings=candidate,updated_at=now() where id=true returning * into current_row;
 insert into pp_private.appearance_history(revision,settings,actor) values(current_row.revision,candidate,me);
 return jsonb_build_object('revision',current_row.revision,'settings',current_row.settings);
end $$;
revoke all on function public.pp_appearance(text,bigint,jsonb,bigint) from public,anon;
grant execute on function public.pp_appearance(text,bigint,jsonb,bigint) to authenticated;
