'use client'

import { useEffect, useRef } from 'react'

/**
 * setInterval that only runs while the tab is actually being looked at.
 *
 * The pollers here used to keep firing in background tabs, and people leave
 * myBatz open all day — which is where most of our serverless invocations went.
 * Nobody reads a list they can't see, so a hidden tab polls nothing; returning
 * to the tab refreshes once immediately, so what you see is never stale.
 *
 * The callback is held in a ref, so a caller may pass a fresh closure on every
 * render without restarting the timer.
 */
export function useVisibleInterval(callback: () => void, delayMs: number) {
  const saved = useRef(callback)

  useEffect(() => { saved.current = callback }, [callback])

  useEffect(() => {
    if (delayMs <= 0) return

    let timer: ReturnType<typeof setInterval> | null = null
    const isVisible = () => document.visibilityState === 'visible'

    const start = () => { if (timer === null) timer = setInterval(() => saved.current(), delayMs) }
    const stop = () => { if (timer !== null) { clearInterval(timer); timer = null } }

    function onVisibilityChange() {
      if (isVisible()) {
        // Catch up on whatever happened while the tab was hidden, then resume.
        saved.current()
        start()
      } else {
        stop()
      }
    }

    if (isVisible()) start()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [delayMs])
}
