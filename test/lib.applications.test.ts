import {describe, expect, it} from 'vitest'
import {findPreviousApplications, responseRecord, searchCompanies, summarizeApplication, timeAgo} from '@/lib/applications'

const now = new Date('2026-06-01T00:00:00Z').getTime()
const daysAgo = (d: number) => new Date(now - d * 864e5)

describe('summarizeApplication', () => {
  it('ghosted: only applied, nothing for 30+ days', () => {
    expect(summarizeApplication([{stage: 'Applied', outcome: 'AWAITING_RESPONSE', updatedAt: daysAgo(45)}], now))
      .toEqual({status: 'No response after Applied', response: 'ghosted'})
  })

  it('still waiting inside 30 days', () => {
    expect(summarizeApplication([{stage: 'Applied', outcome: 'AWAITING_RESPONSE', updatedAt: daysAgo(3)}], now))
      .toEqual({status: 'Awaiting response (Applied)', response: 'waiting'})
  })

  it('went quiet after an interview still counts as responded', () => {
    expect(summarizeApplication([
      {stage: 'Technical', outcome: 'AWAITING_RESPONSE', updatedAt: daysAgo(60)},
      {stage: 'Applied', outcome: 'PASSED', updatedAt: daysAgo(90)},
    ], now)).toEqual({status: 'No response after Technical', response: 'responded'})
  })

  it('rejection straight from applied is a response', () => {
    expect(summarizeApplication([{stage: 'Applied', outcome: 'REJECTED', updatedAt: daysAgo(10)}], now))
      .toEqual({status: 'Rejected at Applied', response: 'responded', feedback: null})
  })

  it('offers', () => {
    expect(summarizeApplication([{stage: 'Offer', outcome: 'OFFER_ACCEPTED', updatedAt: daysAgo(1)}], now).status).toBe('Offer accepted')
  })
})

describe('timeAgo', () => {
  it('reads naturally', () => {
    expect(timeAgo(daysAgo(7), now)).toBe('last week')
    expect(timeAgo(daysAgo(180), now)).toBe('6 months ago')
    expect(timeAgo(daysAgo(400), now)).toBe('last year')
  })
})

describe('responseRecord', () => {
  const app = (response: 'responded' | 'waiting' | 'ghosted') => ({id: 1, jobTitle: 'SE', clientCompany: null, applicationDate: '', status: '', response})
  it('summarises how a company treats you', () => {
    expect(responseRecord([app('ghosted'), app('ghosted')])).toBe('Ghosted you 2 times')
    expect(responseRecord([app('ghosted')])).toBe('Never responded')
    expect(responseRecord([app('responded'), app('ghosted'), app('waiting')])).toBe('Responded to 1 of 2')
    expect(responseRecord([app('waiting')])).toBeNull()
  })
})

describe('findPreviousApplications', () => {
  const app = (id: number, jobTitle: string, clientCompany: string | null = null) =>
    ({id, jobTitle, clientCompany, applicationDate: '', status: '', response: 'waiting' as const})
  const history = [
    {id: 1, name: 'Recruit Co', applications: [app(1, 'Senior Engineer', 'BigBank')]},
    {id: 2, name: 'BigBank', applications: [app(2, 'Data Analyst')]},
    {id: 3, name: 'Other', applications: [app(3, 'Senior Engineer')]},
  ]

  it('finds a job applied for via a recruiter when you find it direct', () => {
    const found = findPreviousApplications(history, 'bigbank', '', 'senior engineer')
    expect(found.map((f) => [f.id, f.sameTitle])).toEqual([[1, true], [2, false]])
  })

  it('finds a direct application when a recruiter lists it', () => {
    expect(findPreviousApplications(history, 'Another Recruiter', 'BigBank', 'Data Analyst')[0]).toMatchObject({id: 2, sameTitle: true})
  })

  it('nothing without a company', () => {
    expect(findPreviousApplications(history, '', '', 'Senior Engineer')).toEqual([])
  })

  it('recognises title variations through a recruiter and ranks them before other roles', () => {
    const history = [{id: 1, name: 'Recruit Co', applications: [
      app(1, 'Engineering Manager', 'BigBank'),
      app(2, 'Sr. Back-end Dev (m/f/d) - Remote', 'BigBank'),
    ]}]
    expect(findPreviousApplications(history, 'BigBank', '', 'Senior Backend Engineer')
      .map((a) => [a.id, a.sameTitle])).toEqual([[2, true], [1, false]])
  })

  it('keeps a different role as company history without flagging it as the same title', () => {
    const history = [{id: 1, name: 'BigBank', applications: [app(1, 'Engineering Manager')]}]
    expect(findPreviousApplications(history, 'BigBank', '', 'Engineer')[0])
      .toMatchObject({id: 1, sameTitle: false})
  })
})

describe('summarizeApplication with availability links', () => {
  const applied = [{stage: 'Phone Screen', outcome: 'PASSED', updatedAt: daysAgo(12)}]
  const sent = (days: number, o: object = {}) => ({created_at: daysAgo(days), viewCount: 0, lastViewedAt: null, bookedSlot: null, ...o})

  it('a link they never opened shows as ghosting', () => {
    expect(summarizeApplication(applied, now, [sent(10)]).status).toBe('Availability link never opened (sent last week)')
  })

  it('not yet, if it was opened, or if things moved on', () => {
    expect(summarizeApplication(applied, now, [sent(3)]).status).toBe('Passed Phone Screen')
    expect(summarizeApplication(applied, now, [sent(10, {viewCount: 1, lastViewedAt: daysAgo(9)})]).status).toBe('Passed Phone Screen')
    const rejected = [{stage: 'Phone Screen', outcome: 'REJECTED', updatedAt: daysAgo(1)}]
    expect(summarizeApplication(rejected, now, [sent(10)]).status).toBe('Rejected at Phone Screen')
  })
})

describe('summarizeApplication with follow-ups', () => {
  const now = new Date('2026-06-01T12:00:00Z').getTime()
  const daysAgo = (n: number) => new Date(now - n * 864e5)
  const applied = [{stage: 'Applied', outcome: 'AWAITING_RESPONSE', updatedAt: daysAgo(14)}]

  it('says you chased them, and two unanswered follow-ups count as ghosting', () => {
    expect(summarizeApplication(applied, now, [], 1)).toEqual({status: 'Followed up once, no response', response: 'waiting'})
    expect(summarizeApplication(applied, now, [], 2)).toEqual({status: 'Followed up twice, no response', response: 'ghosted'})
  })

  it('once they have replied, follow-ups do not make it ghosting', () => {
    const interviewed = [{stage: 'Technical', outcome: 'AWAITING_RESPONSE', updatedAt: daysAgo(14)}, ...applied]
    expect(summarizeApplication(interviewed, now, [], 3).response).toBe('responded')
  })
})

describe('findPreviousApplications by job link', () => {
  const app = (id: number, jobTitle: string, jobPostingLink: string | null) =>
    ({id, jobTitle, clientCompany: null, jobPostingLink, applicationDate: '', status: '', response: 'waiting' as const})
  const history = [
    {id: 1, name: 'Hays', applications: [app(1, 'Software Engineer', 'https://www.linkedin.com/jobs/view/4012345678/?trackingId=a')]},
    {id: 2, name: 'Acme', applications: [app(2, 'Senior Engineer', null)]},
  ]

  it('the same posting matches even when the company was entered differently, and comes first', () => {
    const found = findPreviousApplications(history, 'Acme', '', 'Senior Engineer', 'https://uk.linkedin.com/jobs/view/4012345678?refId=b')
    expect(found.map((f) => [f.id, f.samePosting, f.sameTitle])).toEqual([[1, true, false], [2, false, true]])
  })

  it('a link alone is enough to search', () => {
    expect(findPreviousApplications(history, '', '', '', 'linkedin.com/jobs/view/4012345678').map((f) => f.id)).toEqual([1])
    expect(findPreviousApplications(history, '', '', '', 'https://example.com/jobs/1')).toEqual([])
  })
})

describe('searchCompanies', () => {
  const app = (jobTitle: string, clientCompany: string | null = null) =>
    ({id: 1, jobTitle, clientCompany, applicationDate: '', status: '', response: 'waiting' as const})
  const history = [
    {id: 1, name: 'zebra Ltd', applications: [app('Engineer')]},
    {id: 2, name: 'Hays', applications: [app('Platform Engineer', 'Admiral')]},
    {id: 3, name: 'admiral', applications: [app('Tester')]},
  ]

  it('sorts A–Z ignoring case', () => {
    expect(searchCompanies(history, '').map((c) => c.name)).toEqual(['admiral', 'Hays', 'zebra Ltd'])
  })

  it('matches the company, a recruiter\'s client or a job title', () => {
    expect(searchCompanies(history, 'ADMIRAL').map((c) => c.name)).toEqual(['admiral', 'Hays'])
    expect(searchCompanies(history, 'tester').map((c) => c.name)).toEqual(['admiral'])
    expect(searchCompanies(history, 'nope')).toEqual([])
  })
})
