alter table public.profiles
 add column bio text not null default '' check(char_length(bio)<=280),
 add column banner_key text not null default 'orbit' check(banner_key in ('orbit','arcade','forest','sunset'));
grant insert(bio,banner_key),update(bio,banner_key) on public.profiles to authenticated;
