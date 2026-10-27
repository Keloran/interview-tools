import {describe, expect, it} from 'vitest'
import {isLink, jobKey} from '@/lib/jobLinks'

describe('jobKey', () => {
  it('LinkedIn: the job id, whatever the tracking or page', () => {
    const key = 'linkedin:4012345678'
    expect(jobKey('https://www.linkedin.com/jobs/view/4012345678/?refId=abc&trackingId=xyz')).toBe(key)
    expect(jobKey('https://uk.linkedin.com/jobs/view/senior-engineer-at-acme-4012345678')).toBe(key)
    expect(jobKey('https://www.linkedin.com/jobs/search/?currentJobId=4012345678&keywords=engineer')).toBe(key)
  })

  it('Indeed, Greenhouse, Lever and Workable ids', () => {
    expect(jobKey('https://uk.indeed.com/viewjob?jk=a1b2c3d4&from=serp')).toBe('indeed:a1b2c3d4')
    expect(jobKey('https://uk.indeed.com/jobs?q=engineer&vjk=a1b2c3d4')).toBe('indeed:a1b2c3d4')
    expect(jobKey('https://boards.greenhouse.io/acme/jobs/4567890?gh_src=x')).toBe('greenhouse:4567890')
    expect(jobKey('https://acme.com/careers/role?gh_jid=4567890')).toBe('greenhouse:4567890')
    expect(jobKey('https://jobs.lever.co/acme/0B1C2D3E-1111-2222-3333-444455556666/apply')).toBe('lever:0b1c2d3e-1111-2222-3333-444455556666')
    expect(jobKey('https://apply.workable.com/acme/j/ab12cd34ef/')).toBe('workable:AB12CD34EF')
  })

  it('anything else: the same page without tracking, case, www or trailing slash', () => {
    const key = jobKey('https://careers.acme.com/Jobs/123')
    expect(jobKey('http://www.careers.acme.com/jobs/123/?utm_source=linkedin&utm_medium=x')).toBe(key)
    expect(jobKey('careers.acme.com/jobs/123')).toBe(key)
    expect(jobKey('https://careers.acme.com/jobs/124')).not.toBe(key)
    expect(jobKey('https://careers.acme.com/apply?id=7&utm_source=x')).toBe('careers.acme.com/apply?id=7')
  })

  it('not a link', () => {
    expect(jobKey('')).toBeNull()
    expect(jobKey('Acme Ltd')).toBeNull()
  })
})

describe('isLink', () => {
  it('tells a pasted link from a company name', () => {
    expect(isLink('https://www.linkedin.com/jobs/view/1')).toBe(true)
    expect(isLink('linkedin.com/jobs/view/1')).toBe(true)
    expect(isLink('Acme Ltd')).toBe(false)
    expect(isLink('acme.com')).toBe(false) // a company called that, not a posting
  })
})
