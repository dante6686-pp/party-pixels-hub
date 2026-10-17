# Hub expansion 1–8 — 2026-10-17

- Mobile: larger touch targets, responsive settings/moderation and replies, isolated viewport game shell. Physical phone and signed-in two-account browser acceptance remains manual.
- Replies: one level, public read, UUID retry, shared rate limits, soft removal/report, unread notifications with root lookup beyond page one.
- Settings: own-email reset link using existing recovery flow, new invitations toggle, optional friends-only presence (off by default, 90-second TTL), public badge visibility.
- Moderation: server-maintained moderator membership; report snapshots, comment hide/restore, resolve; 1/7-day suspension and reversal, audit; self/moderators protected. Suspended accounts cannot use privileged hub RPCs or edit profiles. Public browsing/guest games remain accessible. Patryk dante6686 was provisioned by fixed verified player ID, not by mutable handle at runtime.
- Presentation: four original SVG covers, duration/scope and touch/PC controls. Covers are illustrations, not fabricated gameplay screenshots. Gameplay gallery captures require a working WebGL browser.
- Nocna portiernia: pinned source d7d8d4fd995220e32f127c70be9834a557d57385, two visits only, separately adapted copy; sibling prototype branch and private Sites untouched. Local guest checkpoint even when signed in; no cloud/ranking promise. Opaque iframe has no credentials/network access and sends only schema-validated demo checkpoint through a capability port.
- Five badges awarded/backfilled from server evidence; no client badge write grants. Perfect five requires validated math score.

## Validation

- 61 Node tests pass (game logic, controller, scene, checkpoint synchronization and capability bridge).
- Next production build passes.
- tests/sql/hub-expansion.sql: disposable fixtures/rollback; ownership, invitation preferences, opt-in/friends/TTL/blocked presence, badges including real validated score and retry, threaded read/write/retry, notification ownership/read/block filtering, moderator gate and hide/restore/suspension/audit, direct privilege restrictions.
- tests/sql/game-community.sql regression passes including authenticated/anonymous checks.
- Applied migrations retain remote-generated version numbers. Historical query_aliases migration has a typo subsequently corrected by comment_notification_links; do not stop replay between the two.
- Security advisor: private deny-default RLS tables intentionally have no direct policies (17 INFO). Pre-existing leaked-password protection WARN: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Release verification

Deployment and public browser smoke checks are recorded in the shared status document after publishing. No claim of physical-device or signed-in browser end-to-end verification.
