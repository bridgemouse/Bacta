import { useState, useEffect, useRef, useCallback } from 'react'

export type SyncStatus = 'idle' | 'running' | 'done' | 'error'

export interface SyncState {
  status: SyncStatus
  elapsed: number | null
}

export function useSyncState() {
  const [state, setState] = useState<SyncState>({ status: 'idle', elapsed: null })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reloadRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/garmin/sync/status')
      const data = await res.json() as SyncState
      setState(data)
      if (data.status === 'done' || data.status === 'error') {
        stopPolling()
        if (data.status === 'done') {
          reloadRef.current = setTimeout(() => window.dispatchEvent(new CustomEvent('bacta:sync-complete')), 3000)
        }
      }
    } catch { /* ignore network errors during polling */ }
  }, [stopPolling])

  const startSync = useCallback(async () => {
    if (state.status === 'running') return
    try {
      await fetch('/api/garmin/sync', { method: 'POST' })
      setState({ status: 'running', elapsed: 0 })
      pollRef.current = setInterval(pollStatus, 2000)
    } catch {
      setState({ status: 'error', elapsed: null })
      setTimeout(() => setState({ status: 'idle', elapsed: null }), 3000)
    }
  }, [state.status, pollStatus])

  useEffect(() => () => {
    stopPolling()
    if (reloadRef.current) clearTimeout(reloadRef.current)
  }, [stopPolling])

  return { ...state, startSync }
}
