create or replace function pp_private.settings_api(p_owner uuid,p_action text,p_invites boolean default null,p_presence boolean default null,p_badges boolean default null,p_game text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare me uuid:=pp_private.checked_player(p_owner);prefs pp_private.player_settings;result jsonb;begin
 if p_action='save' then
  if p_invites is null or p_presence is null or p_badges is null then raise exception 'INVALID_SETTINGS';end if;
  perform pg_advisory_xact_lock(hashtextextended('friends:'||me::text,0));
  insert into pp_private.player_settings(player_id,allow_invites,show_presence,show_badges) values(me,p_invites,p_presence,p_badges) on conflict(player_id) do update set allow_invites=excluded.allow_invites,show_presence=excluded.show_presence,show_badges=excluded.show_badges,last_seen=case when excluded.show_presence then pp_private.player_settings.last_seen else null end,playing=case when excluded.show_presence then pp_private.player_settings.playing else null end;
 elsif p_action='heartbeat' then
  if p_game is not null and p_game not in ('magazyn-auto','quick-math','two-seconds','nocna-portiernia') then raise exception 'INVALID_GAME';end if;
  update pp_private.player_settings set last_seen=clock_timestamp(),playing=p_game where player_id=me and show_presence and (last_seen is null or last_seen<clock_timestamp()-interval '10 seconds' or playing is distinct from p_game);return jsonb_build_object('ok',true);
 elsif p_action='friends' then
  select coalesce(jsonb_agg(jsonb_build_object('player_id',s.player_id,'game',s.playing)),'[]'::jsonb) into result from pp_private.friendships f join pp_private.player_settings s on s.player_id=case when f.low_id=me then f.high_id else f.low_id end join auth.users u on u.id=s.player_id where me in(f.low_id,f.high_id) and f.state='accepted' and s.show_presence and s.last_seen>clock_timestamp()-interval '90 seconds' and (u.banned_until is null or u.banned_until<clock_timestamp()) and not exists(select 1 from pp_private.player_blocks b where (b.blocker_id=me and b.blocked_id=s.player_id) or (b.blocked_id=me and b.blocker_id=s.player_id));return result;
 elsif p_action<>'get' then raise exception 'INVALID_ACTION';end if;
 select * into prefs from pp_private.player_settings where player_id=me;
 return jsonb_build_object('allow_invites',coalesce(prefs.allow_invites,true),'show_presence',coalesce(prefs.show_presence,false),'show_badges',coalesce(prefs.show_badges,true),'is_moderator',exists(select 1 from pp_private.moderators where player_id=me));end $$;

create or replace function pp_private.reply_api(p_owner uuid,p_game text,p_parent bigint,p_action text,p_body text default null,p_request uuid default null,p_after bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$declare me uuid:=auth.uid();root pp_private.game_comments;c pp_private.game_comments;result jsonb;begin
 select * into root from pp_private.game_comments where id=p_parent and game_id=p_game and parent_id is null and deleted_at is null and hidden_at is null;
 if not found or exists(select 1 from pp_private.player_blocks b where (b.blocker_id=me and b.blocked_id=root.player_id) or (b.blocked_id=me and b.blocker_id=root.player_id)) then raise exception 'COMMENT_UNAVAILABLE';end if;
 if p_action='read' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_id),'[]'::jsonb) into result from (select child.id::text as id,child.id as sort_id,child.body,child.created_at,p.player_id,p.handle,p.display_name,p.avatar_key from pp_private.game_comments child join publichild.profiles p on p.player_id=child.player_id where child.parent_id=p_parent and child.deleted_at is null and child.hidden_at is null and (p_after is null or child.id>p_after) and not exists(select 1 from pp_private.player_blocks b where (b.blocker_id=me and b.blocked_id=child.player_id) or (b.blocked_id=me and b.blocker_id=child.player_id)) order by child.id limit 20) x;return result;end if;
 me:=pp_private.checked_player(p_owner);
 if p_action<>'post' or p_body is null or char_length(btrim(p_body)) not between 1 and 1000 or p_request is null then raise exception 'INVALID_COMMENT';end if;
 perform pg_advisory_xact_lock(hashtextextended('feedback:'||me::text,0));
 perform 1 from pp_private.game_comments where id=p_parent and deleted_at is null and hidden_at is null for update;if not found then raise exception 'COMMENT_UNAVAILABLE';end if;
 select * into c from pp_private.game_comments where player_id=me and request_id=p_request;
 if found then
  if c.parent_id is distinct from p_parent or c.game_id<>p_game or c.body<>btrim(p_body) then raise exception 'DUPLICATE_CONFLICT';end if;
  if c.deleted_at is not null or c.hidden_at is not null then raise exception 'COMMENT_UNAVAILABLE';end if;return jsonb_build_object('id',c.id::text);end if;
 if (select count(*) from pp_private.game_comments where player_id=me and created_at>clock_timestamp()-interval '1 minute')>=3 or (select count(*) from pp_private.game_comments where player_id=me and created_at>clock_timestamp()-interval '1 day')>=30 then raise exception 'COMMENT_LIMIT';end if;
 insert into pp_private.game_comments(player_id,game_id,request_id,body,parent_id) values(me,p_game,p_request,btrim(p_body),p_parent) returning * into c;return jsonb_build_object('id',c.id::text);end $$;
