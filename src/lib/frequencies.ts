import { useEffect, useState } from 'react'
import type { FrequenciesFile } from '../../scripts/types/frequencies'

const FREQUENCIES_URL = '/data/frequencies.json'

async function fetchFrequencies(): Promise<FrequenciesFile> {
  const response = await fetch(FREQUENCIES_URL)
  if (!response.ok) {
    throw new Error(`frequencies.json failed: ${response.status}`)
  }
  return response.json()
}

export type UseFrequenciesState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: FrequenciesFile; error: null }
  | { status: 'error'; data: null; error: Error }

export function useFrequencies(): UseFrequenciesState {
  const [state, setState] = useState<UseFrequenciesState>({
    status: 'loading',
    data: null,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    fetchFrequencies()
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
  }, [])

  return state
}
