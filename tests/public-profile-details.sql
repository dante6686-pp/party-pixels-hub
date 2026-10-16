begin;
insert into auth.users(id) values('aaaaaaaa-0000-4000-8000-000000000051'),('bbbbbbbb-0000-4000-8000-000000000052');
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000051',true);
insert into public.profiles(player_id,handle,display_name,bio,banner_key) values('aaaaaaaa-0000-4000-8000-000000000051','profile_test_a','A','Lubię gry 3D.','sunset');
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000052',true);
insert into public.profiles(player_id,handle,display_name) values('bbbbbbbb-0000-4000-8000-000000000052','profile_test_b','B');
do $$
declare n integer;
begin
 update public.profiles set bio='Hijacked',banner_key='arcade' where handle='profile_test_a';
 get diagnostics n=row_count;if n<>0 then raise exception 'FAIL other owner';end if;
 update public.profiles set bio=repeat('ż',280),banner_key='forest' where handle='profile_test_b';
 get diagnostics n=row_count;if n<>1 then raise exception 'FAIL own edit';end if;
 begin update public.profiles set bio=repeat('x',281) where handle='profile_test_b';raise exception 'FAIL long bio';exception when check_violation then null;end;
 begin update public.profiles set banner_key='https://untrusted/image' where handle='profile_test_b';raise exception 'FAIL invalid banner';exception when check_violation then null;end;
 if (select bio from public.profiles where handle='profile_test_a')<>'Lubię gry 3D.' then raise exception 'FAIL original changed';end if;
end $$;
reset role;
set local role anon;
do $$begin
 if not exists(select 1 from public.profiles where handle='profile_test_a' and bio='Lubię gry 3D.' and banner_key='sunset') then raise exception 'FAIL public detail read';end if;
 begin update public.profiles set bio='anonymous edit' where handle='profile_test_a';raise exception 'FAIL anon write';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'public profile details owner edits bounds and anonymous read passed' as result;
rollback;
