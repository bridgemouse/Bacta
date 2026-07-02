import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'

export function useTransitionNavigate(): (path: string) => void {
  const navigate = useNavigate()

  return useCallback((path: string) => {
    if ('startViewTransition' in document && typeof document.startViewTransition === 'function') {
      // React batches the navigate()-triggered state update, so without
      // flushSync the browser can capture its "after" screenshot before
      // React has actually committed the new route to the DOM — the
      // transition then silently renders as a no-op crossfade.
      document.startViewTransition(() => flushSync(() => navigate(path)))
    } else {
      navigate(path)
    }
  }, [navigate])
}
