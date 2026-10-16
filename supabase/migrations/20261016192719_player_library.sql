create table pp_private.player_library(
 player_id uuid not null references public.profiles(player_id) on delete cascade,
 game_id text not null check(game_id in ('magazyn-auto','quick-math','two-seconds')),
 favorite boolean not null default false,
 last_played_at timestamptz,
 primary key(player_id,game_id)
);
alter table pp_private.player_library enable row level security;
revoke all on pp_private.player_library from public,anon,authenticated;
create function pp_private.library_api(p_owner uuid,p_action text,p_game text default null,p_favorite boolean default null)
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
 if p_game is null or p_game not in ('magazyn-auto','quick-math','two-seconds') then raise exception 'INVALID_GAME';end if;
 if p_action='favorite' and p_favorite is not null then
  insert into pp_private.player_library(player_id,game_id,favorite) values(me,p_game,p_favorite)
  on conflict(player_id,game_id) do update set favorite=excluded.favorite;
 elsif p_action='played' then
  insert into pp_private.player_library(player_id,game_id,last_played_at) values(me,p_game,clock_timestamp())
  on conflict(player_id,game_id) do update set last_played_at=greatest(pp_private.player_library.last_played_at,excluded.last_played_at);
 else raise exception 'INVALID_ACTION';end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function pp_private.library_api(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function pp_private.library_api(uuid,text,text,boolean) to authenticated;
create function public.pp_library(p_owner uuid,p_action text,p_game text default null,p_favorite boolean default null) returns jsonb language sql security invoker set search_path='' as $$select pp_private.library_api(p_owner,p_action,p_game,p_favorite)$$;
revoke all on function public.pp_library(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.pp_library(uuid,text,text,boolean) to authenticated;
