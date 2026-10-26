import { useEffect, useEffectEvent, useId, useState } from 'react'
import { describeSettings, type SavedWorkout } from './savedWorkouts.ts'
import './SavedWorkoutsScreen.css'
import './sheet.css'

interface Props {
  workouts: SavedWorkout[]
  onChoose: (workout: SavedWorkout) => void
  onDelete: (workout: SavedWorkout) => void
  // The + button: a new workout on the form.
  onNew: () => void
  // The chart button: the Workout History screen.
  onHistory: () => void
}

// The home screen: the saved workouts, newest first. Tapping one opens it on
// the form; + starts a new one. Android back here leaves the app.
function SavedWorkoutsScreen({ workouts, onChoose, onDelete, onNew, onHistory }: Props) {
  const [deleting, setDeleting] = useState<SavedWorkout | null>(null)
  const dialogTitleId = useId()

  // The delete sheet adds one history entry while it's open, so Android back
  // dismisses it instead of leaving the app.
  const askDelete = (workout: SavedWorkout) => {
    window.history.pushState({ savedWorkoutsSheet: true }, '')
    setDeleting(workout)
  }
  const onBack = useEffectEvent(() => setDeleting(null))
  useEffect(() => {
    if (!deleting) return
    const handle = () => onBack()
    window.addEventListener('popstate', handle)
    return () => window.removeEventListener('popstate', handle)
  }, [deleting])

  // Closing by a tap drops the entry pushed on open.
  const closeSheet = () => {
    window.history.back()
    setDeleting(null)
  }

  const confirmDelete = () => {
    if (deleting) onDelete(deleting)
    closeSheet()
  }

  return (
    <>
      <main className="saved" inert={deleting !== null}>
        <h1 className="saved__title">Saved Workouts</h1>

        {workouts.length === 0 ? (
          <p className="saved__empty">No saved workouts yet. Tap + to create one.</p>
        ) : (
          <ul className="saved__list">
            {workouts.map((workout) => (
              <li className="saved__item" key={workout.name}>
                <button type="button" className="saved__choose" onClick={() => onChoose(workout)}>
                  <span className="saved__name">{workout.name}</span>
                  <span className="saved__summary">{describeSettings(workout.settings)}</span>
                </button>
                <button
                  type="button"
                  className="saved__delete"
                  aria-label={`Delete ${workout.name}`}
                  onClick={() => askDelete(workout)}
                >
                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Secondary, so it doesn't compete with +: bottom left, also in thumb reach. */}
        <button type="button" className="saved__history" aria-label="Workout history" onClick={onHistory}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path fill="currentColor" d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z" />
          </svg>
        </button>
        {/* Material 3 FAB: bottom right, in thumb reach. */}
        <button type="button" className="saved__new" aria-label="New workout" onClick={onNew}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>
      </main>

      {deleting && (
        <div className="scrim">
          <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby={dialogTitleId}>
            <h2 id={dialogTitleId} className="sheet__title">
              Delete “{deleting.name}”?
            </h2>
            <p className="sheet__body">This saved workout will be removed.</p>
            <button type="button" className="sheet__danger" onClick={confirmDelete}>
              Delete
            </button>
            {/* Last = nearest the thumb, so the safe choice is the easiest one. */}
            <button type="button" className="sheet__cancel" onClick={closeSheet} autoFocus>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default SavedWorkoutsScreen
