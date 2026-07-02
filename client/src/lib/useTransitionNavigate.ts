import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

export function useTransitionNavigate(): (path: string) => void {
  const navigate = useNavigate()

  return useCallback((path: string) => {
    if ('startViewTransition' in document && typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => navigate(path))
    } else {
      navigate(path)
    }
  }, [navigate])
}
