-- Account-owned checkpoints. Client-reported progression is not a ranked score.
create table pp_private.game_checkpoints (
 player_id uuid not null references public.profiles(player_id) on delete cascade,
 game_id text not null check(game_id='magazyn-auto'),
 save_version integer not null default 1 check(save_version=1),
 revision bigint not null check(revision>0),
 checkpoint jsonb not null,
 last_request_id uuid not null,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(player_id,game_id),
 check(jsonb_typeof(checkpoint)='object' and checkpoint ?& array['mission','cash'] and checkpoint-array['mission','cash']='{}'::jsonb)
);
alter table pp_private.game_checkpoints enable row level security;
revoke all on pp_private.game_checkpoints from public,anon,authenticated;

create function pp_private.load_checkpoint(p_expected_player uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); s pp_private.game_checkpoints;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null and (banned_until is null or banned_until<clock_timestamp())) then raise exception 'AUTH_REQUIRED';end if;
 if p_expected_player is distinct from uid then raise exception 'PLAYER_CHANGED';end if;
 if not exists(select 1 from public.profiles where player_id=uid) then raise exception 'PROFILE_REQUIRED';end if;
 select * into s from pp_private.game_checkpoints where player_id=uid and game_id='magazyn-auto';
 if not found then return jsonb_build_object('saveVersion',1,'revision',0,'checkpoint',null);end if;
 return jsonb_build_object('saveVersion',s.save_version,'revision',s.revision,'checkpoint',s.checkpoint,'updatedAt',s.updated_at);
end $$;

create function pp_private.store_checkpoint(p_expected_player uuid,p_expected_revision bigint,p_request_id uuid,p_checkpoint jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); s pp_private.game_checkpoints; current_revision bigint:=0;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null and (banned_until is null or banned_until<clock_timestamp())) then raise exception 'AUTH_REQUIRED';end if;
 if p_expected_player is distinct from uid then raise exception 'PLAYER_CHANGED';end if;
 if not exists(select 1 from public.profiles where player_id=uid) then raise exception 'PROFILE_REQUIRED';end if;
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>9007199254740990 or p_checkpoint is null or octet_length(p_checkpoint::text)>256 then raise exception 'INVALID_CHECKPOINT';end if;
 if jsonb_typeof(p_checkpoint) is distinct from 'object' then raise exception 'INVALID_CHECKPOINT';end if;
 if not(p_checkpoint ?& array['mission','cash']) or p_checkpoint-array['mission','cash']<>'{}'::jsonb then raise exception 'INVALID_CHECKPOINT';end if;
 if jsonb_typeof(p_checkpoint->'mission') is distinct from 'number' or jsonb_typeof(p_checkpoint->'cash') is distinct from 'number' then raise exception 'INVALID_CHECKPOINT';end if;
 if (p_checkpoint->>'mission') !~ '^[0-3]$' or (p_checkpoint->>'cash') !~ '^[0-9]{1,10}$' then raise exception 'INVALID_CHECKPOINT';end if;
 if (p_checkpoint->>'cash')::bigint>1000000000 then raise exception 'INVALID_CHECKPOINT';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||':magazyn-auto-checkpoint',0));
 select * into s from pp_private.game_checkpoints where player_id=uid and game_id='magazyn-auto' for update;
 if found then
   current_revision:=s.revision;
   if s.last_request_id=p_request_id then
     if s.checkpoint=p_checkpoint and s.revision=p_expected_revision+1 then return pp_private.load_checkpoint(p_expected_player);end if;
     raise exception 'DUPLICATE_CONFLICT';
   end if;
 end if;
 if current_revision<>p_expected_revision then raise exception 'SAVE_CONFLICT';end if;
 insert into pp_private.game_checkpoints(player_id,game_id,revision,checkpoint,last_request_id)
 values(uid,'magazyn-auto',current_revision+1,p_checkpoint,p_request_id)
 on conflict(player_id,game_id) do update set revision=excluded.revision,checkpoint=excluded.checkpoint,last_request_id=excluded.last_request_id,updated_at=clock_timestamp();
 return pp_private.load_checkpoint(p_expected_player);
end $$;

revoke execute on function pp_private.load_checkpoint(uuid),pp_private.store_checkpoint(uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function pp_private.load_checkpoint(uuid),pp_private.store_checkpoint(uuid,bigint,uuid,jsonb) to authenticated;
create function public.pp_load_checkpoint(p_expected_player uuid) returns jsonb language sql security invoker set search_path='' as $$select pp_private.load_checkpoint(p_expected_player)$$;
create function public.pp_store_checkpoint(p_expected_player uuid,p_expected_revision bigint,p_request_id uuid,p_checkpoint jsonb) returns jsonb language sql security invoker set search_path='' as $$select pp_private.store_checkpoint(p_expected_player,p_expected_revision,p_request_id,p_checkpoint)$$;
revoke execute on function public.pp_load_checkpoint(uuid),public.pp_store_checkpoint(uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.pp_load_checkpoint(uuid),public.pp_store_checkpoint(uuid,bigint,uuid,jsonb) to authenticated;
