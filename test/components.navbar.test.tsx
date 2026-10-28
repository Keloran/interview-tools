import {afterEach, describe, expect, it, vi} from 'vitest'
import {render, screen, within} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import {withQueryClient} from './utils'

// signed in, with 3 follow-ups due
vi.mock('@clerk/nextjs', () => {
  const UserButton = () => <div>avatar</div>
  UserButton.MenuItems = function MenuItems() { return null }
  UserButton.Link = function MenuLink() { return null }
  return {
    useUser: () => ({user: {id: 'user_123'}}),
    SignedIn: ({children}: { children: React.ReactNode }) => <>{children}</>,
    SignedOut: () => null,
    SignInButton: () => null,
    UserButton,
  }
})

const {default: Navbar} = await import('@/components/Navbar')
afterEach(() => vi.unstubAllGlobals())

describe('Navbar navigation sheet', () => {
  it('puts the links in a menu, flags follow-ups on its button, and closes when you pick one', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes('follow-ups') ? [{}, {}, {}] : []))))
    const user = userEvent.setup()
    render(withQueryClient(<Navbar />))

    const menuButton = screen.getByRole('button', {name: 'Menu'})
    expect(await within(menuButton).findByLabelText('Follow-ups due')).toBeInTheDocument()

    await user.click(menuButton)
    const menu = await screen.findByRole('dialog', {name: 'Menu'})
    expect(within(menu).getByRole('link', {name: 'Companies'})).toHaveAttribute('href', '/companies')
    expect(within(menu).getByRole('link', {name: /No Feedback/})).toHaveTextContent('3')
    expect(within(menu).getByRole('link', {name: 'Roadmap'})).toBeInTheDocument()
    expect(within(menu).getByRole('link', {name: 'Questions'})).toHaveAttribute('href', '/questions')
    expect(within(menu).getByRole('link', {name: 'Stories'})).toHaveAttribute('href', '/stories')
    expect(within(menu).getByRole('link', {name: 'Report'})).toHaveAttribute('href', '/report')

    await user.click(within(menu).getByRole('link', {name: 'Stories'}))
    expect(screen.queryByRole('dialog', {name: 'Menu'})).not.toBeInTheDocument()
  })
  it('closes with Escape or the installed close button and restores focus', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
    const user = userEvent.setup()
    render(withQueryClient(<Navbar />))
    const trigger = screen.getByRole('button', {name: 'Menu'})
    await user.click(trigger)
    expect(await screen.findByRole('dialog', {name: 'Menu'})).toHaveAttribute('aria-describedby')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    await user.click(screen.getByRole('button', {name: 'Close'}))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

})
