import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { renderWithProviders } from './test/render.tsx'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

// Android back reaches the page as a popstate event.
const pressBack = () =>
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

const openApp = () => renderWithProviders(<App />, { advanceTimers: vi.advanceTimersByTime })

// Opens the app on the saved workouts and taps + for a new workout.
const openForm = async () => {
  const app = openApp()
  await app.user.click(screen.getByRole('button', { name: 'New workout' }))
  return app
}

describe('Saved workouts home screen', () => {
  it('opens on "Saved Workouts" with a + button when no workout is in progress', () => {
    openApp()

    expect(screen.getByRole('heading', { name: 'Saved Workouts' })).toBeInTheDocument()
    expect(screen.getByText('No saved workouts yet. Tap + to create one.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New workout' })).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('+ opens the "New Workout" form with the default values, no name and "Total 8:18"', async () => {
    await openForm()

    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Prepare (seconds)' })).toHaveValue('8')
    expect(screen.getByRole('textbox', { name: 'Work (seconds)' })).toHaveValue('20')
    expect(screen.getByRole('textbox', { name: 'Rest (seconds)' })).toHaveValue('10')
    expect(screen.getByRole('textbox', { name: 'Rest between sets (seconds)' })).toHaveValue('30')
    expect(screen.getByRole('textbox', { name: 'Sets' })).toHaveValue('2')
    expect(screen.getByRole('textbox', { name: 'Cycles per set' })).toHaveValue('8')
    expect(screen.getByText('Total 8:18')).toBeInTheDocument()
  })

  it('+ starts from the defaults even after other settings were used', async () => {
    const app = await openForm()
    await app.user.clear(screen.getByRole('textbox', { name: 'Sets' }))
    await app.user.type(screen.getByRole('textbox', { name: 'Sets' }), '3')
    await app.user.click(screen.getByRole('button', { name: 'Back' }))

    await app.user.click(screen.getByRole('button', { name: 'New workout' }))

    expect(screen.getByRole('textbox', { name: 'Sets' })).toHaveValue('2')
  })

  it.each([
    ['the back arrow', (app: ReturnType<typeof openApp>) => app.user.click(screen.getByRole('button', { name: 'Back' }))],
    ['Android back', () => pressBack()],
  ])('%s on the form returns to the saved workouts', async (_label, goBack) => {
    const app = await openForm()

    await goBack(app)

    expect(screen.getByRole('heading', { name: 'Saved Workouts' })).toBeInTheDocument()
  })
})

describe('New Workout form', () => {
  it('changing Work to 30s updates the total, and Start opens the timer whose Work screen shows 0:30 after Prepare', async () => {
    const { user } = await openForm()
    const work = screen.getByRole('textbox', { name: 'Work (seconds)' })

    await user.clear(work)
    await user.type(work, '30')
    expect(screen.getByText('Total 10:58')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(8_000)
    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('0:30')
  })
})

describe('Saved workouts', () => {
  const nameField = () => screen.getByRole('textbox', { name: 'Name' })
  const workField = () => screen.getByRole('textbox', { name: 'Work (seconds)' })

  const saveAs = async (app: ReturnType<typeof openApp>, name: string, workSec: string) => {
    await app.user.clear(nameField())
    await app.user.type(nameField(), name)
    await app.user.clear(workField())
    await app.user.type(workField(), workSec)
    await app.user.click(screen.getByRole('button', { name: 'Save' }))
  }

  const backToHome = (app: ReturnType<typeof openApp>) =>
    app.user.click(screen.getByRole('button', { name: 'Back' }))

  it('saved workouts appear on the home screen, newest first', async () => {
    const app = await openForm()
    await saveAs(app, 'Easy', '15')
    await saveAs(app, 'Hard', '45')

    await backToHome(app)

    expect(screen.getAllByRole('listitem').map((i) => i.textContent)).toEqual([
      expect.stringMatching(/^Hard/),
      expect.stringMatching(/^Easy/),
    ])
  })

  it('choosing a saved workout fills the form with its name and settings, and Start runs it', async () => {
    const app = await openForm()
    await saveAs(app, 'Hard', '45')
    await saveAs(app, 'Easy', '15')
    await backToHome(app)

    await app.user.click(screen.getByRole('button', { name: /^Hard/ }))

    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()
    expect(nameField()).toHaveValue('Hard')
    expect(workField()).toHaveValue('45')

    await app.user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(8_000)
    expect(screen.getByRole('timer')).toHaveTextContent('0:45')
  })

  it('saving under an existing name replaces that workout instead of adding another', async () => {
    const app = await openForm()
    await saveAs(app, 'Tabata', '20')
    await saveAs(app, 'tabata', '25')

    await backToHome(app)

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('listitem')).toHaveTextContent('tabataWork 0:25')
  })

  it('renaming a workout to another saved workout\'s name asks first, and Replace overwrites that one', async () => {
    const app = await openForm()
    await saveAs(app, 'Hard', '45')
    await backToHome(app)
    await app.user.click(screen.getByRole('button', { name: 'New workout' }))
    await saveAs(app, 'Easy', '15')
    await backToHome(app)
    await app.user.click(screen.getByRole('button', { name: /^Easy/ }))
    await app.user.clear(nameField())
    await app.user.type(nameField(), 'Hard')

    await app.user.click(screen.getByRole('button', { name: 'Save' }))
    await app.user.click(
      within(screen.getByRole('alertdialog', { name: 'Replace “Hard”?' })).getByRole('button', { name: 'Replace' }),
    )
    await backToHome(app)

    expect(screen.getAllByRole('listitem').map((i) => i.textContent)).toEqual([
      expect.stringMatching(/^HardWork 0:15/),
      expect.stringMatching(/^EasyWork 0:15/),
    ])
  })

  it("Android back on the replace sheet closes it and stays on the form", async () => {
    const app = await openForm()
    await saveAs(app, 'Hard', '45')
    await backToHome(app)
    await app.user.click(screen.getByRole('button', { name: 'New workout' }))
    await app.user.type(nameField(), 'Hard')
    await app.user.click(screen.getByRole('button', { name: 'Save' }))

    // In a browser, back pops the sheet's entry onto the form's.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { intervalScreen: true } }))
    })

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()
  })

  it('a deleted workout is gone from the list, and stays gone after a relaunch', async () => {
    const app = await openForm()
    await saveAs(app, 'Easy', '15')
    await saveAs(app, 'Hard', '45')
    await backToHome(app)

    await app.user.click(screen.getByRole('button', { name: 'Delete Hard' }))
    await app.user.click(
      within(screen.getByRole('alertdialog', { name: 'Delete “Hard”?' })).getByRole('button', { name: 'Delete' }),
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    app.unmount()
    openApp()
    expect(screen.getAllByRole('listitem').map((i) => i.textContent)).toEqual([expect.stringMatching(/^Easy/)])
  })
})

const startFromForm = async (app: ReturnType<typeof openApp>) => {
  await app.user.click(screen.getByRole('button', { name: 'Start' }))
}

describe('Workout history', () => {
  const openHistory = async (app: ReturnType<typeof openApp>) => {
    await app.user.click(screen.getByRole('button', { name: 'Workout history' }))
  }
  const total = () => screen.getByText('Total', { selector: 'dt' }).nextElementSibling

  it('the chart button opens "Workout History", and back returns to the saved workouts', async () => {
    const app = openApp()
    await openHistory(app)
    expect(screen.getByRole('heading', { name: 'Workout History' })).toBeInTheDocument()

    await pressBack()

    expect(screen.getByRole('heading', { name: 'Saved Workouts' })).toBeInTheDocument()
  })

  it('a finished workout counts at its full length', async () => {
    const app = await openForm()
    await app.user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(498_000)
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
    await pressBack() // Done → form
    await pressBack() // form → home

    await openHistory(app)

    expect(total()).toHaveTextContent('8m 18s')
    expect(screen.getByText('Workouts', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1')
  })

  it('a workout reset part-way counts for the time it ran, without the paused time', async () => {
    const app = await openForm()
    await app.user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(60_000)
    await pressBack() // pauses, opens the sheet
    await advance(30_000) // paused: not counted
    await app.user.click(
      within(screen.getByRole('alertdialog', { name: 'Reset workout and go back to settings?' })).getByRole('button', {
        name: 'Reset',
      }),
    )
    await pressBack() // form → home

    await openHistory(app)

    expect(total()).toHaveTextContent('1m 00s')
  })

  it('a workout that finished while the app was closed counts once', async () => {
    const app = await openForm()
    await app.user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(10_000)
    app.unmount()
    vi.setSystemTime(Date.now() + 600_000)

    const reopened = openApp() // shows Done once
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
    reopened.unmount()
    const third = openApp()
    await openHistory(third)

    expect(total()).toHaveTextContent('8m 18s')
  })
})

describe('Android back and reopening', () => {
  const exitSheet = () =>
    screen.getByRole('alertdialog', { name: 'Reset workout and go back to settings?' })

  it('back on the idle timer goes straight to the form', async () => {
    const app = await openForm()
    await startFromForm(app)
    await app.user.click(screen.getByRole('button', { name: 'Reset' }))
    await app.user.click(
      within(screen.getByRole('alertdialog', { name: 'Reset workout?' })).getByRole('button', { name: 'Reset' }),
    )
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument() // idle timer

    await pressBack()

    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()
  })

  it('back on the Done timer goes straight to the form', async () => {
    const app = await openForm()
    await startFromForm(app)
    await advance(508_000)
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()

    await pressBack()

    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()
  })

  it('back while running pauses the countdown and shows "Reset workout and go back to settings?"', async () => {
    const app = await openForm()
    await startFromForm(app)
    await advance(3_000) // Prepare 5

    await pressBack()
    await advance(10_000)

    expect(exitSheet()).toBeInTheDocument()
    expect(screen.getByRole('timer', { hidden: true })).toHaveTextContent(/^5$/)
  })

  it('in that sheet, Cancel continues the workout from where it was, without counting the sheet time', async () => {
    const app = await openForm()
    await startFromForm(app)
    await advance(3_000) // Prepare 5
    await pressBack()
    await advance(10_000)

    await app.user.click(within(exitSheet()).getByRole('button', { name: 'Cancel' }))
    await advance(1_000)

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(/^4$/)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('back again while that sheet is open dismisses it like Cancel, and the workout continues', async () => {
    const app = await openForm()
    await startFromForm(app)
    await advance(3_000) // Prepare 5
    await pressBack()
    expect(exitSheet()).toBeInTheDocument()

    await pressBack()
    await advance(1_000)

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(/^4$/)
  })

  it('in that sheet, Cancel while it was already paused keeps it paused', async () => {
    const app = await openForm()
    await startFromForm(app)
    await advance(3_000)
    await app.user.click(screen.getByRole('button', { name: 'Pause' }))
    await pressBack()

    await app.user.click(within(exitSheet()).getByRole('button', { name: 'Cancel' }))
    await advance(5_000)

    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(/^5$/)
  })

  it('in that sheet, Reset clears the workout and shows the form with the same settings', async () => {
    const app = await openForm()
    const work = screen.getByRole('textbox', { name: 'Work (seconds)' })
    await app.user.clear(work)
    await app.user.type(work, '45')
    await startFromForm(app)
    await advance(3_000)
    await pressBack()

    await app.user.click(within(exitSheet()).getByRole('button', { name: 'Reset' }))

    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Work (seconds)' })).toHaveValue('45')
  })

  it("the timer's own history.back() after Reset lands on the form's entry and stays on the form", async () => {
    const app = await openForm()
    await startFromForm(app)
    await advance(3_000)
    await pressBack()
    await app.user.click(within(exitSheet()).getByRole('button', { name: 'Reset' }))

    // In a browser, that back() pops the timer's entry onto the form's.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { intervalScreen: true } }))
    })

    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()
  })

  it('reopening the app mid-workout continues the last session on the timer with its custom times', async () => {
    const app = await openForm()
    const work = screen.getByRole('textbox', { name: 'Work (seconds)' })
    await app.user.clear(work)
    await app.user.type(work, '45')
    await startFromForm(app)
    await advance(10_000) // Work 0:43

    app.unmount()
    vi.setSystemTime(Date.now() + 5_000)
    openApp()

    expect(screen.queryByRole('heading', { name: 'New Workout' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('0:38')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('after a workout, back on the form returns to the saved workouts', async () => {
    const app = await openForm()
    await startFromForm(app)
    await advance(508_000)
    await pressBack() // Done → form

    await pressBack()

    expect(screen.getByRole('heading', { name: 'Saved Workouts' })).toBeInTheDocument()
  })

  it('reopened mid-workout, Reset from the back sheet shows the form, and back from there reaches the saved workouts', async () => {
    const app = await openForm()
    await startFromForm(app)
    await advance(3_000)
    app.unmount()
    const reopened = openApp()

    await pressBack()
    await reopened.user.click(within(exitSheet()).getByRole('button', { name: 'Reset' }))
    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()

    await pressBack()
    expect(screen.getByRole('heading', { name: 'Saved Workouts' })).toBeInTheDocument()
  })

  it('reopening after a workout was reset (from the back sheet) opens on the saved workouts', async () => {
    const app = await openForm()
    await startFromForm(app)
    await advance(3_000)
    await pressBack()
    await app.user.click(within(exitSheet()).getByRole('button', { name: 'Reset' }))

    app.unmount()
    openApp()

    expect(screen.getByRole('heading', { name: 'Saved Workouts' })).toBeInTheDocument()
  })

  it('reopening after a workout finished opens on the saved workouts', async () => {
    const app = await openForm()
    await startFromForm(app)
    await advance(508_000)
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()

    app.unmount()
    openApp()

    expect(screen.getByRole('heading', { name: 'Saved Workouts' })).toBeInTheDocument()
  })
})

// Default workout: Prepare 8s; set 1 = 7 × (Work 20s, Rest 10s) + Work; 30s break; set 2 = 8 × (Work, Rest).
describe('App', () => {
  it('after Start on the form, shows the Prepare screen: "Prepare", 8, "Next: Work · 0:20" and chips "Set 1/2" and "Round 1/8"', async () => {
    const { user } = await openForm()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(screen.getByRole('heading', { name: 'Prepare' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(/^8$/)
    expect(screen.getByText('Next: Work · 0:20')).toBeInTheDocument()
    expect(screen.getByText('Set 1/2')).toBeInTheDocument()
    expect(screen.getByText('Round 1/8')).toBeInTheDocument()
  })

  it('labels the chips for TalkBack as "Set 1 of 2" and "Round 1 of 8"', async () => {
    const { user } = await openForm()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(screen.getByText('Set 1 of 2')).toHaveClass('visually-hidden')
    expect(screen.getByText('Round 1 of 8')).toHaveClass('visually-hidden')
    expect(screen.getByText('Set 1/2')).toHaveAttribute('aria-hidden', 'true')
  })

  it('alternates to 10s of Rest after the first Work interval', async () => {
    const { user } = await openForm()

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(28_000)

    expect(screen.getByRole('heading', { name: 'Rest' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('0:10')
    expect(screen.getByText('Round 1/8')).toBeInTheDocument()
  })

  it("the first Work screen shows 'Round 1/8' and set 1's last Work screen shows 'Round 8/8'", async () => {
    const { user } = await openForm()

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(8_000) // first Work
    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByText('Round 1/8')).toBeInTheDocument()

    await advance(7 * 30_000) // set 1's last Work
    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByText('Round 8/8')).toBeInTheDocument()
  })

  describe('Rest between sets', () => {
    const startAndAdvance = async (ms: number) => {
      const app = await openForm()
      await app.user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(ms)
      return app
    }

    it("after set 1's last Work, shows the break screen: 'Set 1 complete', 'Rest between sets', 0:30, the Next line and chips Set 1/2, Round 8/8", async () => {
      await startAndAdvance(238_000)

      expect(screen.getByText('Set 1 complete')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Rest between sets' })).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent('0:30')
      expect(screen.getByText('Next: Set 2 · Work 0:20')).toBeInTheDocument()
      expect(screen.getByText('Set 1/2')).toBeInTheDocument()
      expect(screen.getByText('Round 8/8')).toBeInTheDocument()
    })

    it("the normal Rest screen shows no 'Set … complete' line and no Next line", async () => {
      await startAndAdvance(28_000) // set 1's first Rest

      expect(screen.getByRole('heading', { name: 'Rest' })).toBeInTheDocument()
      expect(screen.queryByText(/complete$/)).not.toBeInTheDocument()
      expect(screen.queryByText(/^Next:/)).not.toBeInTheDocument()
    })

    it("when the break ends, set 2's first Work shows chips Set 2/2 and Round 1/8", async () => {
      await startAndAdvance(268_000)

      expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
      expect(screen.getByText('Set 2/2')).toBeInTheDocument()
      expect(screen.getByText('Round 1/8')).toBeInTheDocument()
    })

    it('pausing during the break shows Paused and Resume on the break screen', async () => {
      const { user } = await startAndAdvance(245_000)

      await user.click(screen.getByRole('button', { name: 'Pause' }))

      expect(screen.getByRole('heading', { name: 'Rest between sets' })).toBeInTheDocument()
      expect(screen.getByText('Set 1 complete')).toBeInTheDocument()
      expect(screen.getByText('Paused')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    })

    it("Done follows set 2's last Work, with no Rest and no second break in between", async () => {
      await startAndAdvance(497_000) // set 2's last Work, 0:01 left

      expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
      expect(screen.getByText('Round 8/8')).toBeInTheDocument()
      expect(screen.getByText('Set 2/2')).toBeInTheDocument()

      await advance(1_000)
      expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
    })

    it("announces 'Rest between sets, 30 seconds' in the live region when the break begins", async () => {
      await startAndAdvance(238_000)

      expect(screen.getByRole('status')).toHaveTextContent('Rest between sets, 30 seconds')
    })
  })
})
