import {describe, expect, it} from 'vitest'
import {sortStages} from '@/lib/stages'

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
