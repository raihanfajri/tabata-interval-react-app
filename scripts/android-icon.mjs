// Prepares the APK's launcher icon source for `capacitor-assets` (`npm run
// icons:android`): public/favicon.svg, centred with padding so Android's
// circular / squircle icon mask doesn't crop it, like the PWA's maskable icon.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const OUT_DIR = 'node_modules/.tmp/android-icon'
const LOGO_SHARE = 0.5 // the logo's longer side, as a share of the icon

const svg = readFileSync('public/favicon.svg', 'utf8')
const viewBox = svg.match(/viewBox="([^"]+)"/)
if (!viewBox) throw new Error('public/favicon.svg has no viewBox')
const [x, y, w, h] = viewBox[1].trim().split(/[\s,]+/).map(Number)

const size = Math.max(w, h) / LOGO_SHARE
const padded = `${x + w / 2 - size / 2} ${y + h / 2 - size / 2} ${size} ${size}`
const out = svg
  .replace(/<svg([^>]*)>/, (tag) =>
    tag
      .replace(/\s(width|height)="[^"]*"/g, '')
      .replace(/viewBox="[^"]+"/, `viewBox="${padded}" width="${size}" height="${size}"`),
  )

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(`${OUT_DIR}/logo.svg`, out)
