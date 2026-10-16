-- Run only on the isolated v2 dev database. All fixtures are rolled back.
begin;
insert into auth.users(id) values ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',true);
insert into public.profiles(player_id,handle,display_name) values ('aaaaaaaa-0000-4000-8000-000000000001','test_player_a','Test A');
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',true);
insert into public.profiles(player_id,handle,display_name) values ('bbbbbbbb-0000-4000-8000-000000000002','test_player_b','Test B');
do $$
declare affected integer;
begin
  update public.profiles set display_name='Hijacked' where player_id='aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: cross-account update'; end if;
  update public.profiles set avatar_key='cat' where player_id='bbbbbbbb-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner update'; end if;
  begin
    update public.profiles set handle='test_player_a' where player_id='bbbbbbbb-0000-4000-8000-000000000002';
    raise exception 'FAIL: duplicate handle accepted';
  exception when unique_violation then null;
  end;
  begin
    update public.profiles set player_id='cccccccc-0000-4000-8000-000000000003' where player_id='bbbbbbbb-0000-4000-8000-000000000002';
    raise exception 'FAIL: ownership reassignment accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role anon;
do $$
begin
  if (select count(*) from public.profiles where handle in ('test_player_a','test_player_b')) <> 2 then raise exception 'FAIL: public profile read'; end if;
  begin
    update public.profiles set display_name='Hijacked';
    raise exception 'FAIL: anonymous write accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'PASS: owner write, cross-account denial, unique handle, ownership protection, public read, anonymous denial' as result;
rollback;
