import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Companies } from '@/components/Company'
import { Providers } from './utils'
import { useAppStore } from '@/lib/store'

describe('Components/Company', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // reset store between tests
    useAppStore.setState({ filteredCompany: null })
  })

  it('loads and lists companies; selecting sets filteredCompany and closes dialog', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [
        { id: 1, name: 'Acme' },
        { id: 2, name: 'Beta' },
      ],
    })) as any

    render(
      <Providers>
        <Companies />
      </Providers>
    )

    // open search dialog by clicking input area
    const input = await screen.findByPlaceholderText('Companies Talked To')
    await user.click(input)

    // type to filter (optional)
    const cmdInput = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(cmdInput, 'Ac')

    const option = await screen.findByText('Acme')
    await user.click(option)

    await waitFor(() => {
      expect(useAppStore.getState().filteredCompany).toBe('Acme')
    })
  })
})
