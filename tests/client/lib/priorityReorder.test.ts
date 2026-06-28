import { describe, it, expect } from 'vitest'

function movePriority(list: string[], index: number, dir: -1 | 1): string[] {
  const swapIdx = index + dir
  if (swapIdx < 0 || swapIdx >= list.length) return list
  const next = [...list]
  ;[next[index], next[swapIdx]] = [next[swapIdx], next[index]]
  return next
}

describe('movePriority', () => {
  it('moves an item up one position', () => {
    expect(movePriority(['garmin', 'oura', 'whoop'], 1, -1)).toEqual(['oura', 'garmin', 'whoop'])
  })

  it('moves an item down one position', () => {
    expect(movePriority(['garmin', 'oura', 'whoop'], 0, 1)).toEqual(['oura', 'garmin', 'whoop'])
  })

  it('does not move the first item up', () => {
    const list = ['garmin', 'oura']
    expect(movePriority(list, 0, -1)).toBe(list)
  })

  it('does not move the last item down', () => {
    const list = ['garmin', 'oura']
    expect(movePriority(list, 1, 1)).toBe(list)
  })

  it('returns original reference when clamped (not a new array)', () => {
    const list = ['a', 'b', 'c']
    expect(movePriority(list, 0, -1)).toBe(list)
    expect(movePriority(list, 2, 1)).toBe(list)
  })
})
