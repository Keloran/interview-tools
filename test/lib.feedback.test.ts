import {describe, expect, it} from 'vitest'
import {feedbackRecord, parseFeedback, rejectedStatus} from '@/lib/feedback'

describe('parseFeedback', () => {
  it('keeps a known type and trimmed text; anything else is blank', () => {
    expect(parseFeedback({type: 'SPECIFIC', text: '  Needed more system design  '})).toEqual({feedbackType: 'SPECIFIC', feedbackText: 'Needed more system design'})
    expect(parseFeedback({type: 'loads', text: ''})).toEqual({feedbackType: null, feedbackText: null})
    expect(parseFeedback(undefined)).toBeNull()
  })
})

describe('rejectedStatus', () => {
  it('says whether a rejection came with feedback', () => {
    expect(rejectedStatus('Technical', 'SPECIFIC')).toBe('Rejected at Technical, specific feedback')
    expect(rejectedStatus('Technical', 'GENERIC')).toBe('Rejected at Technical, generic feedback')
    expect(rejectedStatus('Technical', 'NONE')).toBe('Rejected at Technical, no feedback')
    expect(rejectedStatus('Technical', null)).toBe('Rejected at Technical')
  })
})

describe('feedbackRecord', () => {
  it('counts only rejections where you noted it', () => {
    expect(feedbackRecord([{feedback: 'SPECIFIC'}, {feedback: 'NONE'}, {feedback: 'GENERIC'}, {feedback: null}, {}]))
      .toBe('Gives feedback: 2 of 3 rejections')
    expect(feedbackRecord([{feedback: 'NONE'}])).toBe('Gives feedback: 0 of 1 rejection')
    expect(feedbackRecord([{feedback: null}])).toBeNull()
  })
})
