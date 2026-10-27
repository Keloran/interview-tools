import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import {withQueryClient} from './utils'

let search = ''
const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({replace, push: vi.fn()}),
  usePathname: () => '/companies',
  useSearchParams: () => new URLSearchParams(search),
}))

const {default: CompaniesDirectory, PAGE_SIZE} = await import('@/components/CompaniesDirectory')

// 30 companies, given out of order: Company 01 … Company 30
const history = Array.from({length: 30}, (_, i) => {
  const n = String(30 - i).padStart(2, '0')
  return {id: i, name: `Company ${n}`, applications: [{id: i, jobTitle: n === '07' ? 'Rust Engineer' : 'Engineer', clientCompany: null, applicationDate: new Date().toISOString(), status: 'Awaiting response (Applied)', response: 'waiting'}]}
})

beforeEach(() => {
  search = ''
  replace.mockClear()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(history))))
})
afterEach(() => vi.unstubAllGlobals())

const names = () => screen.getAllByText(/^Company \d+$/).map((el) => el.textContent)

describe('CompaniesDirectory', () => {
  it('lists A–Z, a page at a time', async () => {
    render(withQueryClient(<CompaniesDirectory />))
    expect(await screen.findByText('Companies (30)')).toBeInTheDocument()
    expect(names()).toHaveLength(PAGE_SIZE)
    expect(names()[0]).toBe('Company 01')
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', {name: /Next/}))
    expect(replace).toHaveBeenCalledWith('/companies?page=2', {scroll: false})
  })

  it('shows the page in the URL', async () => {
    search = 'page=2'
    render(withQueryClient(<CompaniesDirectory />))
    await screen.findByText('Page 2 of 2')
    expect(names()).toEqual(['Company 26', 'Company 27', 'Company 28', 'Company 29', 'Company 30'])
  })

  it('searches by job title too, and a search goes back to page 1', async () => {
    search = 'q=rust&page=2'
    render(withQueryClient(<CompaniesDirectory />))
    expect(await screen.findByText('Companies (1)')).toBeInTheDocument()
    expect(names()).toEqual(['Company 07'])
    expect(screen.queryByRole('navigation', {name: 'Pages'})).not.toBeInTheDocument()

    await userEvent.setup().type(screen.getByLabelText('Search companies'), 'x')
    expect(replace).toHaveBeenLastCalledWith('/companies?q=rustx', {scroll: false})
  })
})
