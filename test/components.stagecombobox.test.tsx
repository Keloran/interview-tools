import {describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import StageCombobox from '@/components/StageCombobox'

const stages = ['Phone Screen', 'First Stage', 'Technical Test', 'Technical Interview', 'Final Stage', 'Offer']
  .map((stage, id) => ({id, stage}))

describe('StageCombobox', () => {
  it('keeps process order, filters as you type, and picks a stage', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<StageCombobox id="s" stages={stages} value="" onChange={onChange}/>)

    await user.click(screen.getByRole('combobox'))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(stages.map((s) => s.stage))

    await user.type(screen.getByPlaceholderText('Search stages'), 'tech')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Technical Test', 'Technical Interview'])

    await user.click(screen.getByRole('option', {name: 'Technical Interview'}))
    expect(onChange).toHaveBeenCalledWith('Technical Interview')
  })
})
