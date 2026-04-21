import { useEffect, useState } from 'react'

const STOP_ROUTES_URL = '/data/stop-routes.json'

export type StopRoutesIndex = Record<string, string[]>

export type UseStopRoutesState =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: StopRoutesIndex; error: null }
  | { status: 'error'; data: null; error: Error }

/**
 * Lazy-loaded stop → [route_id] reverse index. Fetches `/data/stop-routes.json`
 * the first time `enabled` flips to true (i.e. on first stop click) so the
 * 30 KB gzipped payload stays out of the initial page load. Subsequent
 * enables are no-ops — the index doesn't change within a session.
 */
export function useStopRoutesIndex(enabled: boolean): UseStopRoutesState {
  const [state, setState] = useState<UseStopRoutesState>({
    status: 'idle',
    data: null,
    error: null,
  })

  useEffect(() => {
    if (!enabled) return
    if (state.status !== 'idle') return
    let cancelled = false
    // One-shot external-resource fetch; the idle-guard above ensures we
    // don't loop on the state change this line triggers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading', data: null, error: null })
    fetch(STOP_ROUTES_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`stop-routes.json failed: ${r.status}`)
        return r.json() as Promise<StopRoutesIndex>
      })
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const error = err instanceof Error ? err : new Error(String(err))
        setState({ status: 'error', data: null, error })
      })
    return () => {
      cancelled = true
    }
  }, [enabled, state.status])

  return state
}
