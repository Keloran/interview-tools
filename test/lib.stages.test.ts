import {describe, expect, it} from 'vitest'
import {nextStage, sortStages} from '@/lib/stages'

const names = (list: string[]) => sortStages(list.map((stage) => ({stage}))).map((s) => s.stage)

describe('sortStages', () => {
  it('orders stages the way the process runs, not alphabetically', () => {
    expect(names(['Final Stage', 'First Stage', 'Fourth Stage', 'Offer', 'Phone Screen', 'Second Stage', 'Technical Interview', 'Technical Test', 'Third Stage', 'Applied']))
      .toEqual(['Applied', 'Phone Screen', 'First Stage', 'Technical Test', 'Technical Interview', 'Second Stage', 'Third Stage', 'Fourth Stage', 'Final Stage', 'Offer'])
  })

  it('puts custom stages before Offer, alphabetically, and ignores case', () => {
    expect(names(['Offer', 'Take-home', 'final stage', 'Culture Fit'])).toEqual(['final stage', 'Culture Fit', 'Take-home', 'Offer'])
  })
})

describe('nextStage', () => {
  const all = ['Applied', 'Phone Screen', 'First Stage', 'Technical Test', 'Technical Interview', 'Second Stage', 'Final Stage', 'Offer', 'Culture Fit']
    .map((stage) => ({stage}))

  it('picks the stage that follows in the process', () => {
    expect(nextStage('Applied', all)).toBe('Phone Screen')
    expect(nextStage('Phone Screen', all)).toBe('First Stage')
    expect(nextStage('Technical Test', all)).toBe('Technical Interview')
    expect(nextStage('Second Stage', all)).toBe('Final Stage') // skips stages you don't have
    expect(nextStage('final stage', all)).toBe('Culture Fit') // custom stages sit before Offer
  })

  it('nothing after an offer, or without a current stage', () => {
    expect(nextStage('Offer', all)).toBeUndefined()
    expect(nextStage(undefined, all)).toBeUndefined()
  })
})
