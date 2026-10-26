# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

A single-screen interval timer (React 19, TypeScript ~6.0, Vite 8, oxlint). All app code is in `src/timer/`. `App.tsx` switches between `SettingsScreen` (the "New Workout" form) and `IntervalTimerScreen`, which runs the workout `buildWorkout(settings)` makes (Prepare, sets of Work/Rest cycles, a rest between sets). It ships as a PWA and as a sideloaded Capacitor APK (`npm run build:android`). **Read `docs/docs.md` before changing timer behaviour.** It records the product decisions (sounds, wake lock, surviving the app being closed), the non-obvious design rules behind them, known limitations, and checks not yet done on a device.

Work is planned in `docs/plan/` (`/plan-new-adhoc`, then `/implement`, which runs TDD, then `/close-ticket`). Closing moves the plan's lasting decisions into `docs/docs.md` and deletes the plan file.

## Target platform

The app is an installable, offline-capable PWA for **Android only** (decided 2026-10-14). The same web build is also wrapped in a Capacitor debug APK for sideloading. It isn't React Native, and there's no APK-only app code. Follow Material Design 3 conventions:
- Tap targets of at least 48dp. `--touch-min` in `src/index.css` gives every button and input a 48px minimum height.
- Spacing on the 8dp grid (`--space`), with a 16dp phone gutter (`--gutter`).
- Never take over the system back button.

The `mobile-design` skill (`.claude/skills/mobile-design/`) is written for React Native and Flutter. Only its platform-neutral guidance (touch/thumb zone, typography, colour, `platform-android.md`) applies here, and its `mobile_audit.py` doesn't detect issues in this web code.

PWA setup lives in `vite.config.ts` (`vite-plugin-pwa`):
- The manifest is defined there.
- `generateSW` precaches the app shell, and `autoUpdate` updates it.
- Icons are generated at build time from `public/favicon.svg`, so to change the app icon, replace that file.
- The service worker only exists in `npm run build` output. Use `npm run preview` to test install and offline behaviour.

`index.html` uses `viewport-fit=cover`, so `body` pads by `env(safe-area-inset-*)`.

The Android APK (Capacitor 8) is configured in `capacitor.config.ts` ("Interval (APK)", `com.raihan.interval`) and lives in the generated `android/` project:
- `vite build --mode android` writes to `dist-android/` with the PWA plugin turned off, so there's no service worker.
- Android back is handled in `android/app/src/main/java/com/raihan/interval/MainActivity.java`. Don't regenerate `android/` without keeping it.
- See `docs/docs.md` ("Building and installing the APK") for setup and installing.

## Commands

- `npm run dev` — Vite dev server with HMR
- `npm run build` — `tsc -b` type-check (project references) then `vite build` to `dist/`
- `npm run lint` — oxlint (config in `.oxlintrc.json`)
- `npm run preview` — serve the built `dist/`
- `npm run build:android` — type-check, build `dist-android/`, `cap sync android`, then Gradle `assembleDebug` to `android/app/build/outputs/apk/debug/app-debug.apk` (Windows only; uses Android Studio's bundled Java)
- `npm run build:android:linux` — the same on Linux, with `sh ./gradlew`. Defaults: SDK in `~/Android/Sdk` (override with `ANDROID_HOME`) and the JDK in `~/.jdks/jdk-21.0.13+9` (override with `ANDROID_JDK`)
- `npm run icons:android` — regenerate the APK's launcher icon and splash from `public/favicon.svg`

- `npm test` runs Vitest in watch mode, and `npm run test:run` runs it once. `npm run test:coverage` adds coverage.
- Single file: `npx vitest run src/App.test.tsx`. By test name: `npx vitest run -t "name"`.

Tests use Vitest + React Testing Library in jsdom and sit next to the code they test (`*.test.tsx`). Shared helpers live in `src/test/`. Follow the `testing-patterns` skill. Don't remove the `jest` shim in `src/test/setup.ts`, because fake-timer tests hang without it.

Type-checking only happens during `npm run build` (`npx tsc -b` runs it on its own), and test files are type-checked too. Vite's dev server does not type-check.

## Structure and conventions

- Entry: `index.html` → `src/main.tsx` (mounts `<App />` in `StrictMode` into `#root`).
- TypeScript uses project references. `tsconfig.app.json` covers `src/` (DOM libs, `vite/client` types), and `tsconfig.node.json` covers only `vite.config.ts`. Put a new non-`src` TS config file in `tsconfig.node.json`'s `include`.
- Compiler flags that affect how code is written:
  - `verbatimModuleSyntax`: type-only imports must use `import type`.
  - `erasableSyntaxOnly`: no `enum`, `namespace`, or constructor parameter properties. Use union types or `as const` objects instead.
  - `noUnusedLocals` / `noUnusedParameters`: unused code fails the build.
  - `allowImportingTsExtensions`: local imports include the extension (e.g. `./App.tsx`).
- Lint rules: `react/rules-of-hooks` is an error. `react/only-export-components` warns, so component files should export only components (constants are allowed) to keep Fast Refresh working.
- Files in `public/` are served from the root. Assets imported from `src/` go through Vite's bundler.
- React Compiler is not enabled.
