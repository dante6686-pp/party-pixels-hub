// Call synchronously inside the user's Start/Continue handler, before any awaits.
// Failure must never prevent play, and entering must never toggle fullscreen off.
export async function requestDefaultFullscreen(doc) {
  if (doc.fullscreenElement) return 'active';
  if (typeof doc.documentElement?.requestFullscreen !== 'function') return 'unsupported';
  try { await doc.documentElement.requestFullscreen(); return 'requested'; }
  catch { return 'denied'; }
}
