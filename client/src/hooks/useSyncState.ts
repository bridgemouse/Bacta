import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from '../lib/ToastContext'

export type SyncStatus = 'idle' | 'running' | 'done' | 'error'

export interface SyncState {
  status: SyncStatus
  elapsed: number | null
}

export function useSyncState() {
  const [state, setState] = useState<SyncState>({ status: 'idle', elapsed: null })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reloadRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { showToast } = useToast()

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
        } else {
          showToast('Garmin sync failed. Try again from Settings.', 'error')
          reloadRef.current = setTimeout(() => setState({ status: 'idle', elapsed: null }), 3000)
        }
      }
    } catch { /* ignore network errors during polling */ }
  }, [stopPolling, showToast])

  const startSync = useCallback(async () => {
    if (state.status === 'running') return
    if (reloadRef.current) { clearTimeout(reloadRef.current); reloadRef.current = null }
    try {
      await fetch('/api/garmin/sync', { method: 'POST' })
      setState({ status: 'running', elapsed: 0 })
      pollRef.current = setInterval(pollStatus, 2000)
    } catch {
      setState({ status: 'error', elapsed: null })
      showToast('Could not reach the server to start a Garmin sync.', 'error')
      reloadRef.current = setTimeout(() => setState({ status: 'idle', elapsed: null }), 3000)
    }
  }, [state.status, pollStatus, showToast])

  useEffect(() => () => {
    stopPolling()
    if (reloadRef.current) clearTimeout(reloadRef.current)
  }, [stopPolling])

  return { ...state, startSync }
}
