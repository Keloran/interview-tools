import {describe, expect, it} from 'vitest'
import {brokenPromise, followUpDueAt, nextWorkingDay} from '@/lib/followUps'

const d = (day: number, h = 12) => new Date(2026, 9, day, h) // October 2026: the 16th is a Friday
const now = d(20).getTime()

describe('nextWorkingDay', () => {
  it('skips the weekend', () => {
    expect(nextWorkingDay(d(14))).toEqual(new Date(2026, 9, 15))
    expect(nextWorkingDay(d(16))).toEqual(new Date(2026, 9, 19))
  })
})

describe('followUpDueAt', () => {
  const applied = {stage: 'Applied', outcome: 'AWAITING_RESPONSE', date: null, replyBy: null}
  const interviewed = {stage: 'Technical', outcome: 'AWAITING_RESPONSE', date: d(12), replyBy: null}

  it('defaults to 10 days after applying and 5 after an interview', () => {
    expect(followUpDueAt({applicationDate: d(1), latest: applied, followUps: []}, now)).toEqual(d(11))
    expect(followUpDueAt({applicationDate: d(1), latest: interviewed, followUps: []}, now)).toEqual(d(17))
  })

  it('uses the date they promised when there is one: the working day after', () => {
    expect(followUpDueAt({applicationDate: d(1), latest: {...interviewed, replyBy: d(16, 0)}, followUps: []}, now))
      .toEqual(new Date(2026, 9, 19))
  })

  it('waits a week after you last followed up', () => {
    expect(followUpDueAt({applicationDate: d(1), latest: interviewed, followUps: [d(18)]}, now)).toEqual(d(25))
  })

  it('stops once it counts as ghosted: chased twice, or a month with nothing happening', () => {
    expect(followUpDueAt({applicationDate: d(1), latest: interviewed, followUps: [d(13), d(18)]}, now)).toBeNull()
    const months = new Date(2026, 11, 1).getTime() // 1 Dec: over a month since applying on 1 Oct
    expect(followUpDueAt({applicationDate: d(1), latest: applied, followUps: []}, months)).toBeNull()
    // a follow-up or promised date keeps it alive until a month after that
    expect(followUpDueAt({applicationDate: d(1), latest: applied, followUps: [new Date(2026, 10, 10)]}, months)).toEqual(new Date(2026, 10, 17))
    expect(followUpDueAt({applicationDate: d(1), latest: {...interviewed, replyBy: new Date(2026, 10, 6)}, followUps: []}, months)).toEqual(new Date(2026, 10, 9))
  })

  it('a past interview with no news counts as waiting; upcoming or settled ones do not', () => {
    expect(followUpDueAt({applicationDate: d(1), latest: {...interviewed, outcome: 'SCHEDULED'}, followUps: []}, now)).toEqual(d(17))
    expect(followUpDueAt({applicationDate: d(1), latest: {...interviewed, outcome: 'SCHEDULED', date: d(22)}, followUps: []}, now)).toBeNull()
    expect(followUpDueAt({applicationDate: d(1), latest: {...interviewed, outcome: 'REJECTED'}, followUps: []}, now)).toBeNull()
  })
})

describe('brokenPromise', () => {
  const promised = {outcome: 'AWAITING_RESPONSE', replyBy: d(12, 0), createdAt: d(9), updatedAt: d(9)}

  it('notes a late reply, from the next stage being added', () => {
    expect(brokenPromise([{outcome: 'SCHEDULED', replyBy: null, createdAt: d(20), updatedAt: d(20)}, promised], now))
      .toBe("Said they'd reply by 12 Oct; replied 20 Oct")
  })

  it('notes a late rejection, from the outcome changing', () => {
    expect(brokenPromise([{...promised, outcome: 'REJECTED', updatedAt: d(15)}], now)).toBe("Said they'd reply by 12 Oct; replied 15 Oct")
  })

  it('notes no reply once the day has passed', () => {
    expect(brokenPromise([promised], now)).toBe("Said they'd reply by 12 Oct; never replied")
    expect(brokenPromise([{...promised, replyBy: d(20, 0)}], now)).toBeNull() // still today
  })

  it('says nothing when they kept their word, or never promised', () => {
    expect(brokenPromise([{...promised, outcome: 'PASSED', updatedAt: d(12, 17)}], now)).toBeNull()
    expect(brokenPromise([{...promised, replyBy: null}], now)).toBeNull()
  })
})
