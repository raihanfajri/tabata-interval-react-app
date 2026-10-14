import type { CapacitorConfig } from '@capacitor/cli'

// The sideloaded Android APK. It bundles the `--mode android` web build, which
// leaves out the PWA's service worker (see vite.config.ts).
const config: CapacitorConfig = {
  appId: 'com.raihan.interval',
  appName: 'Interval (APK)',
  webDir: 'dist-android',
}

export default config
