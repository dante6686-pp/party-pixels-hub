-- Disposable fixtures only; all writes are rolled back. Run as project postgres.
begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();req uuid:=gen_random_uuid();comment_id bigint;report_id uuid;j jsonb;again jsonb;votes bigint;expected bigint;
begin
 perform set_config('qa.a',a::text,true);perform set_config('qa.b',b::text,true);perform set_config('qa.c',c::text,true);
 insert into auth.users(id,email,role,aud,email_confirmed_at) values(a,'qa-'||a||'@example.invalid','authenticated','authenticated',now()),(b,'qa-'||b||'@example.invalid','authenticated','authenticated',now()),(c,'qa-'||c||'@example.invalid','authenticated','authenticated',now());
 insert into public.profiles(player_id,handle,display_name) values(a,'qa_'||left(replace(a::text,'-',''),12),'QA Alpha'),(b,'qa_'||left(replace(b::text,'-',''),12),'QA Beta'),(c,'qa_'||left(replace(c::text,'-',''),12),'QA Gamma');
 perform set_config('request.jwt.claim.sub',a::text,true);
 votes:=(public.pp_game_feedback('magazyn-auto')->'rating'->>'votes')::bigint;
 perform public.pp_game_feedback_write(a,'magazyn-auto','rate',5);perform public.pp_game_feedback_write(a,'magazyn-auto','rate',5);
 j:=public.pp_game_feedback('magazyn-auto');
 if (j->'rating'->>'mine')::int<>5 or (j->'rating'->>'votes')::bigint<>votes+1 then raise exception 'rating retry duplicated vote';end if;
 begin perform public.pp_game_feedback_write(b,'magazyn-auto','rate',1);raise exception 'cross account accepted';exception when raise_exception then if sqlerrm<>'PLAYER_CHANGED' then raise;end if;end;
 begin perform public.pp_game_feedback_write(a,'magazyn-auto','rate',6);raise exception 'invalid rating accepted';exception when raise_exception then if sqlerrm<>'INVALID_RATING' then raise;end if;end;
 begin perform public.pp_game_feedback_write(a,'not-a-game','rate',5);raise exception 'unknown game accepted';exception when raise_exception then if sqlerrm<>'UNKNOWN_GAME' then raise;end if;end;
 -- A changed vote updates the same row, not the vote count.
 update pp_private.game_ratings set updated_at=now()-interval '5 seconds' where player_id=a;
 perform public.pp_game_feedback_write(a,'magazyn-auto','rate',4);
 if (public.pp_game_feedback('magazyn-auto')->'rating'->>'votes')::bigint<>votes+1 then raise exception 'vote update duplicated';end if;
 begin perform public.pp_game_feedback_write(a,'magazyn-auto','comment',p_body=>' ',p_request=>req);raise exception 'empty body accepted';exception when raise_exception then if sqlerrm<>'INVALID_COMMENT' then raise;end if;end;
 j:=public.pp_game_feedback_write(a,'magazyn-auto','comment',p_body=>'<script>alert(1)</script> plain text',p_request=>req);comment_id:=(j->>'id')::bigint;
 again:=public.pp_game_feedback_write(a,'magazyn-auto','comment',p_body=>'<script>alert(1)</script> plain text',p_request=>req);
 if j<>again then raise exception 'comment retry changed receipt';end if;
 begin perform public.pp_game_feedback_write(a,'magazyn-auto','comment',p_body=>'different',p_request=>req);raise exception 'conflicting retry accepted';exception when raise_exception then if sqlerrm<>'DUPLICATE_CONFLICT' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 begin perform public.pp_game_feedback_write(b,'magazyn-auto','remove',p_comment=>comment_id);raise exception 'foreign deletion accepted';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 req:=gen_random_uuid();j:=public.pp_game_feedback_write(b,'magazyn-auto','report',p_request=>req,p_comment=>comment_id,p_reason=>'spam');again:=public.pp_game_feedback_write(b,'magazyn-auto','report',p_request=>req,p_comment=>comment_id,p_reason=>'spam');
 if j<>again then raise exception 'report retry duplicated';end if;
 if (select snapshot->>'body' from pp_private.game_comment_reports where id=(j->>'id')::uuid)<>'<script>alert(1)</script> plain text' then raise exception 'bad report snapshot';end if;
 insert into pp_private.player_blocks(blocker_id,blocked_id) values(a,b);
 if exists(select 1 from jsonb_array_elements(public.pp_game_feedback('magazyn-auto')->'comments') x where x->>'id'=comment_id::text) then raise exception 'blocked comment visible';end if;
 delete from pp_private.player_blocks where blocker_id=a and blocked_id=b;
 if not exists(select 1 from jsonb_array_elements(public.pp_game_feedback('magazyn-auto')->'comments') x where x->>'id'=comment_id::text) then raise exception 'unblocked comment missing';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.pp_game_feedback_write(a,'magazyn-auto','remove',p_comment=>comment_id);perform public.pp_game_feedback_write(a,'magazyn-auto','remove',p_comment=>comment_id);
 if exists(select 1 from jsonb_array_elements(public.pp_game_feedback('magazyn-auto')->'comments') x where x->>'id'=comment_id::text) then raise exception 'deleted comment visible';end if;
 perform public.pp_game_feedback_write(a,'quick-math','comment',p_body=>'two',p_request=>gen_random_uuid());perform public.pp_game_feedback_write(a,'quick-math','comment',p_body=>'three',p_request=>gen_random_uuid());
 begin perform public.pp_game_feedback_write(a,'quick-math','comment',p_body=>'four',p_request=>gen_random_uuid());raise exception 'rate limit missing';exception when raise_exception then if sqlerrm<>'COMMENT_LIMIT' then raise;end if;end;
 insert into pp_private.game_comments(player_id,game_id,request_id,body) select c,'two-seconds',gen_random_uuid(),'page '||n from generate_series(1,23) n;
 j:=public.pp_game_feedback('two-seconds');if jsonb_array_length(j->'comments')<>20 then raise exception 'page size';end if;
 again:=public.pp_game_feedback('two-seconds',(j->'comments'->19->>'id')::bigint);
 if exists(select 1 from jsonb_array_elements(j->'comments') x join jsonb_array_elements(again->'comments') y on x->>'id'=y->>'id') then raise exception 'pages overlap';end if;
 insert into public.player_bests(player_id,game_id,value,unit,verification_status) values(a,'quick-math',4,'points','validated'),(b,'quick-math',4,'points','validated'),(c,'quick-math',1,'points','validated'),(a,'two-seconds',100,'milliseconds','unverified'),(b,'two-seconds',80,'milliseconds','unverified'),(c,'two-seconds',80,'milliseconds','unverified');
 j:=public.pp_game_ranking('quick-math');select 1+count(*) into expected from public.player_bests where game_id='quick-math' and value>4;
 if (j->'mine'->>'place')::bigint<>expected then raise exception 'math rank wrong';end if;
 j:=public.pp_game_ranking('two-seconds');select 1+count(*) into expected from public.player_bests where game_id='two-seconds' and value<100;
 if (j->'mine'->>'place')::bigint<>expected or j->'mine'->>'verification_status'<>'unverified' then raise exception 'clock rank wrong';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);j:=public.pp_game_ranking('quick-math');select 1+count(*) into expected from public.player_bests where game_id='quick-math' and value>4;
 if (j->'mine'->>'place')::bigint<>expected then raise exception 'tie rank wrong';end if;
 if has_table_privilege('authenticated','pp_private.game_comments','INSERT') or has_table_privilege('anon','pp_private.game_comments','SELECT') or has_function_privilege('anon','public.pp_game_feedback_write(uuid,text,text,integer,text,uuid,bigint,text)','EXECUTE') then raise exception 'privilege leak';end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.pp_game_feedback_write(a,'quick-math','rate',5);raise exception 'anonymous write accepted';exception when raise_exception then if sqlerrm<>'PLAYER_CHANGED' then raise;end if;end;
end $$;
-- Notification inputs: pending invitation and an unread message are independent.
do $$
declare a uuid:=current_setting('qa.a')::uuid;b uuid:=current_setting('qa.b')::uuid;c uuid:=current_setting('qa.c')::uuid;
begin
 insert into pp_private.friendships(low_id,high_id,sender_id,state) values(least(a,b),greatest(a,b),b,'pending'),(least(a,c),greatest(a,c),c,'accepted');
 insert into pp_private.direct_messages(low_id,high_id,sender_id,request_id,body) values(least(a,c),greatest(a,c),c,gen_random_uuid(),'Notification QA');
 perform set_config('request.jwt.claim.sub',a::text,true);
end $$;
set local role authenticated;
do $$
declare a uuid:=current_setting('qa.a')::uuid;b uuid:=current_setting('qa.b')::uuid;c uuid:=current_setting('qa.c')::uuid;j jsonb;msg bigint;
begin
 if not exists(select 1 from jsonb_array_elements(public.pp_friends(a,'list')) x where x->>'player_id'=b::text and x->>'relation'='incoming') then raise exception 'invitation missing';end if;
 j:=public.pp_messages(a,'inbox');if not exists(select 1 from jsonb_array_elements(j) x where x->>'player_id'=c::text and (x->>'unread')::boolean) then raise exception 'unread notification missing';end if;
 -- Merely listing notifications must not mark any messages read.
 j:=public.pp_messages(a,'inbox');select (x->>'latest_id')::bigint into msg from jsonb_array_elements(j) x where x->>'player_id'=c::text;
 perform public.pp_messages(a,'read',p_peer=>c,p_read=>msg);
 if exists(select 1 from jsonb_array_elements(public.pp_messages(a,'inbox')) x where x->>'player_id'=c::text and (x->>'unread')::boolean) then raise exception 'read notification still unread';end if;
 begin perform public.pp_messages(b,'inbox');raise exception 'foreign notification access';exception when raise_exception then if sqlerrm<>'PLAYER_CHANGED' then raise;end if;end;
 perform public.pp_game_feedback_write(a,'two-seconds','rate',3);
 if (public.pp_game_feedback('two-seconds')->'rating'->>'mine')::int<>3 then raise exception 'authenticated role cannot rate';end if;
 perform set_config('request.jwt.claim.sub','',true);
end $$;
set local role anon;
select jsonb_typeof(public.pp_game_feedback())='array' as public_summary_ok,jsonb_typeof(public.pp_game_feedback('quick-math')->'comments')='array' as public_comments_ok,public.pp_game_ranking('quick-math')->'mine'='null'::jsonb as anon_no_private_record;
reset role;
rollback;
