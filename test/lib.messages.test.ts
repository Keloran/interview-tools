import {describe, expect, it} from 'vitest'
import {availabilityMessage, MessageContext, TemplateId, TEMPLATES, templatesFor} from '@/lib/messages'

const at = (h: number, m = 0) => new Date(2026, 5, 1, h, m)
const now = at(12).getTime()
const hhmm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

const bare: MessageContext = {jobTitle: 'Senior Engineer', company: 'Payter', formatDate: hhmm}
const full: MessageContext = {...bare, clientCompany: 'Acme', stage: 'Technical', interviewer: 'Sam Jones', date: at(10)}

describe('TEMPLATES', () => {
  const ids = Object.keys(TEMPLATES) as TemplateId[]

  it.each(ids)('%s renders cleanly with and without the optional details', (id) => {
    for (const ctx of [bare, full]) {
      const msg = TEMPLATES[id].render(ctx)
      expect(msg).not.toMatch(/undefined|null|  |\n\n\n/)
      expect(msg).toContain('Senior Engineer role')
    }
  })

  it('greets the interviewer by first name and names the agency client', () => {
    const msg = TEMPLATES['thank-you'].render(full)
    expect(msg).toMatch(/^Hi Sam,/)
    expect(msg).toContain('in my Technical interview on 10:00 about the Senior Engineer role with Acme.')
    expect(TEMPLATES['thank-you'].render(bare)).toMatch(/^Hi,\n/)
  })

  it('follow-up on a bare application talks about the application', () => {
    expect(TEMPLATES['follow-up'].render({...bare, stage: 'Applied'}))
      .toContain('follow up on my application for the Senior Engineer role at Payter.')
  })
})

describe('templatesFor', () => {
  it('offers the messages that fit where things are', () => {
    expect(templatesFor({stage: 'Applied', outcome: 'AWAITING_RESPONSE', date: at(9)}, now)).toEqual(['follow-up', 'withdraw'])
    expect(templatesFor({stage: 'Technical', outcome: 'SCHEDULED', date: at(14)}, now)).toEqual(['follow-up', 'withdraw'])
    expect(templatesFor({stage: 'Technical', outcome: 'AWAITING_RESPONSE', date: at(10)}, now)).toEqual(['thank-you', 'follow-up', 'withdraw'])
    expect(templatesFor({stage: 'Offer', outcome: 'AWAITING_RESPONSE'}, now)).toEqual(['accept-offer', 'decline-offer'])
    expect(templatesFor({stage: 'Technical', outcome: 'REJECTED'}, now)).toEqual(['ask-feedback'])
    expect(templatesFor({stage: 'Offer', outcome: 'OFFER_ACCEPTED'}, now)).toEqual([])
  })
})

describe('availabilityMessage', () => {
  it('lists the times and the booking link', () => {
    const msg = availabilityMessage({
      jobTitle: 'Senior Engineer', company: 'Payter', slots: [at(10), at(14)], url: 'https://x/availability/abc',
      formatSlot: hhmm, timeZoneLabel: 'BST',
    })
    expect(msg).toContain('the Senior Engineer role at Payter')
    expect(msg).toContain('(BST):\n\n- 10:00\n- 14:00\n')
    expect(msg).toContain('book whichever suits you here: https://x/availability/abc')
  })
})
