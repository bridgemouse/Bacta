import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type ToastLevel = 'info' | 'error'

export interface Toast {
  id: number
  message: string
  level: ToastLevel
}

interface ToastContextValue {
  toasts: Toast[]
  showToast: (message: string, level?: ToastLevel) => void
  dismissToast: (id: number) => void
}

const AUTO_DISMISS_MS = 6000

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  showToast: () => {},
  dismissToast: () => {},
})

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: number) => {
    setToasts(ts => ts.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, level: ToastLevel = 'error') => {
    const id = nextId++
    setToasts(ts => [...ts, { id, message, level }])
    setTimeout(() => dismissToast(id), AUTO_DISMISS_MS)
  }, [dismissToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  )
}
