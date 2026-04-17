import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges multiple class names with a space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('resolves conflicting Tailwind utilities — the later one wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})
