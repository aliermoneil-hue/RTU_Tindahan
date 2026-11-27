/**
 * Real product, forum, and avatar image store (ported from js/9c-images.js)
 * - Validates MIME type, extension, size (<= 5 MB), and magic bytes (JPEG, PNG, WebP)
 * - Decodes image, checks minimum dimensions, resizes on canvas (maxSide 1100px or 360px square),
 *   and re-encodes as JPEG to strip embedded payloads
 * - Persists under localStorage key 'rtu_img_v1'
 */

export const IMGK = 'rtu_img_v1'

export const IMG_RULES = {
  types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>,
  maxBytes: 5 * 1024 * 1024,
  minSide: 100,
  maxPixels: 40e6,
  maxSide: 1100,
  quality: 0.8,
  listing: 10,
  post: 4,
  budget: 8.5e6,
}

export const IMG_URL = /^data:image\/(jpeg|png|webp);base64,/

export interface ImageEditState {
  preset: string
  zoom: number
  rotation: number
  pan: { x: number; y: number }
}

export interface StoredImage {
  d: string
  w: number
  h: number
  n: string
  t: number
  /** Untouched original image as first uploaded (never overwritten by edits). */
  o?: string
  /** Last-used edit settings for this image. */
  e?: ImageEditState
}

let IMGS: Record<string, StoredImage> = {}
let loaded = false

export function loadImgs(): Record<string, StoredImage> {
  let o: Record<string, StoredImage> = {}
  try {
    const raw = localStorage.getItem(IMGK)
    o = raw ? (JSON.parse(raw) as Record<string, StoredImage>) || {} : {}
  } catch {
    o = {}
  }
  Object.keys(o).forEach((k) => {
    if (!o[k] || typeof o[k].d !== 'string' || !IMG_URL.test(o[k].d)) {
      delete o[k]
    }
  })
  IMGS = o
  loaded = true
  return IMGS
}

function ensureLoaded() {
  if (!loaded) loadImgs()
}

export function getAllImgs(): Record<string, StoredImage> {
  ensureLoaded()
  return IMGS
}

export function replaceAllImgs(next: Record<string, StoredImage>) {
  IMGS = { ...next }
  loaded = true
  saveImgs()
}

export function clearAllImgs() {
  IMGS = {}
  loaded = true
  try {
    localStorage.removeItem(IMGK)
  } catch {
    /* ignore */
  }
}

export function saveImgs(): boolean {
  ensureLoaded()
  const txt = JSON.stringify(IMGS)
  try {
    localStorage.setItem(IMGK, txt)
    return true
  } catch {
    return false
  }
}

export function removeImg(id: string) {
  ensureLoaded()
  if (id in IMGS) {
    delete IMGS[id]
    saveImgs()
  }
}

export function replaceImgData(
  id: string,
  dataUrl: string,
  width = 800,
  height = 600,
  editState?: ImageEditState,
): boolean {
  ensureLoaded()
  const existing = IMGS[id]
  if (existing) {
    // Preserve the untouched original: copy existing src into o on first edit.
    const originalSrc = existing.o ?? existing.d
    IMGS[id] = {
      ...existing,
      o: originalSrc,
      d: dataUrl,
      w: width,
      h: height,
      t: Date.now(),
      e: editState,
    }
    return saveImgs()
  }
  const newId = 'im_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
  IMGS[newId] = {
    d: dataUrl,
    w: width,
    h: height,
    n: 'adjusted_photo.jpg',
    t: Date.now(),
    o: dataUrl, // brand-new edited image: its own data is the original
    e: editState,
  }
  saveImgs()
  return true
}

export function addImgDataUrl(dataUrl: string, name = 'adjusted.jpg', width = 800, height = 600): string | null {
  ensureLoaded()
  const id = 'im_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
  IMGS[id] = { d: dataUrl, w: width, h: height, n: name, t: Date.now() }
  if (saveImgs()) return id
  delete IMGS[id]
  return null
}

export function imgSrc(id?: string | null): string {
  ensureLoaded()
  if (!id) return ''
  if (
    id.startsWith('data:image/') ||
    id.startsWith('/') ||
    id.startsWith('http') ||
    id.startsWith('blob:') ||
    id.includes('/')
  ) {
    return id
  }
  const m = IMGS[id]
  return m && typeof m.d === 'string' && IMG_URL.test(m.d) ? m.d : ''
}

/** Returns the untouched original image source for an id, falling back to src. */
export function imgOriginalSrc(id?: string | null): string {
  ensureLoaded()
  if (!id) return ''
  if (
    id.startsWith('data:image/') ||
    id.startsWith('/') ||
    id.startsWith('http') ||
    id.startsWith('blob:') ||
    id.includes('/')
  ) {
    return id
  }
  const m = IMGS[id]
  if (!m) return ''
  return m.o || m.d || ''
}

/** Returns the saved edit state for an image id, if any. */
export function imgEditState(id?: string | null): ImageEditState | undefined {
  ensureLoaded()
  if (!id) return undefined
  const m = IMGS[id]
  return m?.e
}

export function imgsOf(o?: { imgs?: string[] } | null): string[] {
  ensureLoaded()
  return ((o && o.imgs) || []).filter((id) => Boolean(imgSrc(id)))
}

export function imgSize(): number {
  ensureLoaded()
  let n = 0
  for (const k in IMGS) n += (IMGS[k].d || '').length
  return n
}

export function imgSniff(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf)
  const at = (i: number, s: string) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0))
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (
    b[0] === 0x89 &&
    at(1, 'PNG') &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return 'png'
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'webp'
  return ''
}

function imgDecode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof window.createImageBitmap === 'function') return window.createImageBitmap(file)
  return new Promise((ok, no) => {
    const u = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => {
      URL.revokeObjectURL(u)
      ok(im)
    }
    im.onerror = () => {
      URL.revokeObjectURL(u)
      no(new Error('decode'))
    }
    im.src = u
  })
}

export async function imgValidate(file: File): Promise<string> {
  const nm = file.name || 'This file'
  if (!IMG_RULES.types[file.type] || !/\.(jpe?g|png|webp)$/i.test(file.name || '')) {
    return `${nm}: only JPEG, PNG or WebP photos are allowed.`
  }
  if (!file.size) return `${nm}: the file is empty.`
  if (file.size > IMG_RULES.maxBytes) {
    return `${nm}: the photo is over ${IMG_RULES.maxBytes / 1048576} MB. Choose a smaller one.`
  }
  let kind = ''
  try {
    kind = imgSniff(await file.slice(0, 16).arrayBuffer())
  } catch {
    /* ignore */
  }
  if (!kind) return `${nm}: this is not a real photo file, so it was not added.`
  const wants = IMG_RULES.types[file.type] === 'jpg' ? 'jpeg' : IMG_RULES.types[file.type]
  if (kind !== wants) return `${nm}: the file contents do not match its type, so it was not added.`
  return ''
}

export async function imgAdd(
  file: File,
  opt?: { minSide?: number; maxSide?: number; square?: boolean },
): Promise<{ id?: string; err?: string }> {
  ensureLoaded()
  const o = opt || {}
  try {
    const bad = await imgValidate(file)
    if (bad) return { err: bad }
    let bmp: ImageBitmap | HTMLImageElement
    try {
      bmp = await imgDecode(file)
    } catch {
      return { err: `${file.name}: the photo could not be read. It may be damaged.` }
    }
    const w0 = bmp.width
    const h0 = bmp.height
    const minS = o.minSide || IMG_RULES.minSide
    const maxS = o.maxSide || IMG_RULES.maxSide
    if (Math.min(w0, h0) < minS) {
      return { err: `${file.name}: the photo is too small (at least ${minS} pixels wide and tall).` }
    }
    if (w0 * h0 > IMG_RULES.maxPixels) {
      return { err: `${file.name}: the photo has too many pixels. Choose a smaller one.` }
    }
    const sq = !!o.square
    const sw = sq ? Math.min(w0, h0) : w0
    const sh = sq ? Math.min(w0, h0) : h0
    const sx = sq ? (w0 - sw) / 2 : 0
    const sy = sq ? (h0 - sh) / 2 : 0
    const k = Math.min(1, maxS / Math.max(sw, sh))
    const w = Math.max(1, Math.round(sw * k))
    const h = Math.max(1, Math.round(sh * k))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    if (!g) return { err: `${file.name}: the photo could not be prepared.` }
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    g.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h)
    if ('close' in bmp && typeof bmp.close === 'function') bmp.close()
    const d = c.toDataURL('image/jpeg', IMG_RULES.quality)
    if (!d.startsWith('data:image/jpeg')) {
      return { err: `${file.name}: the photo could not be prepared.` }
    }
    if (imgSize() + d.length > IMG_RULES.budget) {
      return {
        err: 'Photo storage is nearly full. Remove a photo from an old listing and try again.',
      }
    }
    const id = 'im_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
    IMGS[id] = { d, w, h, n: String(file.name || '').slice(0, 80), t: Date.now() }
    if (!saveImgs()) {
      delete IMGS[id]
      return { err: 'The browser could not save this photo (storage is full).' }
    }
    return { id }
  } catch {
    return { err: 'Something went wrong while adding that photo. Please try another one.' }
  }
}
