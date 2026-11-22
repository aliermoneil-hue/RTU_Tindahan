/**
 * Copy the Netlify proxy rules into the build output, but only when the build
 * is actually running on Netlify.
 *
 * Why this exists: the rules in netlify/_redirects proxy /api/* to an external
 * tunnel host with status 200. Cloudflare Workers rejects exactly that in any
 * _redirects it finds in the asset directory ("Proxy (200) redirects can only
 * point to relative paths"), which failed the whole deploy. Keeping the file
 * outside public/ means Vite no longer copies it into dist, so Cloudflare never
 * sees it; Netlify still gets it because Netlify sets NETLIFY=true.
 */

import { copyFileSync, existsSync } from 'node:fs'

const SOURCE = 'netlify/_redirects'
const TARGET = 'dist/_redirects'

if (process.env.NETLIFY) {
  if (!existsSync(SOURCE)) {
    console.error(`${SOURCE} is missing; the Netlify proxy would be empty`)
    process.exit(1)
  }
  copyFileSync(SOURCE, TARGET)
  console.log(`netlify: wrote ${TARGET}`)
} else {
  console.log('netlify: not building on Netlify, skipped dist/_redirects')
}
