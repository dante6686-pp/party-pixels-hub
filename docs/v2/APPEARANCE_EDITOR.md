# Hub appearance editor — QI-007

`/admin/appearance`, linked from Settings → administrator panel. First edition controls catalog/library title text, cover aspect ratio, square emblems, card padding/gaps/radius/border, descriptions, mobile page margins and shared accent/canvas colors. Controls are bounded tokens, never arbitrary CSS, URLs or code. Embedded game interfaces are excluded.

Preview is a same-origin iframe at 390 or 1280 px; wide PC preview scrolls horizontally on small screens. The administrator can preview Discover, personal library/profile and a game detail page. `postMessage` only accepts the same origin and parent/frame identity, payloads pass strict allowlist validation. Unpublished drafts stay inside the preview; navigating/reloading discards them. No authentication data is sent via messages.

Public singleton `hub_appearance` exposes only revision/settings/time via read-only RLS. Client provider loads it on mount/focus and falls back to shipped design on unavailable network or invalid settings. Existing open visitors see publications after refocus/reload. Settings are not stored in localStorage. Public reads do not disclose administrator IDs.

`pp_private.style_editors` contains the existing moderators at migration time (verified sole account handle dante6686), separately from future moderator additions. No user-editable metadata role. `pp_appearance` validates authenticated UID, current editor membership, suspension, expected revision and every token/color on every call. The privileged RPC intentionally executes as SECURITY DEFINER with empty search_path, revoked PUBLIC/anon execution; authenticated may call but non-editors are rejected. This intentionally triggers an advisor warning about exposed definer execution. Private tables have RLS, revoked access, no public policies. Baseline leaked-password advisory is unrelated.

Publishing and restoring require explicit UI confirmation; writes serialize with a row lock and expected revision, rejecting lost updates. Every successful write appends a version with actor/time to private history. UI lists latest 20 versions; restore creates a new revision instead of overwriting history. Current values remain editable even when a loaded version conflicts; reload page to refresh after conflict.

Validation: production build/TypeScript, Node token validation tests, SQL transaction with rollback tests editor publish/read/restore, stale revision rejection, out-of-range rejection, non-editor rejection, anonymous read + denied RPC and denied direct write. No real changes published during tests; initial history retained. Manual end-to-end editor session and physical phone need owner acceptance.

Migrations: 20261017095548_hub_appearance_editor and 20261017095740_appearance_readable_accent. Only dev Supabase udmbzcabkkotedprspar. Multiplayer and weekly challenge remain later stages.
