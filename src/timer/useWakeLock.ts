import { useEffect } from 'react'

// Keeps the screen on while `active` is true. Android releases the lock
// whenever the app is hidden, so it's requested again on return.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = () => {
      navigator.wakeLock
        .request('screen')
        .then((s) => {
          // The request is async; if we were deactivated meanwhile, let go at once.
          if (cancelled) void s.release()
          else sentinel = s
        })
        // Refused (e.g. battery saver): the timer still works, the screen may just sleep.
        .catch(() => {})
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
        acquire()
      }
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void sentinel?.release()
    }
  }, [active])
}
