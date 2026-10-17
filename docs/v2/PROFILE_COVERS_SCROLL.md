# Profile covers and section scrolling — 2026-10-17

GFX-020–022 v01 are authorized by Patryk's instruction to implement them. Source PNGs remain on Drive. WebP copies retain 1536×512 dimensions; source IDs and SHA-256 in public/profile-covers/manifest.json.

The profile editor offers three native radio choices with visual previews. Their existing persisted keys are reused: orbit = Nocna zmiana, forest = Złota szychta, arcade = Szybka runda. Legacy sunset renders/defaults to orbit, and is normalized only on the next explicit save. Existing profiles therefore receive illustrations instead of CSS themes. No profile rows or database policies are changed. Owner and public profiles use the same ProfileCard. Centered cover crop preserves aspect ratio at desktop205px/mobile160px height. Starter banner remains opt-in and adds a gold/green overlay border instead of obscuring the selected cover.

QI-014: switching the five top-level hash sections resets document scroll to top using a layout effect after the new panel is committed, reinforced next frame. Browser history scroll restoration is manual while Home is mounted and restored on unmount. Back/forward section changes follow the same rule. Chat histories and other inner scrollers are untouched. This does not reset scroll on ordinary input, filter changes, or incoming messages.

Validation: production build/TypeScript passed; 62 existing Node tests passed. Browser live checks and deployment evidence are recorded in project status. Signed-in form save and physical phone acceptance require a user session; no user profiles modified for QA.
