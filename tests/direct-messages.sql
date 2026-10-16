begin;
insert into auth.users(id,email_confirmed_at) values('aaaaaaaa-0000-4000-8000-000000000031',now()),('bbbbbbbb-0000-4000-8000-000000000032',now()),('cccccccc-0000-4000-8000-000000000033',now());
insert into public.profiles(player_id,handle,display_name) values('aaaaaaaa-0000-4000-8000-000000000031','dm_test_a','A'),('bbbbbbbb-0000-4000-8000-000000000032','dm_test_b','B'),('cccccccc-0000-4000-8000-000000000033','dm_test_c','C');
insert into pp_private.friendships(low_id,high_id,sender_id,state) values('aaaaaaaa-0000-4000-8000-000000000031','bbbbbbbb-0000-4000-8000-000000000032','aaaaaaaa-0000-4000-8000-000000000031','accepted');
set local role authenticated;
do $$
declare a uuid:='aaaaaaaa-0000-4000-8000-000000000031';b uuid:='bbbbbbbb-0000-4000-8000-000000000032';c uuid:='cccccccc-0000-4000-8000-000000000033';req uuid:=gen_random_uuid();r jsonb;s jsonb;mid bigint;i int;
begin
 perform set_config('request.jwt.claim.sub',a::text,true);
 if public.pp_messages(a,'inbox')<>'[]'::jsonb then raise exception 'FAIL initial inbox';end if;
 begin perform public.pp_messages(a,'send',c,'hello',gen_random_uuid());raise exception 'FAIL nonfriend';exception when raise_exception then if sqlerrm<>'FRIENDS_ONLY' then raise;end if;end;
 begin perform public.pp_messages(a,'send',b,' ',gen_random_uuid());raise exception 'FAIL empty';exception when raise_exception then if sqlerrm<>'INVALID_MESSAGE' then raise;end if;end;
 begin perform public.pp_messages(a,'send',b,repeat('x',2001),gen_random_uuid());raise exception 'FAIL too long';exception when raise_exception then if sqlerrm<>'INVALID_MESSAGE' then raise;end if;end;
 r:=public.pp_messages(a,'send',b,'hello',req);mid:=(r->>'id')::bigint;
 s:=public.pp_messages(a,'send',b,'hello',req);if s<>r then raise exception 'FAIL retry';end if;
 begin perform public.pp_messages(a,'send',b,'changed',req);raise exception 'FAIL changed retry';exception when raise_exception then if sqlerrm<>'DUPLICATE_CONFLICT' then raise;end if;end;
 r:=public.pp_messages(a,'history',b);if jsonb_array_length(r->'messages')<>1 then raise exception 'FAIL duplicate';end if;
 perform set_config('request.jwt.claim.sub',c::text,true);
 if public.pp_messages(c,'inbox')<>'[]'::jsonb then raise exception 'FAIL third party inbox';end if;
 r:=public.pp_messages(c,'history',a);if r->'messages'<>'[]'::jsonb then raise exception 'FAIL third party history';end if;
 begin perform public.pp_messages(a,'history',b);raise exception 'FAIL spoof owner';exception when raise_exception then if sqlerrm<>'PLAYER_CHANGED' then raise;end if;end;
 begin perform public.pp_messages(c,'read',a,p_read=>mid);raise exception 'FAIL spoof read';exception when raise_exception then if sqlerrm<>'INVALID_READ' then raise;end if;end;
 begin perform 1 from pp_private.direct_messages;raise exception 'FAIL direct read';exception when insufficient_privilege then null;end;
 begin delete from pp_private.direct_messages;raise exception 'FAIL direct write';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 r:=public.pp_messages(b,'inbox');if not (r->0->>'unread')::boolean then raise exception 'FAIL unread';end if;
 perform public.pp_messages(b,'read',a,p_read=>mid);
 r:=public.pp_messages(b,'inbox');if (r->0->>'unread')::boolean then raise exception 'FAIL mark read';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 for i in 2..30 loop perform public.pp_messages(a,'send',b,'message '||i,gen_random_uuid());end loop;
 begin perform public.pp_messages(a,'send',b,'too fast',gen_random_uuid());raise exception 'FAIL rate';exception when raise_exception then if sqlerrm<>'RATE_LIMIT' then raise;end if;end;
 -- Retry remains possible even at rate limit.
 perform public.pp_messages(a,'send',b,'hello',req);
 perform set_config('request.jwt.claim.sub',b::text,true);
 for i in 1..25 loop perform public.pp_messages(b,'send',a,'reply '||i,gen_random_uuid());end loop;
 r:=public.pp_messages(b,'history',a);if jsonb_array_length(r->'messages')<>50 then raise exception 'FAIL page size';end if;
 s:=public.pp_messages(b,'history',a,p_before=>(r->'messages'->0->>'id')::bigint);
 if jsonb_array_length(s->'messages')<>5 then raise exception 'FAIL older page';end if;
 -- Marking old content read must not swallow newer incoming messages.
 perform public.pp_messages(b,'read',a,p_read=>mid);
 r:=public.pp_messages(b,'inbox');if not (r->0->>'unread')::boolean then raise exception 'FAIL newer unread lost';end if;
 r:=public.pp_friends(b,'list');perform public.pp_friends(b,'remove',a,(r->0->>'request_id')::uuid);
 r:=public.pp_messages(b,'history',a);if (r->>'can_send')::boolean or jsonb_array_length(r->'messages')<>50 then raise exception 'FAIL removed friend history';end if;
 begin perform public.pp_messages(b,'send',a,'blocked',gen_random_uuid());raise exception 'FAIL removed friend send';exception when raise_exception then if sqlerrm<>'FRIENDS_ONLY' then raise;end if;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform public.pp_messages(null,'inbox');raise exception 'FAIL anon';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'direct messages lifecycle privacy retry unread pagination limits passed' as result;
rollback;
