import { act, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getMockSavedWorkout } from '../test/factories.ts'
import { renderWithProviders } from '../test/render.tsx'
import type { SavedWorkout } from './savedWorkouts.ts'
import SavedWorkoutsScreen from './SavedWorkoutsScreen.tsx'
import { DEFAULT_SETTINGS } from './settings.ts'

const hard = getMockSavedWorkout({ name: 'Hard', settings: { ...DEFAULT_SETTINGS, workSec: 45 } })
const tabata = getMockSavedWorkout()

const renderList = (workouts: SavedWorkout[] = [hard, tabata]) => {
  const props = { onChoose: vi.fn(), onDelete: vi.fn(), onNew: vi.fn(), onHistory: vi.fn() }
  const view = renderWithProviders(<SavedWorkoutsScreen workouts={workouts} {...props} />)
  return { ...view, ...props }
}

// Android back reaches the page as a popstate event.
const pressBack = () =>
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

const deleteSheet = (name: string) => screen.getByRole('alertdialog', { name: `Delete “${name}”?` })

describe('SavedWorkoutsScreen', () => {
  it('lists each workout in order with its name and summary', () => {
    renderList()

    expect(screen.getByRole('heading', { name: 'Saved Workouts' })).toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Hard')
    expect(items[0]).toHaveTextContent('Work 0:45 · Rest 0:10 · 2 × 8 · 14:58')
    expect(items[1]).toHaveTextContent('Tabata')
    expect(items[1]).toHaveTextContent('Work 0:20 · Rest 0:10 · 2 × 8 · 8:18')
  })

  it('with nothing saved, explains how to save a workout', () => {
    renderList([])

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByText('No saved workouts yet. Tap + to create one.')).toBeInTheDocument()
  })

  it('tapping a workout calls onChoose with it', async () => {
    const { user, onChoose } = renderList()

    await user.click(screen.getByRole('button', { name: /^Hard/ }))

    expect(onChoose).toHaveBeenCalledWith(hard)
  })

  it('the + button calls onNew', async () => {
    const { user, onNew } = renderList([])

    await user.click(screen.getByRole('button', { name: 'New workout' }))

    expect(onNew).toHaveBeenCalled()
  })

  it('the chart button calls onHistory', async () => {
    const { user, onHistory } = renderList([])

    await user.click(screen.getByRole('button', { name: 'Workout history' }))

    expect(onHistory).toHaveBeenCalled()
  })

  it('leaves Android back alone while no sheet is open, so back leaves the app', () => {
    const pushState = vi.spyOn(window.history, 'pushState')
    renderList()

    expect(pushState).not.toHaveBeenCalled()
  })

  describe('deleting', () => {
    it('asks "Delete “Hard”?" first, with Cancel focused, and Delete calls onDelete', async () => {
      const { user, onDelete } = renderList()

      await user.click(screen.getByRole('button', { name: 'Delete Hard' }))

      expect(within(deleteSheet('Hard')).getByRole('button', { name: 'Cancel' })).toHaveFocus()
      expect(onDelete).not.toHaveBeenCalled()

      await user.click(within(deleteSheet('Hard')).getByRole('button', { name: 'Delete' }))

      expect(onDelete).toHaveBeenCalledWith(hard)
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('Cancel closes the sheet and deletes nothing', async () => {
      const { user, onDelete } = renderList()
      await user.click(screen.getByRole('button', { name: 'Delete Hard' }))

      await user.click(within(deleteSheet('Hard')).getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(onDelete).not.toHaveBeenCalled()
    })

    it('Android back while the sheet is open dismisses it and stays on the list', async () => {
      const { user, onDelete } = renderList()
      await user.click(screen.getByRole('button', { name: 'Delete Hard' }))

      await pressBack()

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Saved Workouts' })).toBeInTheDocument()
      expect(onDelete).not.toHaveBeenCalled()
    })
  })
})
