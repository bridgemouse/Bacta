import { describe, it, expect } from 'vitest'
import { addDaysLocal, relativeDayLabel, absoluteDateLabel, todayLocal } from '../../../client/src/lib/nutritionDate'

describe('nutritionDate', () => {
  it('addDaysLocal adds and subtracts days correctly across a month boundary', () => {
    expect(addDaysLocal('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDaysLocal('2026-08-01', -1)).toBe('2026-07-31')
  })

  it('relativeDayLabel returns TODAY/YESTERDAY/TOMORROW for the immediate cases', () => {
    const today = todayLocal()
    expect(relativeDayLabel(today)).toBe('TODAY')
    expect(relativeDayLabel(addDaysLocal(today, -1))).toBe('YESTERDAY')
    expect(relativeDayLabel(addDaysLocal(today, 1))).toBe('TOMORROW')
  })

  it('relativeDayLabel returns "N DAYS AGO" / "IN N DAYS" beyond the immediate cases', () => {
    const today = todayLocal()
    expect(relativeDayLabel(addDaysLocal(today, -3))).toBe('3 DAYS AGO')
    expect(relativeDayLabel(addDaysLocal(today, 3))).toBe('IN 3 DAYS')
  })

  it('absoluteDateLabel formats as WEEKDAY · MON D', () => {
    expect(absoluteDateLabel('2026-07-12')).toBe('SUN · JUL 12')
  })
})
