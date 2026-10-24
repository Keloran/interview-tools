import {describe, expect, it} from 'vitest'
import {clashes, freeWindows, isOfferedSlot, openSlots, suggestSlots} from '@/lib/availability'

// local times, like the owner's browser
const at = (h: number, m = 0) => new Date(2026, 5, 1, h, m)
const now = at(7).getTime()
const hour = (start: Date) => ({start, durationMinutes: 60})
const hhmm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

describe('clashes', () => {
  const existing = [hour(at(12))] // 12:00-13:00

  it('needs 45m between interviews either side', () => {
    expect(clashes(hour(at(10, 15)), existing)).toBe(false) // ends 11:15, 45m before 12:00
    expect(clashes(hour(at(10, 30)), existing)).toBe(true)
    expect(clashes(hour(at(13, 45)), existing)).toBe(false) // 45m after 13:00
    expect(clashes(hour(at(13, 30)), existing)).toBe(true)
  })

  it('uses the real length of the existing interview', () => {
    expect(clashes(hour(at(13, 45)), [{start: at(12), durationMinutes: 90}])).toBe(true)
  })
})

describe('openSlots', () => {
  it('drops past, too-soon and clashing slots, and sorts', () => {
    // now 7:00: 7:15 is inside the 30m prep time
    expect(openSlots([at(16), at(7, 15), at(11), at(10)], 60, [hour(at(12))], now)).toEqual([at(10), at(16)])
  })
})

describe('suggestSlots', () => {
  it('suggests free starts between 9 and 6 around an existing interview', () => {
    expect(suggestSlots(at(0), 60, [hour(at(12))], {}, now).map(hhmm))
      .toEqual(['9:00', '9:30', '10:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'])
  })

  it('keeps 30m to get ready from now', () => {
    expect(suggestSlots(at(0), 60, [], {fromHour: 7, toHour: 9}, now).map(hhmm)).toEqual(['7:30', '8:00'])
  })
})

describe('freeWindows', () => {
  const windows = (busy: {start: Date; durationMinutes: number}[], n = now) =>
    freeWindows(at(0), busy, {}, n).map((w) => `${hhmm(w.start)}-${hhmm(w.end)}`)

  it('shows the gaps you could fit something into', () => {
    expect(windows([hour(at(12)), hour(at(15))])).toEqual(['9:00-11:15', '13:45-14:15', '16:45-18:00'])
  })

  it('whole day when nothing is booked', () => {
    expect(windows([])).toEqual(['9:00-18:00'])
  })

  it('drops gaps under 30m and starts 30m from now', () => {
    // now 8:45 -> earliest 9:15, which is already blocked by the 10:00; 11:45-12:00 is only 15m
    expect(windows([hour(at(10)), hour(at(12, 45))], at(8, 45).getTime())).toEqual(['14:30-18:00'])
  })
})

describe('isOfferedSlot', () => {
  it('only accepts exactly offered times', () => {
    expect(isOfferedSlot([at(10)], new Date(at(10).toISOString()))).toBe(true)
    expect(isOfferedSlot([at(10)], at(10, 1))).toBe(false)
  })
})
