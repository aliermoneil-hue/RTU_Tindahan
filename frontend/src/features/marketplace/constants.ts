import type { IconName } from '@/common/components/icons'
import type {
  DraftVariationRow,
  ListingDraft,
  PrototypeAccount,
  PrototypeProduct,
  ReactionKey,
} from './types'

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export const DAY_FULL: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
}

export const CATEGORIES = [
  'Books and Academic Materials',
  'School Supplies',
  'RTU Merchandise',
  'Clothing and Accessories',
  'Knickknacks and Collectibles',
  'Electronics and Gadgets',
  'Food and Snacks',
  'Other Items',
] as const

export const SERVICES_CAT = 'Services'

export const CAT_META: Record<string, [string, IconName, string]> = {
  'Books and Academic Materials': ['t-study', 'book', 'Study'],
  'School Supplies': ['t-print', 'note', 'Supplies'],
  'RTU Merchandise': ['t-merch', 'bag', 'Merch'],
  'Clothing and Accessories': ['t-uni', 'shirt', 'Apparel'],
  'Knickknacks and Collectibles': ['t-craft', 'star', 'Collectibles'],
  'Electronics and Gadgets': ['t-tech', 'calc', 'Tech'],
  'Food and Snacks': ['t-food', 'bowl', 'Food'],
  'Other Items': ['t-drink', 'tag', 'Other'],
  Services: ['t-print', 'print', 'Service'],
}

export const OFFCAT: Record<string, string> = {
  Uniform: 'Clothing and Accessories',
  Merch: 'RTU Merchandise',
  Textbook: 'Books and Academic Materials',
  Manual: 'Books and Academic Materials',
  Course: 'Books and Academic Materials',
}

export const SUBCATS: Record<string, string[]> = {
  'Clothing and Accessories': ['Uniform'],
  'Books and Academic Materials': ['Textbook', 'Manual', 'Reviewer or notes'],
}

export const OFFSUB: Record<string, string> = {
  Uniform: 'Uniform',
  Textbook: 'Textbook',
  Manual: 'Manual',
}

export const PLACES = [
  'BAU Office',
  'Main lobby',
  'Library entrance',
  'Canteen',
  'Covered court',
  'Engineering building',
  'Others',
]

export const TIMES = [
  '10:30 AM to 12:00 PM',
  '12:00 to 1:00 PM',
  '1:00 to 3:00 PM',
  '4:00 PM to 5:30 PM',
]

export const SVC_TYPES: Record<string, [string, IconName]> = {
  Printing: ['t-print', 'print'],
  Rental: ['t-tech', 'calc'],
  Tutoring: ['t-study', 'note'],
  Other: ['t-craft', 'key'],
}

export const SVC_UNITS = ['per page', 'per hour', 'per day', 'per session', 'per item']

export const CONDITIONS = ['Fresh / made today', 'Brand new', 'Like new', 'Pre-loved']

export const VAR_LIMITS = { options: 10, opts: 10, combos: 120, name: 30, attrName: 24, optName: 30, stock: 999 }

export const PROGRAMS = [
  'BS Information Technology',
  'BS Computer Engineering',
  'BS Electronics Engineering',
  'BS Business Administration',
  'Office of Student Affairs',
]

export const OTYPE: Record<string, [string, IconName]> = {
  Uniform: ['t-uni', 'shirt'],
  Textbook: ['t-study', 'book'],
  Manual: ['t-study', 'book'],
  Merch: ['t-merch', 'bag'],
  Course: ['t-study', 'note'],
}

export const REACTS: [ReactionKey, string, string][] = [
  ['like', '👍', 'Like'],
  ['love', '❤️', 'Love'],
  ['haha', '😂', 'Haha'],
  ['wow', '😮', 'Wow'],
  ['sad', '😢', 'Sad'],
]

export const TOPICS = ['General', 'Questions', 'Selling schedule', 'Buy & sell tips', 'Lost & found', 'Events']

export const FR_REASONS = [
  'Spam or advertising',
  'Harassment or bullying',
  'Inappropriate or offensive content',
  'Scam or fraud',
  'False or misleading information',
  'Something else',
]

export const ORDER_REPORT_REASONS_SELLER = [
  'Buyer did not show up at meetup (waited a long time)',
  'Buyer keeps rescheduling or unresponsive at meetup time',
  'Buyer refused agreed payment or tried to change price in person',
  'Disrespectful or rude behavior during transaction',
  'Other transaction problem',
]

export const ORDER_REPORT_REASONS_BUYER = [
  'Seller did not show up at meetup (waited a long time)',
  'Item did not match description or photos',
  'Seller asked for higher price or unagreed fees',
  'Disrespectful or rude behavior during transaction',
  'Other transaction problem',
]

export const FR_STATUS: Record<string, string> = {
  open: 'Open',
  reviewed: 'Reviewed',
  dismissed: 'Dismissed',
  actioned: 'Action taken',
}

export const FR_ACTIONS: Record<'hide' | 'restore' | 'delete' | 'warn', [string, string]> = {
  hide: ['Hide the content', 'hidden from members'],
  restore: ['Restore hidden content', 'restored'],
  delete: ['Delete the content', 'deleted'],
  warn: ['Warn the author (content stays)', 'author warned'],
}

export const SORTS: Record<string, string> = {
  Recommended: 'The default order.',
  Newest: 'Most recently published listings first.',
  'Price: low to high': 'Cheapest first.',
  'Price: high to low': 'Most expensive first.',
  'Best-Selling': 'Most units in completed transactions first. Items with no completed sale come last.',
  'Least-Sold': 'Fewest units in completed transactions first. Items with no completed sale come first.',
  'Top-Rated': 'Highest average rating first. Unrated items come last.',
  'Lowest-Rated': 'Lowest average rating first. Unrated items come last.',
}

export const SHOP_TABS: [string, string][] = [
  ['overview', 'Overview'],
  ['orders', 'Orders and Requests'],
  ['listings', 'My Listings'],
  ['reviews', 'Ratings and Reviews'],
]

export const ADM_TABS: [string, string][] = [
  ['users', 'Users'],
  ['listings', 'Listings'],
  ['audit', 'Audit log'],
]

export const TX_FLOW: Record<string, 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled'> = {
  'Awaiting seller': 'Pending',
  'Meetup set': 'Confirmed',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
}

export const TX_PILL: Record<string, string> = {
  Pending: 'yellow',
  Confirmed: 'blue',
  Completed: 'green',
  Cancelled: 'red',
}

export const TX_NOTE: Record<string, string> = {
  Pending: 'Request sent by the buyer',
  Confirmed: 'Meetup agreed',
  Completed: 'Pickup confirmed',
  Cancelled: 'Request declined or cancelled',
}

export const SITE = {
  contactEmail: '',
  contactNote: '',
  privacyUrl: '',
  termsUrl: '',
}

export const peso = (n: number | string) => '₱' + Number(n || 0).toLocaleString('en-PH')

export const isSvc = (p?: PrototypeProduct | null): boolean => !!p && p.kind === 'service'

export function cleanDays(list?: Iterable<string> | string | null): string[] {
  const arr =
    typeof list === 'string'
      ? list.split(',').map((x) => x.trim())
      : Array.from(list || [])
  return DAYS.filter((x) => arr.includes(x))
}

export function normCat(p: PrototypeProduct): string {
  if (isSvc(p)) return SERVICES_CAT
  const c = p.cat
  if ((CATEGORIES as readonly string[]).includes(c)) return c
  if (c === 'Official') {
    if (OFFCAT[p.tag]) return OFFCAT[p.tag]
    if (p.category && (CATEGORIES as readonly string[]).includes(p.category)) return p.category
    const n = String(p.name || '').toLowerCase()
    if (/uniform|polo|blouse|pe shirt|jogging|lanyard|id lace/.test(n)) {
      return /lanyard|id lace/.test(n) ? 'RTU Merchandise' : 'Clothing and Accessories'
    }
    if (/manual|textbook|book|module|reviewer/.test(n)) return 'Books and Academic Materials'
    if (/merch|tumbler|mug|keychain|tote|rtu /.test(n)) return 'RTU Merchandise'
    return 'Other Items'
  }
  if (c === 'Food & drinks' || c === 'Campus food') return 'Food and Snacks'
  if (c === 'Books & notes' || c === 'Lab manuals & textbooks') return 'Books and Academic Materials'
  if (c === 'Tech & gadgets') return 'Electronics and Gadgets'
  if (c === 'Goods & apparel' || c === 'Goods') {
    const n = String(p.name || '').toLowerCase()
    if (p.tag === 'Tech') return 'Electronics and Gadgets'
    if (p.tag === 'Merch') return 'RTU Merchandise'
    if (p.tag === 'Uniform' || /shirt|hoodie|jacket|cap\b|uniform|apparel|lanyard|tote|bag\b/.test(n))
      return 'Clothing and Accessories'
    if (/\bpen\b|paper|notebook|folder|marker|ruler|stapler|scissors|highlighter|supplies/.test(n))
      return 'School Supplies'
    if (/sticker|keychain|figure|collect|plush|pin\b|charm/.test(n))
      return 'Knickknacks and Collectibles'
  }
  return 'Other Items'
}

export const catOf = (p: PrototypeProduct): string => normCat(p)

export function subOf(p?: PrototypeProduct | null): string {
  if (!p || isSvc(p)) return ''
  if (p.sub) return p.sub
  if (p.tag === 'Uniform') return 'Uniform'
  const c = normCat(p)
  const list = SUBCATS[c] || []
  if (p.cat === 'Official' && OFFSUB[p.tag] && list.includes(OFFSUB[p.tag])) return OFFSUB[p.tag]
  const n = String(p.name || '').toLowerCase()
  if ((c === 'Clothing and Accessories' || /clothing|apparel/i.test(c)) && /uniform/i.test(n)) return 'Uniform'
  if (c === 'Books and Academic Materials') {
    if (/manual/i.test(n)) return 'Manual'
    if (/textbook/i.test(n)) return 'Textbook'
  }
  return ''
}

export const hasVars = (p?: PrototypeProduct | null): boolean =>
  !!(p && p.vars && Array.isArray(p.vars.rows) && p.vars.rows.length > 0)

export function varLabel(p: PrototypeProduct, row?: { opts: Record<string, string> } | null): string {
  if (!row) return ''
  const names = ((p.vars && p.vars.attrs) || []).map((a) => a.name)
  return names
    .map((n) => row.opts[n])
    .filter(Boolean)
    .join(', ')
}

export function findVar(p?: PrototypeProduct | null, vid?: string | null) {
  if (!p || !vid || !hasVars(p)) return undefined
  return p.vars!.rows.find((r) => r.id === vid)
}

export function varTotal(p: PrototypeProduct): number {
  if (!hasVars(p)) return p.left
  return p.vars!.rows.reduce((a, r) => a + (r.qty || 0), 0)
}

export function syncLeft(p: PrototypeProduct) {
  if (hasVars(p)) p.left = varTotal(p)
}

export function unitPrice(p: PrototypeProduct, vid?: string | null): number {
  const r = vid ? findVar(p, vid) : null
  return r && Number(r.price) > 0 ? Number(r.price) : p.price
}

export function stockOf(p: PrototypeProduct, vid?: string | null): number {
  if (hasVars(p)) {
    const r = vid ? findVar(p, vid) : undefined
    return r ? r.qty : 0
  }
  return p.left
}

export function priceLabel(p: PrototypeProduct): string {
  if (!hasVars(p)) return peso(p.price)
  const ps = p.vars!.rows.map((r) => unitPrice(p, r.id))
  const lo = Math.min(...ps)
  const hi = Math.max(...ps)
  return lo === hi ? peso(lo) : 'From ' + peso(lo)
}

export function vLineName(p: PrototypeProduct, vid?: string | null): string {
  const r = vid ? findVar(p, vid) : undefined
  return r ? `${p.name} (${varLabel(p, r)})` : p.name
}

export function sellerLabel(
  u: { name: string; aff: string; prog: string } | PrototypeProduct,
): string {
  if ('seller' in u && typeof u.seller === 'string' && !('aff' in u)) {
    return u.seller
  }
  const acct = u as { name: string; aff: string; prog: string }
  return (
    acct.name +
    ' · ' +
    (acct.aff === 'Student'
      ? acct.prog
          .replace(/^BS /, '')
          .split(' ')
          .map((w) => w[0])
          .join('')
      : acct.aff)
  )
}

export const greet = (): string => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export const nowT = (): string =>
  new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

export const monthYear = (d: string | Date): string =>
  new Date(d).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })

export const stamp = (ts: string | number | Date): string =>
  new Date(ts).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

export const dShort = (): string =>
  new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

export const ago = (ts: string | number | Date): string => {
  const d = new Date(ts)
  const m = Math.round((Date.now() - d.getTime()) / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return m + ' min ago'
  if (m < 1440) return Math.round(m / 60) + ' h ago'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const initialsOf = (t?: string | null): string =>
  String(t || '?')
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

export const shortName = (n?: string | null): string => {
  const w = String(n || 'Student')
    .trim()
    .split(/\s+/)
  return w.length > 1 ? w[0] + ' ' + w[w.length - 1][0].toUpperCase() + '.' : w[0]
}

export const tc = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/(^|[\s.'-])([a-zà-ÿ])/g, (_m, a: string, b: string) => a + b.toUpperCase())

export const hash = (s: string): string => {
  let h = 5381
  const t = 'rtu-tindahan:' + s
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0
  return String(h >>> 0)
}

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export const newVid = (): string =>
  'v' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 5)

export const T_OPEN = 7 * 60
export const T_CLOSE = 19 * 60

export function toMin(t?: string | null): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(String(t || ''))
  if (!m || +m[1] > 23 || +m[2] > 59) return null
  return +m[1] * 60 + +m[2]
}

export function toHM(n: number): string {
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')
}

export function fmt12(n: number): string {
  const h = Math.floor(n / 60)
  const m = n % 60
  return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM')
}

export function winText(s: number, e: number): string {
  return fmt12(s) + ' to ' + fmt12(e)
}

export function parseWindow(txt?: string | null): { s: number; e: number } | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s+to\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i.exec(
    String(txt || ''),
  )
  if (!m) return null
  const to24 = (h: string, mi: string, ap: string) =>
    ((+h % 12) + (/PM/i.test(ap) ? 12 : 0)) * 60 + +mi
  const e = to24(m[4], m[5], m[6])
  let s = to24(m[1], m[2], m[3] || m[6])
  if (!m[3] && s >= e) s = to24(m[1], m[2], 'AM')
  return s < e ? { s, e } : null
}

export function timeError(d: { tStart?: string; tEnd?: string }): string {
  const s = toMin(d.tStart)
  const e = toMin(d.tEnd)
  if (s == null || e == null) return 'Choose a start time and an end time.'
  if (s < T_OPEN || s > T_CLOSE || e < T_OPEN || e > T_CLOSE)
    return 'Times must be between 7:00 AM and 7:00 PM.'
  if (e <= s) return 'The end time must be later than the start time.'
  return ''
}

export function vCombos(d: ListingDraft): Record<string, string>[] {
  const at = d.vAttrs.filter((a) => a.opts.length && a.name.trim())
  if (!at.length) return []
  let out: Record<string, string>[] = [{}]
  at.forEach((a) => {
    out = out.flatMap((o) => a.opts.map((v) => ({ ...o, [a.name.trim()]: v })))
  })
  return out
}

export function vSyncRows(d: ListingDraft): DraftVariationRow[] {
  const old = new Map(d.vRows.map((r) => [r.key, r]))
  return vCombos(d).map((o) => {
    const key = JSON.stringify(o)
    return old.get(key) || { id: newVid(), key, opts: o, qty: '', price: '' }
  })
}

export function getSellerTimeWindows(p?: PrototypeProduct | null): string[] {
  if (!p) return [TIMES[1]]
  const rawWhen = String(p.when || '')
  const commaIdx = rawWhen.indexOf(',')
  const winPart = commaIdx > -1 ? rawWhen.slice(commaIdx + 1).trim() : rawWhen.trim()
  if (!winPart) return [TIMES[1]]
  const parsed = parseWindow(winPart)
  if (!parsed) return [winPart]
  const { s, e } = parsed
  const slots: string[] = [winText(s, e)]
  // If seller's window is wider than 60 mins, also offer 1-hour slots strictly inside the seller's window
  if (e - s > 60) {
    let cur = s
    while (cur + 60 <= e) {
      const slot = winText(cur, cur + 60)
      if (!slots.includes(slot)) slots.push(slot)
      cur += 60
    }
    if (cur < e) {
      const rem = winText(cur, e)
      if (!slots.includes(rem)) slots.push(rem)
    }
  }
  return slots
}

export function blankDraft(isAdmin = false, defaultDays: readonly string[] = []): ListingDraft {
  return {
    type: 'product',
    editLid: null,
    title: '',
    cat: CATEGORIES[0],
    sub: '',
    desc: '',
    price: '',
    qty: '',
    cond: 'Brand new',
    fulfillment: 'pickup',
    place: isAdmin ? 'BAU Office' : 'Main lobby',
    window: '12:00 PM to 1:00 PM',
    tStart: '12:00',
    tEnd: '13:00',
    days: cleanDays(defaultDays).length ? cleanDays(defaultDays) : ['Mon', 'Tue'],
    agree: false,
    images: [],
    svcType: 'Printing',
    unit: 'per page',
    vOn: false,
    vAttrs: [
      { name: 'Color', opts: [] },
      { name: 'Size', opts: [] },
      { name: 'Style', opts: [] },
    ],
    vRows: [],
  }
}

export function mkAcct(o: Partial<PrototypeAccount> & { email: string; first: string; last: string }): PrototypeAccount {
  const a: PrototypeAccount = {
    orders: [],
    cart: [],
    sellerList: [],
    sellerReq: [],
    windows: [],
    checklist: { profile: true, pickup: false, rules: false },
    notifs: [],
    favs: [],
    sfavs: [],
    avatar: null,
    since: new Date().toISOString(),
    role: 'student',
    prog: 'BS Information Technology',
    aff: 'Student',
    base: 0,
    verified: true,
    status: 'active',
    ph: '',
    sid: '',
    ...o,
    name: `${o.first} ${o.last}`.trim(),
  }
  a.windows = cleanDays(a.windows)
  return a
}

export const BROWSE_CATS: readonly string[] = [...CATEGORIES, SERVICES_CAT]

export const SORT_MODES: readonly string[] = [
  'Recommended',
  'Newest',
  'Small sellers first',
  'Best-Selling',
  'Least-Sold',
  'Top-Rated',
  'Lowest-Rated',
  'Price: low to high',
  'Price: high to low',
]

export function refLabel(r?: { type?: string } | null): string {
  if (!r) return 'Product'
  return r.type === 'service' ? 'Service' : r.type === 'order' ? 'Order' : 'Product'
}
