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

Needs the Android SDK and a full JDK 21.

```sh
npm run build:android        # Windows: Android Studio at its default path, using its bundled Java
npm run build:android:linux  # Linux: SDK in ~/Android/Sdk, JDK in ~/.jdks/jdk-21.0.13+9
```

On Linux, set `ANDROID_HOME` or `ANDROID_JDK` to use a different SDK or JDK.

This writes the debug APK to `android/app/build/outputs/apk/debug/app-debug.apk`. To install it, use `adb install -r <apk>` with USB debugging on, or copy the file to the phone and open it.

## Docs

- `docs/docs.md` covers how the app behaves, its design notes, known limitations and how to build and install the APK.
- `CLAUDE.md` covers project conventions and commands.
