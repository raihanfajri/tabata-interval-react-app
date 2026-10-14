# Interval App

An installable PWA interval timer for Android, also built as a sideloaded Android APK (Capacitor). A "New Workout" form sets the times, then the timer screen counts down through the workout's intervals with Start, Pause/Resume and Reset. Code lives in `src/timer/`.

## Behaviour

Decided 2026-10-14 (plans `interval-timer-screen`, `prepare-timer`, `add-sets-and-rest-between-sets-screen`, `android-apk` and `custom-time-settings`, all closed the same day).

- **Workout:** built from the form's settings by `buildWorkout(settings)` in `src/timer/settings.ts`, using `withSets()` and `withPrepare()`. With the defaults (Prepare 8s, Work 20s, Rest 10s, Rest between sets 30s, 2 sets × 8 cycles):
  1. Prepare, 8s.
  2. Set 1: Work/Rest × 7, then Work.
  3. Rest between sets, 30s. It replaces set 1's last 10s Rest.
  4. Set 2: Work/Rest × 8.
  5. Done.

  That's 33 intervals and 8:28 in total. **0 removes that screen:**
  - Prepare 0 means Start goes straight to Work.
  - Rest 0 means Work follows Work.
  - Rest between sets 0 means no break, so each set keeps its last Rest and sets run back to back.

  Work is at least 1s. The workout's name encodes every setting, e.g. "Custom 8/20/10/30 · 2×8".
- **New Workout form:** the screen the app opens on, headed "New Workout".

  | Field | Limits | − / + step |
  |---|---|---|
  | Prepare (seconds) | 0–60 | 5 |
  | Work (seconds) | 1–600 | 5 |
  | Rest (seconds) | 0–600 | 5 |
  | Rest between sets (seconds) | 0–600 | 5 |
  | Sets | 1–10 | 1 |
  | Cycles per set | 1–30 | 1 |

  - **Editing:** − / + stop at the limits, and from an invalid value they start over at the minimum. Tapping a value opens the numeric keyboard for exact entry.
  - **Errors:** an empty, non-whole or out-of-range value shows an error under its field (announced, and tied to the field by `aria-describedby`). The large bottom Start button is disabled until it's fixed.
  - **Total:** a "Total 8:28" line updates as values change, and shows "Total –" while any value is invalid.
  - **Remembered:** Start saves the settings (`localStorage`), and the next launch shows them. Corrupt data or blocked storage falls back to the defaults without errors.
- **Navigation and Android back:** Start on the form opens the timer and starts the workout at once. There's no in-app back or Settings button. Android back is the way to the form.
  - **Running or paused:** back pauses the workout and opens a "Reset workout and go back to settings?" sheet. Cancel returns to the previous state, like the Reset sheet. Reset clears the workout and shows the form with the same settings.
  - **Back while a sheet is open:** dismisses it like Cancel.
  - **Idle or Done timer:** back goes straight to the form.
  - **On the form:** back leaves the app.
  - **Reopening:** mid-workout the app opens on the timer and continues that session. Otherwise it opens on the form.
- **Prepare screen:** Prepare (interval kind `prepare`) gets its own screen. Start on the form counts it down from its set length.
  - The whole screen is amber, edge to edge.
  - A large "PREPARE" heading and a seconds-only countdown (8, 7 … 1 by default, rounded up).
  - A "Next: Work · 0:20" line naming the following interval.
  - The Set and Round chips, Reset and the Pause button.

  It pauses, resets, survives a close and keeps the screen awake like any interval. Work and Rest screens have no "Next" line.
- **Rest between sets screen:** the break (interval kind `setRest`) also gets its own screen.
  - The whole screen is deep blue, edge to edge.
  - "SET 1 COMPLETE" above a "Rest between sets" heading.
  - An m:ss countdown from its set length (0:30 by default).
  - "Next: Set 2 · Work 0:20". The format differs from Prepare's "Next: Work · 0:20" because each matches its chosen design.
  - The chips, Reset and the Pause button.

  Like Prepare, it behaves like any interval.
- **Counters:** two chips in the top bar, shown uppercase: "SET 1/2" (`getSet`) and "ROUND 3/8" (`getRound`). Rounds count Work intervals and restart in each set. TalkBack reads the chips as "Set 1 of 2" and "Round 3 of 8". A single-set workout shows "Set 1/1". The table uses the default 2 sets × 8 cycles.

  | Screen | Set | Round |
  |---|---|---|
  | Prepare | 1/2 | 1/8 (the upcoming round) |
  | Work | its set | its own round, 1/8 … 8/8 |
  | Rest | its set | the round it follows (Rest after Work 3 → 3/8) |
  | Rest between sets | the set it ends (1/2) | 8/8 |
  | Done | none | none |

- **Screen states:**
  - **Idle:** the first interval at full duration: Prepare, or the first Work when Prepare is 0. Since Start on the form starts the workout at once, idle is only seen after the top-bar Reset.
  - **Running.**
  - **Paused:** shows a "Paused" label.
  - **Finished:** shows "Done" and offers Restart.
  - **Empty:** a workout with no intervals shows a message and disables Start.
- **Reset:** shown only while running or paused, in the top bar (out of easy thumb reach). It pauses the timer and opens a "Reset workout?" bottom sheet. Cancel returns to the previous state (running continues, paused stays paused); Reset returns to idle. Cancel is last, nearest the thumb, and has focus.
- **Keep screen awake:** a Screen Wake Lock is held only while running. Android drops it whenever the app is hidden, so it's requested again on return. If it's unsupported or refused, the timer works without it and shows no error.
- **Sounds and vibration:**

  | Moment | Cue |
  |---|---|
  | Start, Restart into Prepare | Nothing |
  | Start, Restart straight into Work (Prepare 0) | Whistle |
  | Prepare → Work, Rest → Work, break → Work, Work → Work (Rest 0) | Whistle |
  | Work → Rest, Work → Rest between sets, last interval → Done | Boxing bell |
  | 0:03, 0:02, 0:01 of every interval | Beep + 100 ms vibration |
  | Resume | Nothing |

  All sounds are synthesized with Web Audio in `src/timer/sounds.ts`; there are no audio files. Transitions don't vibrate. Cues fire only for seconds and interval changes the timer actually ticks through. Anything skipped while the app was hidden or closed isn't replayed, and resuming at 0:02 doesn't repeat the 0:02 beep.
- **App closed mid-workout:** time keeps counting while closed (saved timestamps in `localStorage`). Reopening opens on the timer, with the workout built from that session's settings:
  - A running workout shows its current position and keeps running.
  - A paused one stays paused.
  - One that ended while closed shows Done once, and the next open shows the form.

  Reset clears the saved state. Corrupt data, data saved for a different workout, or blocked storage is ignored without errors.
- **Screen readers:** a `role="status"` region announces each interval ("Prepare, 8 seconds", "Rest, 10 seconds", "Rest between sets, 30 seconds") and "Workout complete", not every second.
- **Android APK:** besides the PWA, the app is built as a debug APK with Capacitor and sideloaded onto my own phones. It runs the same web code.
  - **Identity:** named "Interval (APK)", package ID `com.raihan.interval`. The package ID can't change without uninstalling, which deletes saved settings.
  - **Offline:** works with no network from first launch, because the web files are inside the APK. It has no service worker.
  - **Storage:** its settings and saved workout are separate from the PWA's.
  - **Back:** behaves as in the PWA.
  - **Icon:** the PWA's logo at half the icon's width on white, so Android's icon mask doesn't crop it. The splash screen is the logo on `#16171d`.
- **Colours:** Work purple, Rest teal, Prepare amber, rest between sets deep blue (`--accent`, `--rest`, `--prepare`, `--set-rest` in `src/index.css`). All pass WCAG AA in light and dark.

## Design notes

These are the non-obvious parts. The tests in `src/timer/*.test.ts(x)` pin each one.

- **Time is never accumulated:** elapsed = `now - startedAt - pausedTotalMs`. Android throttles timers in the background, so ticks only trigger re-renders and keep nothing.
- **Ticks reschedule themselves:** each tick runs on a `setTimeout` timed to the next whole second of elapsed time. Scheduling ticks from a React effect made several seconds collapse into one render.
- **Cues are driven by the clock, not by rendering:**
  - `useIntervalTimer(workout, onTime)` calls `onTime` (via `useEffectEvent`) on every tick, on the catch-up after the app was hidden, and when ticking starts (Start, Resume, reopen).
  - `useCountdownCues` beeps only if the displayed second is exactly one below the previous reading in the same interval. It plays a transition sound only if the previous reading was 0:01 of the interval before. That rule is what stops catch-ups from replaying anything.
  - The starting reading exists so the first second after reopening has something to compare against.
- **Audio is unlocked by a tap:** Android blocks audio that isn't started by a tap, so `useCountdownCues().prepare()` creates and resumes the `AudioContext` inside the Start, Resume, Restart and Cancel taps.
- **One cleanup releases the wake lock:** `useWakeLock(status === 'running')` releases the lock through a single effect cleanup, which covers every way of leaving the running state (pause, finish, Reset dialog, unmount).
- **Prepare and the rest between sets are just intervals:** each has its own kind (`prepare`, `setRest`), so timing, pause, persistence, wake lock and 3-2-1 beeps cover them for free. Only these look at the kind:
  - the sounds: entering Prepare is silent, only `work` whistles, and `rest` and `setRest` ring the bell
  - the screen variants in `IntervalTimerScreen`, with shared full-screen rules via `:root:has(.timer[data-kind=…])`
  - the counters

  `withPrepare` and `withSets` wrap a workout. `withSets` replaces a set's last interval with the break only if it's a Rest, and otherwise appends the break (Rest 0). A 0s break means no break.
- **Sets are derived, not stored:** the workout stays a flat list of intervals. `getSet` counts the `setRest` intervals before an index. `getRound` counts Work within the set's bounds. A break belongs to the set it ends. `getTimerState` and persistence know nothing about sets.
- **Chip text for TalkBack:** each chip renders its visible text ("Set 1/2") with `aria-hidden` and a `.visually-hidden` "Set 1 of 2", because TalkBack doesn't reliably read `aria-label` on a plain span.
- **Persistence stores timestamps, not the displayed time**, so time that passes while the app is closed is counted for free. Saved state is keyed by workout name, so **a workout's name must change whenever its shape changes**. Otherwise a timer saved by the old shape reopens at the wrong position. `buildWorkout` does this by encoding every setting in the name, and a test proves a timer saved under other settings is ignored. `src/test/setup.ts` clears `localStorage` after every test so a running workout can't leak into the next test.
- **Settings build an ordinary workout:** `buildWorkout(settings)` returns the same flat list of intervals as before. The timer, cues, counters, persistence and screens know nothing about settings.
- **Android back uses one history entry:** the timer pushes a history entry when it opens, so back fires `popstate` there instead of leaving the app.
  - While running or paused, it opens the sheet and pushes the entry again. While a sheet is open, it dismisses the sheet and pushes the entry again. When idle or Done, it goes to the form.
  - The sheet's Reset clears the saved session itself (the screen unmounts before its normal save would run), then calls `history.back()` to drop the entry.
  - jsdom's `history.back()` never fires `popstate`, so tests dispatch `PopStateEvent` themselves. Real back is a phone check.
- **Start from the form uses `autoStart`:** the timer starts once on mount, guarded by a ref against StrictMode's double mount. Reopening mid-workout opens the timer without `autoStart`, so the saved session is restored instead.
- **The APK has its own build mode:** `vite build --mode android` writes to `dist-android/` and turns the PWA plugin off. The APK serves its files from inside the app, so a service worker adds nothing offline and could keep serving the old version after an update. `npm run build` for the PWA is unchanged.
- **Android back in the APK is native code:** Capacitor's core doesn't handle back, so Android closed the app before the page saw it.
  - `MainActivity.java` goes back in the WebView's history, which fires the `popstate` the timer listens for. With no history left, as on the settings form, Android closes the app.
  - `@capacitor/app` was rejected: with no JS listener it does nothing when there's no history, and a listener would add APK-only code to the web app.
  - Regenerating `android/` (`cap add android`) deletes this handler.
- **`build:android` sets its own Java:** Capacitor 8 compiles for Java 21, and this PC's JDK 20 fails with "invalid source release: 21". The script sets `JAVA_HOME` to Android Studio's bundled Java for the Gradle step only, leaving the global Java alone.

## Building and installing the APK

Prerequisite: Android Studio installed at its default path (`C:\Program Files\Android\Android Studio`), with the SDK in `%LOCALAPPDATA%\Android\Sdk`.

- `npm run build:android` type-checks, builds `dist-android/`, copies it into `android/` (`cap sync`) and builds `android/app/build/outputs/apk/debug/app-debug.apk`.
- `npm run icons:android` regenerates the launcher icon and splash from `public/favicon.svg` (via `scripts/android-icon.mjs`). Run it after changing the icon.
- To install over USB, turn on USB debugging on the phone, then run `"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r android\app\build\outputs\apk\debug\app-debug.apk`. `-r` installs over the existing app and keeps its settings.
- Without adb, copy the APK to the phone's Download folder (USB file transfer) and tap it in My Files. Allow "Install unknown apps" for My Files the first time.
- If adb lists no device but Windows shows the phone only as "SAMSUNG Mobile USB Modem" or "Galaxy S24 FE", USB debugging isn't active on the connection. Check that USB tethering is off, USB debugging is on, and Samsung's Auto Blocker isn't blocking it.

## Known limitations

- **Nothing plays while the app is closed:** a closed web app can't run code. The Capacitor APK doesn't change this. Background cues would need a native foreground service plugin.
- **Silent after reopening:** Android allows sound and vibration only after a tap, so cues stay silent until the user taps a control (e.g. Pause, then Resume).
- **The Reset and back sheets aren't saved:** if the app is closed while either is open, it reopens paused, without the sheet.
- **APK builds are tied to this PC:** `build:android` uses `cmd` syntax, `gradlew.bat` and Android Studio's default path, so it only runs on Windows. Debug APKs are signed with this PC's debug key, so an APK built on another PC won't install over the old one until it's uninstalled, which deletes saved settings.
- **The APK and the PWA don't share settings or a running workout:** each has its own `localStorage`.
- **On Android 7, the APK's icon has no white background,** because Android 7 doesn't support adaptive icons.
- **The status bar doesn't change colour on the Prepare or rest-between-sets screens:** it follows the page's fixed `theme-color`.

## Follow-ups (not started)

- Several named workouts or presets, and workout history. Only one set of settings is remembered.
- A different time per round (e.g. a longer Work in round 3). Each screen type has one duration.
- Changing settings during a workout. Reaching the form always resets it.
- A mute or volume setting for the cues.
- A "tap to turn on sound" prompt after reopening.
- Replacing the synthesized whistle and bell with recorded sounds, if the synthesized ones don't sound right on a phone.
- Matching the Android status bar to the current screen (amber during Prepare, blue during the rest between sets) by updating `theme-color`.
- A Skip button for Prepare or the rest between sets.
- A signed release APK (or the Play Store) for sharing the app with other people. Only debug builds for my own phones exist.
- The app icon is still the Vite logo (`public/favicon.svg`), and the manifest name "Interval App" was a placeholder choice.

## Not yet checked on an Android device

The plans were closed before these were done. To test the installed build:

1. Run `npm run build && npm run preview`.
2. Connect the phone by USB and run `adb reverse tcp:4173 tcp:4173`.
3. Open `http://localhost:4173` in Chrome on the phone.

Opening the PC's LAN IP over HTTP can't install the app or register the service worker.

- [ ] Start/Pause is reachable one-handed, and Reset isn't hit by accident
- [ ] the countdown is readable at arm's length, in light and dark mode, and in sunlight
- [ ] lock the screen for 30s mid-interval and unlock: the time is correct
- [ ] switch to another app and back: the time is correct
- [ ] nothing sits under the gesture bar or the camera cutout
- [ ] TalkBack reads the controls and announces interval changes
- [ ] it's smooth on a low-end phone (no visible stutter at each tick)
- [ ] the screen stays on through a full 4-minute workout without touching it, and turns off normally after pausing
- [ ] the beep is audible at normal media volume and the vibration is felt at 3, 2, 1, from the first interval after Start
- [ ] with the phone on silent/vibrate, note what happens (Web Audio follows media volume, not the ringer)
- [ ] swipe the app away mid-interval, wait 30s, reopen: the position is correct and it's still running, and cues come back after tapping Pause and Resume
- [ ] the whistle and boxing bell are recognisable, clearly different from each other and from the beep, and loud enough over gym noise at full media volume
- [ ] 8s of Prepare is enough to tap Start, put the phone down and get into position
- [ ] amber is clearly distinct from Work purple and Rest teal, in light and dark mode
- [ ] the amber Prepare screen fills edge to edge (behind the status bar, gesture bar and cutout), and its text and Pause button are readable in sunlight
- [ ] note the status bar colour during Prepare
- [ ] the 3-2-1 beeps and then the whistle at the end of Prepare read as "get ready… go"
