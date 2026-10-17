# Compact hub UI — 2026-10-17

- Profile: Edit, Settings and Public preview share a three-button row beside/below the avatar. Public visitors see no owner controls.
- Discover: one semantic title link expands over the whole card using a CSS pseudo-element. The favorite star is a separate sibling control above the link layer, with a 44px touch target and a post-write confirmation. The redundant bottom action is removed. Navigation still opens the game detail page.
- Personal library: same whole-card navigation, independent star; uses the shared catalog so the fourth game also appears when favorited/recently played.
- Messages: blocked players moved from Profile to below conversation content. An active thread occupies a fixed workspace panel (full viewport on mobile), with a separately scrolling history and a persistent bottom composer. VisualViewport resize/scroll events account for the mobile keyboard and clean up on deactivation. Closing/Escape restores focus; Escape does not close an open report dialog.
- QI-002, QI-004 and QI-005 implemented. QI-003 image illustration generation remains deferred. Existing covers are unchanged.

Validation: production build and 61 Node tests pass. Public card navigation and guest star are smoke-tested after deployment. Signed-in controls, live messaging and physical phone keyboard behavior still require user acceptance; no database/auth contracts changed.
