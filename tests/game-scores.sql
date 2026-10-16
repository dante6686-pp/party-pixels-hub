-- Isolated v2 dev only. All users, sessions and scores are rolled back.
begin;
insert into auth.users(id,email_confirmed_at) values('aaaaaaaa-0000-4000-8000-000000000001',now()),('bbbbbbbb-0000-4000-8000-000000000002',now());
insert into public.profiles(player_id,handle,display_name) values('aaaaaaaa-0000-4000-8000-000000000001','sdk_test_a','SDK A'),('bbbbbbbb-0000-4000-8000-000000000002','sdk_test_b','SDK B');
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',true);
do $$
declare s jsonb; t jsonb; answers jsonb; r jsonb; retry jsonb; req uuid:=gen_random_uuid(); denied boolean;
begin
 s:=public.pp_start_game('quick-math');
 select jsonb_agg((v->>'a')::integer+(v->>'b')::integer) into answers from jsonb_array_elements(s->'challenge') v;
 r:=public.pp_submit_score((s->>'sessionId')::uuid,req,jsonb_build_object('answers',answers));
 if (r->>'value')::integer<>5 then raise exception 'FAIL server scoring';end if;
 retry:=public.pp_submit_score((s->>'sessionId')::uuid,req,jsonb_build_object('answers',answers));
 if retry<>r then raise exception 'FAIL retry receipt';end if;
 if (select attempts from public.player_bests where player_id=auth.uid() and game_id='quick-math')<>1 then raise exception 'FAIL duplicate attempts';end if;
 denied:=false;
 begin perform public.pp_submit_score((s->>'sessionId')::uuid,req,'{"answers":[0,0,0,0,0]}');
 exception when others then if sqlerrm='DUPLICATE_CONFLICT' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'FAIL changed retry';end if;
 denied:=false;
 begin perform public.pp_submit_score((s->>'sessionId')::uuid,gen_random_uuid(),'{}');
 exception when others then if sqlerrm='DUPLICATE_CONFLICT' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'FAIL second final result';end if;
 t:=public.pp_start_game('two-seconds');
 denied:=false;
 begin perform public.pp_submit_score((t->>'sessionId')::uuid,gen_random_uuid(),'{"value":-1}');
 exception when others then if sqlerrm='INVALID_RESULT' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'FAIL invalid score';end if;
 r:=public.pp_submit_score((t->>'sessionId')::uuid,gen_random_uuid(),'{"value":100}');
 if r->>'verificationStatus'<>'unverified' then raise exception 'FAIL trust label';end if;
 t:=public.pp_start_game('two-seconds');
 perform public.pp_submit_score((t->>'sessionId')::uuid,gen_random_uuid(),'{"value":300}');
 if (select value from public.player_bests where player_id=auth.uid() and game_id='two-seconds')<>100 then raise exception 'FAIL worse score overwrote best';end if;
 if (select count(*) from public.player_bests where player_id=auth.uid())<>2 then raise exception 'FAIL two games same player';end if;
 s:=public.pp_start_game('two-seconds');
 perform set_config('pp_test.session_id',s->>'sessionId',true);
 perform set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',true);
 denied:=false;
 begin perform public.pp_submit_score((s->>'sessionId')::uuid,gen_random_uuid(),'{"value":1}');
 exception when others then if sqlerrm='FORBIDDEN' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'FAIL cross-account score';end if;
 denied:=false;
 begin insert into public.player_bests(player_id,game_id,value,unit,verification_status) values(auth.uid(),'quick-math',5,'points','validated');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL direct score write';end if;
end $$;
reset role;
-- Expiry test: owned session exists but deadline has passed.
update pp_private.game_sessions set expires_at=now()-interval '1 minute' where not exists(select 1 from pp_private.score_submissions where session_id=game_sessions.id);
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',true);
do $$declare denied boolean:=false;begin
 begin perform public.pp_submit_score(current_setting('pp_test.session_id')::uuid,gen_random_uuid(),'{"value":1}');
 exception when others then if sqlerrm='SESSION_EXPIRED' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'FAIL expired session';end if;
end $$;
-- Private tables cannot be read directly by authenticated players.
do $$begin
 begin perform 1 from pp_private.game_sessions;raise exception 'FAIL private session read';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform public.pp_start_game('quick-math');raise exception 'FAIL anonymous session';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: server scoring, idempotency, conflicts, value bounds, trust labels, best scores, two games, ownership, expiry, direct-write denial, private sessions, anonymous denial' as result;
rollback;
