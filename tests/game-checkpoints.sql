-- Only the isolated v2 dev project. Fixtures are rolled back.
begin;
insert into auth.users(id,email_confirmed_at) values('aaaaaaaa-0000-4000-8000-000000000011',now()),('bbbbbbbb-0000-4000-8000-000000000012',now());
insert into public.profiles(player_id,handle,display_name) values('aaaaaaaa-0000-4000-8000-000000000011','save_test_a','Save A'),('bbbbbbbb-0000-4000-8000-000000000012','save_test_b','Save B');
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000011',true);
do $$
declare a uuid:='aaaaaaaa-0000-4000-8000-000000000011';b uuid:='bbbbbbbb-0000-4000-8000-000000000012';req uuid:=gen_random_uuid();r jsonb;t jsonb;v jsonb;denied boolean;
begin
 r:=public.pp_load_checkpoint(a);if (r->>'revision')::integer<>0 or r->'checkpoint'<>'null'::jsonb then raise exception 'FAIL empty slot';end if;
 r:=public.pp_store_checkpoint(a,0,req,'{"mission":1,"cash":500}');
 if (r->>'revision')::integer<>1 then raise exception 'FAIL first revision';end if;
 t:=public.pp_store_checkpoint(a,0,req,'{"mission":1,"cash":500}');if t<>r then raise exception 'FAIL retry not idempotent';end if;
 -- A new client on the same account sees the same saved state.
 t:=public.pp_load_checkpoint(a);if t<>r then raise exception 'FAIL second device load';end if;
 denied:=false;begin perform public.pp_store_checkpoint(a,0,gen_random_uuid(),'{"mission":0,"cash":0}');exception when others then if sqlerrm='SAVE_CONFLICT' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'FAIL stale device overwrite';end if;
 denied:=false;begin perform public.pp_store_checkpoint(a,0,req,'{"mission":2,"cash":1300}');exception when others then if sqlerrm='DUPLICATE_CONFLICT' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'FAIL changed request payload';end if;
 for v in select value from jsonb_array_elements('[null,[],{}, {"mission":4,"cash":0},{"mission":1,"cash":-1},{"mission":1,"cash":1.5},{"mission":1,"cash":1000000001},{"mission":1,"cash":0,"player_id":"other"}]'::jsonb) loop
  denied:=false;begin perform public.pp_store_checkpoint(a,1,gen_random_uuid(),v);exception when others then if sqlerrm='INVALID_CHECKPOINT' then denied:=true;else raise;end if;end;
  if not denied then raise exception 'FAIL invalid checkpoint: %',v;end if;
 end loop;
 perform set_config('request.jwt.claim.sub',b::text,true);
 t:=public.pp_load_checkpoint(b);if (t->>'revision')::integer<>0 then raise exception 'FAIL another account sees save';end if;
 denied:=false;begin perform public.pp_load_checkpoint(a);exception when others then if sqlerrm='PLAYER_CHANGED' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'FAIL cross-account read';end if;
 denied:=false;begin perform public.pp_store_checkpoint(a,1,gen_random_uuid(),'{"mission":2,"cash":1300}');exception when others then if sqlerrm='PLAYER_CHANGED' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'FAIL cross-account write';end if;
 denied:=false;begin perform 1 from pp_private.game_checkpoints;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL direct table read';end if;
 denied:=false;begin delete from pp_private.game_checkpoints;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL direct table write';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.pp_store_checkpoint(a,1,gen_random_uuid(),'{"mission":3,"cash":2800}');
 if (r->>'revision')::integer<>2 or (r->'checkpoint'->>'mission')::integer<>3 then raise exception 'FAIL campaign progress';end if;
 -- Explicit new campaign may reset progression, still guarded by the current revision.
 r:=public.pp_store_checkpoint(a,2,gen_random_uuid(),'{"mission":0,"cash":0}');
 if (r->>'revision')::integer<>3 then raise exception 'FAIL explicit reset';end if;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform public.pp_load_checkpoint('aaaaaaaa-0000-4000-8000-000000000011');raise exception 'FAIL anonymous read';exception when insufficient_privilege then null;end;
 begin perform public.pp_store_checkpoint('aaaaaaaa-0000-4000-8000-000000000011',0,gen_random_uuid(),'{"mission":0,"cash":0}');raise exception 'FAIL anonymous write';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: private account save, second-device read, idempotency, stale-device conflict, payload validation, cross-account denial, anonymous denial, explicit restart' as result;
rollback;
