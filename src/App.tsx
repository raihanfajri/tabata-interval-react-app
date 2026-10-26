import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'
import IntervalTimerScreen from './timer/IntervalTimerScreen.tsx'
import SavedWorkoutsScreen from './timer/SavedWorkoutsScreen.tsx'
import HistoryScreen from './timer/HistoryScreen.tsx'
import SettingsScreen from './timer/SettingsScreen.tsx'
import { loadSessions } from './timer/history.ts'
import { loadTimer } from './timer/persistence.ts'
import {
  addSavedWorkout,
  loadSavedWorkouts,
  removeSavedWorkout,
  storeSavedWorkouts,
  type SavedWorkout,
} from './timer/savedWorkouts.ts'
import {
  buildWorkout,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type TimerSettings,
} from './timer/settings.ts'

// Android back: home is the bottom of the history, so back there leaves the
// app. The form (with the timer above it) or the workout history sit on one
// entry marked like this.
const SCREEN_ENTRY = { intervalScreen: true }
const onScreenEntry = (state: unknown) =>
  typeof state === 'object' && state !== null && 'intervalScreen' in state
const pushScreenEntry = () => {
  if (!onScreenEntry(window.history.state)) window.history.pushState(SCREEN_ENTRY, '')
}

function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [name, setName] = useState('')
  // The saved workout the form is editing, if any; see SettingsScreen.
  const [savedName, setSavedName] = useState('')
  const [savedWorkouts, setSavedWorkouts] = useState(loadSavedWorkouts)
  // A workout still in progress (saved before the app was closed) continues on
  // the timer; otherwise the app opens on the saved workouts.
  const [screen, setScreen] = useState<'home' | 'form' | 'timer' | 'history'>(() => {
    if (!loadTimer(buildWorkout(settings))) return 'home'
    // Reopened on the timer: give it the form's entry to sit on, so back from
    // the timer reaches the form and then home. Idempotent, for StrictMode.
    pushScreenEntry()
    return 'timer'
  })
  // Opening a workout remounts the form with it.
  const [formKey, setFormKey] = useState(0)
  // Only a fresh Start from the form starts the timer by itself.
  const [autoStart, setAutoStart] = useState(false)
  const workout = useMemo(() => buildWorkout(settings), [settings])

  const openForm = (next: TimerSettings, nextName: string) => {
    setSettings(next)
    setName(nextName)
    setSavedName(nextName)
    setFormKey((k) => k + 1)
    pushScreenEntry()
    setScreen('form')
  }

  // Read when opened, so it includes the workout just done.
  const [sessions, setSessions] = useState(loadSessions)
  const openHistory = () => {
    setSessions(loadSessions())
    pushScreenEntry()
    setScreen('history')
  }

  // Back (by popstate or the back arrow) from the form or the history. The
  // timer pops its own entry back onto the form's, so only a pop below that
  // entry goes home.
  const onPop = useEffectEvent((event: PopStateEvent) => {
    if ((screen === 'form' || screen === 'history') && !onScreenEntry(event.state)) setScreen('home')
  })
  useEffect(() => {
    const handle = (event: PopStateEvent) => onPop(event)
    window.addEventListener('popstate', handle)
    return () => window.removeEventListener('popstate', handle)
  }, [])

  const backToHome = () => {
    window.history.back() // drop the screen's entry
    setScreen('home')
  }

  const start = (next: TimerSettings, nextName: string) => {
    saveSettings(next)
    setSettings(next)
    setName(nextName)
    setAutoStart(true)
    setScreen('timer')
  }

  const updateSaved = (next: SavedWorkout[]) => {
    storeSavedWorkouts(next)
    setSavedWorkouts(next)
  }

  const save = (savedAs: string, next: TimerSettings) => {
    updateSaved(addSavedWorkout(savedWorkouts, savedAs, next))
    setName(savedAs)
    setSavedName(savedAs)
  }

  const exit = useCallback(() => {
    setAutoStart(false)
    setScreen('form')
  }, [])

  if (screen === 'timer') {
    return <IntervalTimerScreen workout={workout} autoStart={autoStart} onExit={exit} />
  }
  if (screen === 'history') {
    return <HistoryScreen sessions={sessions} onBack={backToHome} />
  }
  if (screen === 'form') {
    return (
      <SettingsScreen
        key={formKey}
        initial={settings}
        initialName={name}
        workouts={savedWorkouts}
        savedName={savedName}
        onStart={start}
        onSave={save}
        onBack={backToHome}
      />
    )
  }
  return (
    <SavedWorkoutsScreen
      workouts={savedWorkouts}
      onChoose={(w) => openForm(w.settings, w.name)}
      onDelete={(w) => updateSaved(removeSavedWorkout(savedWorkouts, w.name))}
      onNew={() => openForm(DEFAULT_SETTINGS, '')}
      onHistory={openHistory}
    />
  )
}

export default App
