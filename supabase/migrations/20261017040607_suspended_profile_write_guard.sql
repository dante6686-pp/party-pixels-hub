create function pp_private.active_account() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from auth.users where id=(select auth.uid()) and email_confirmed_at is not null and (banned_until is null or banned_until<now()))$$;
revoke all on function pp_private.active_account() from public,anon,authenticated;
grant execute on function pp_private.active_account() to authenticated;
alter policy profiles_owner_insert on public.profiles with check ((select auth.uid())=player_id and (select pp_private.active_account()));
alter policy profiles_owner_update on public.profiles using ((select auth.uid())=player_id and (select pp_private.active_account())) with check ((select auth.uid())=player_id and (select pp_private.active_account()));