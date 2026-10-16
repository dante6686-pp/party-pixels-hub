begin;
insert into auth.users(id,email_confirmed_at) values('aaaaaaaa-0000-4000-8000-000000000041',now()),('bbbbbbbb-0000-4000-8000-000000000042',now());
insert into public.profiles(player_id,handle,display_name) values('aaaaaaaa-0000-4000-8000-000000000041','library_test_a','A'),('bbbbbbbb-0000-4000-8000-000000000042','library_test_b','B');
set local role authenticated;
do $$
declare a uuid:='aaaaaaaa-0000-4000-8000-000000000041';b uuid:='bbbbbbbb-0000-4000-8000-000000000042';r jsonb;t text;
begin
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.pp_library(a,'get');if r->'games'<>'[]'::jsonb or r->'checkpoint'<>'null'::jsonb then raise exception 'FAIL empty';end if;
 perform public.pp_library(a,'favorite','magazyn-auto',true);
 perform public.pp_library(a,'favorite','magazyn-auto',true);
 r:=public.pp_library(a,'get');if jsonb_array_length(r->'games')<>1 or not (r->'games'->0->>'favorite')::boolean or r->'games'->0->'last_played_at'<>'null'::jsonb then raise exception 'FAIL favorite creates play or duplicates';end if;
 perform public.pp_library(a,'played','magazyn-auto');
 r:=public.pp_library(a,'get');t:=r->'games'->0->>'last_played_at';
 if t is null or not (r->'games'->0->>'favorite')::boolean then raise exception 'FAIL played overwrites favorite';end if;
 perform public.pp_library(a,'favorite','magazyn-auto',false);
 r:=public.pp_library(a,'get');if (r->'games'->0->>'favorite')::boolean or r->'games'->0->>'last_played_at'<>t then raise exception 'FAIL unfavorite changes recent';end if;
 perform public.pp_library(a,'played','quick-math');perform public.pp_library(a,'played','two-seconds');
 r:=public.pp_library(a,'get');if jsonb_array_length(r->'games')<>3 then raise exception 'FAIL catalog';end if;
 begin perform public.pp_library(a,'played','unknown');raise exception 'FAIL unknown';exception when raise_exception then if sqlerrm<>'INVALID_GAME' then raise;end if;end;
 begin perform public.pp_library(a,'favorite','quick-math',null);raise exception 'FAIL null favorite';exception when raise_exception then if sqlerrm<>'INVALID_ACTION' then raise;end if;end;
 perform public.pp_store_checkpoint(a,0,gen_random_uuid(),'{"mission":2,"cash":100}');
 r:=public.pp_library(a,'get');if r->'checkpoint'->>'mission'<>'2' then raise exception 'FAIL checkpoint';end if;
 if r->'checkpoint' ? 'cash' then raise exception 'FAIL unnecessary checkpoint data';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 r:=public.pp_library(b,'get');if r->'games'<>'[]'::jsonb or r->'checkpoint'<>'null'::jsonb then raise exception 'FAIL other account';end if;
 begin perform public.pp_library(a,'get');raise exception 'FAIL spoof read';exception when raise_exception then if sqlerrm<>'PLAYER_CHANGED' then raise;end if;end;
 begin perform public.pp_library(a,'favorite','magazyn-auto',true);raise exception 'FAIL spoof write';exception when raise_exception then if sqlerrm<>'PLAYER_CHANGED' then raise;end if;end;
 begin perform 1 from pp_private.player_library;raise exception 'FAIL direct read';exception when insufficient_privilege then null;end;
 begin delete from pp_private.player_library;raise exception 'FAIL direct write';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform public.pp_library(null,'get');raise exception 'FAIL anon';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'library favorites recents checkpoint privacy passed' as result;
rollback;
