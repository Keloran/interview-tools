import {describe, expect, it} from 'vitest'
import {isOfferedSlot, openSlots} from '@/lib/availability'

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 5, 1, h, m))
const now = at(8).getTime()

describe('openSlots', () => {
  it('drops past slots and sorts', () => {
    expect(openSlots([at(14), at(7), at(10)], 60, [], now)).toEqual([at(10), at(14)])
  })

  it('drops slots that clash with an interview already booked', () => {
    // busy 10:00-11:00 clashes with 10:30 and 9:30 (60m), not with 11:00 or 9:00 (60m)
    expect(openSlots([at(9), at(9, 30), at(10, 30), at(11)], 60, [at(10)], now)).toEqual([at(9), at(11)])
  })
})

describe('isOfferedSlot', () => {
  it('only accepts exactly offered times', () => {
    expect(isOfferedSlot([at(10)], new Date(at(10).toISOString()))).toBe(true)
    expect(isOfferedSlot([at(10)], at(10, 1))).toBe(false)
  })
})
