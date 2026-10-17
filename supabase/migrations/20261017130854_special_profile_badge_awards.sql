create table pp_private.special_profile_badges(player_id uuid not null references public.profiles(player_id)on delete cascade,badge text not null check(badge in('event','secret')),actor uuid references auth.users(id)on delete set null,reason text not null,earned_at timestamptz not null default now(),primary key(player_id,badge));
alter table pp_private.special_profile_badges enable row level security;
revoke all on pp_private.special_profile_badges from public,anon,authenticated;
create function public.pp_award_profile_badge(p_handle text,p_badge text,p_reason text)returns jsonb language plpgsql security definer set search_path='' as $$declare target uuid;begin
 if auth.uid()is null or not exists(select 1 from pp_private.style_editors where player_id=auth.uid())or exists(select 1 from auth.users where id=auth.uid()and banned_until>now())then raise exception'EDITOR_REQUIRED';end if;
 if p_badge not in('event','secret')or p_badge is null or p_reason is null or char_length(btrim(p_reason))not between 5 and 200 then raise exception'INVALID_BADGE';end if;
 select player_id into target from public.profiles where handle=lower(btrim(p_handle));if target is null then raise exception'PLAYER_NOT_FOUND';end if;
 insert into pp_private.special_profile_badges(player_id,badge,actor,reason)values(target,p_badge,auth.uid(),btrim(p_reason))on conflict do nothing;return jsonb_build_object('ok',true);
end $$;
revoke all on function public.pp_award_profile_badge(text,text,text)from public,anon;grant execute on function public.pp_award_profile_badge(text,text,text)to authenticated;
create or replace function public.pp_progress_public(p_player uuid)returns jsonb language plpgsql stable security definer set search_path='' as $$declare a pp_private.starter_accounts;visible boolean;xp_total integer;begin
 if not exists(select 1 from public.profiles where player_id=p_player)then return '{}'::jsonb;end if;
 select * into a from pp_private.starter_accounts where player_id=p_player;
 visible:=p_player=auth.uid()or coalesce((select show_badges from pp_private.player_settings where player_id=p_player),true);
 select coalesce(sum(xp),0)::int into xp_total from pp_private.pixel_ledger where player_id=p_player;
 return jsonb_build_object('level',case when visible then 1+xp_total/100 else null end,'frame',coalesce(a.frame,false),'banner',coalesce(a.banner,false),'title',case when a.title then 'Dusza imprezy'else null end,'badges',case when visible then(select coalesce(jsonb_agg(k),'[]')from(select'level10'as k where xp_total>=900 union all select'starter'where exists(select 1 from pp_private.starter_rewards where player_id=p_player and reward='finish')union all select badge from pp_private.special_profile_badges where player_id=p_player)x)else'[]'::jsonb end,'pinned',case when visible then coalesce(a.pinned,'[]')else'[]'::jsonb end);end $$;
