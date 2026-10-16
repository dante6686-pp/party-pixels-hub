create table public.profiles (
  player_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  avatar_key text not null default 'ghost' check (avatar_key in ('ghost','bolt','cat','planet')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert (player_id,handle,display_name,avatar_key), update (player_id,handle,display_name,avatar_key) on public.profiles to authenticated;
create policy profiles_public_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_owner_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = player_id);
create policy profiles_owner_update on public.profiles for update to authenticated using ((select auth.uid()) = player_id) with check ((select auth.uid()) = player_id);
