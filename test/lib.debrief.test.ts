import {describe, expect, it} from 'vitest'
import {needsDebrief, parseDebrief} from '@/lib/debrief'

describe('parseDebrief', () => {
  it('keeps what was filled in and blanks the rest, so it can be finished later', () => {
    expect(parseDebrief({rating: 4, questionsAsked: '  Why us?\nTell me about a failure  ', peopleMet: '', replyBy: '2026-11-06T00:00:00.000Z'})).toEqual({
      rating: 4,
      replyBy: new Date('2026-11-06T00:00:00.000Z'),
      debriefNotes: null,
      peopleMet: null,
      questionsAsked: 'Why us?\nTell me about a failure',
      prepNotes: null,
      nextStep: null,
    })
  })

  it('drops out-of-range ratings and bad dates, and ignores a missing debrief', () => {
    expect(parseDebrief({rating: 9, replyBy: 'soon'})).toMatchObject({rating: null, replyBy: null})
    expect(parseDebrief({rating: 2.5})?.rating).toBeNull()
    expect(parseDebrief(undefined)).toBeNull()
  })
})

describe('needsDebrief', () => {
  const now = new Date(2026, 5, 1, 12).getTime()
  const past = new Date(2026, 5, 1, 10)
  const stage = {stage: 'Technical', outcome: 'SCHEDULED', date: past}

  it('asks once a scheduled interview has happened and until it is done', () => {
    expect(needsDebrief(stage, now)).toBe(true)
    expect(needsDebrief({...stage, debriefedAt: new Date()}, now)).toBe(false)
    expect(needsDebrief({...stage, date: new Date(2026, 5, 1, 14)}, now)).toBe(false)
  })

  it('not for the application itself or stages already settled', () => {
    expect(needsDebrief({...stage, stage: 'Applied'}, now)).toBe(false)
    expect(needsDebrief({...stage, outcome: 'REJECTED'}, now)).toBe(false)
  })
})
