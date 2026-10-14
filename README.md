# tabata-interval-react-app

An interval timer for Android phones. Set Prepare, Work, Rest, Rest between sets, the number of sets and cycles per set on the "New Workout" form, then run the workout. Each stage has its own full-screen colour, there's a 3-2-1 beep and vibration, a whistle when Work starts and a boxing bell for rest. It keeps the screen awake, and the workout keeps its time if the app is closed.

It's built with React 19, TypeScript and Vite. It ships two ways from the same code:

- **Installable PWA** that works offline (`vite-plugin-pwa`).
- **Android APK** for sideloading, wrapped with Capacitor.

## Develop

```sh
npm install
npm run dev        # dev server
npm run test:run   # Vitest + React Testing Library
npm run lint       # oxlint
npm run build      # type-check and build the PWA into dist/
npm run preview    # serve dist/ to test install and offline use
```

## Build the Android APK

Needs Android Studio, at its default install path, with the Android SDK. The build script runs on Windows.

```sh
npm run build:android
```

This writes the debug APK to `android/app/build/outputs/apk/debug/app-debug.apk`. To install it, use `adb install -r <apk>` with USB debugging on, or copy the file to the phone and open it.

## Docs

- `docs/docs.md` covers how the app behaves, its design notes, known limitations and how to build and install the APK.
- `CLAUDE.md` covers project conventions and commands.
