create or replace function public.pp_appearance(p_action text default 'get',p_expected bigint default null,p_settings jsonb default null,p_restore bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if get_byte(decode(substr(candidate->>'accent',2),'hex'),n::int)<64 or get_byte(decode(substr(candidate->>'background',2),'hex'),n::int)>48 then raise exception 'INVALID_COLORS';end if;
 end loop;
 if (select sum(get_byte(decode(substr(candidate->>'accent',2),'hex'),i)) from generate_series(0,2)i)<480 then raise exception 'INVALID_COLORS';end if;
 update public.hub_appearance set revision=revision+1,settings=candidate,updated_at=now() where id=true returning * into current_row;
 insert into pp_private.appearance_history(revision,settings,actor) values(current_row.revision,candidate,me);
 return jsonb_build_object('revision',current_row.revision,'settings',current_row.settings);
end $$;
revoke all on function public.pp_appearance(text,bigint,jsonb,bigint) from public,anon;
grant execute on function public.pp_appearance(text,bigint,jsonb,bigint) to authenticated;
