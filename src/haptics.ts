// One short tick per meaningful action, so the phone confirms a tap before the
// screen does. Every call sits behind a real touch, which is what Chrome's
// user-gesture rule for vibrate() asks for; a device with no motor (or a
// desktop browser) simply has nothing to call.
//
// The scale used across the app:
//   8–10  a tap landed (expand, close, clear)
//   14–15  a state flipped (tech sheet, filter, tick, save)
//   20     a gesture armed or a case moved
//   30     something left the list (archived, deleted)
export function tap(ms: number): void {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // some browsers throw instead of ignoring a blocked vibrate
  }
}
