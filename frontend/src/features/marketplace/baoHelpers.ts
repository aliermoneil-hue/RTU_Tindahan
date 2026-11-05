import { hasVars, varLabel } from './constants'
import type {
  BaoEmailConfig,
  BaoItemType,
  BaoLedgerEntry,
  BaoLedgerType,
  BaoSettings,
  BaoState,
  BaoStatus,
  OrderRecord,
  ProductVariationRow,
  PrototypeProduct,
  TransactionRecord,
} from './types'

export const BAO_STATUSES: BaoStatus[] = [
  'Request Received',
  'Confirmed',
  'On Hold',
  'Ready for Pickup',
  'Claimed',
  'Cancelled',
]

export const BAO_STEPS: BaoStatus[] = [
  'Request Received',
  'Confirmed',
  'Ready for Pickup',
  'Claimed',
]

export const BAO_PILL: Record<BaoStatus, string> = {
  'Request Received': 'yellow',
  Confirmed: 'blue',
  'On Hold': 'navy',
  'Ready for Pickup': 'blue',
  Claimed: 'green',
  Cancelled: 'red',
}

export const BAO_LEGACY: Record<BaoStatus, 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled'> = {
  'Request Received': 'Pending',
  Confirmed: 'Confirmed',
  'On Hold': 'Confirmed',
  'Ready for Pickup': 'Confirmed',
  Claimed: 'Completed',
  Cancelled: 'Cancelled',
}

export const BAO_FROM_LEGACY: Record<string, BaoStatus> = {
  Pending: 'Request Received',
  Confirmed: 'Confirmed',
  Completed: 'Claimed',
  Cancelled: 'Cancelled',
}

export const BAO_ORDER_STATUS: Record<
  BaoStatus,
  'Awaiting seller' | 'Meetup set' | 'Completed' | 'Cancelled'
> = {
  'Request Received': 'Awaiting seller',
  Confirmed: 'Meetup set',
  'On Hold': 'Meetup set',
  'Ready for Pickup': 'Meetup set',
  Claimed: 'Completed',
  Cancelled: 'Cancelled',
}

export const BAO_STAGE: Partial<Record<BaoStatus, number>> = {
  'Request Received': 1,
  Confirmed: 2,
  'On Hold': 2,
  'Ready for Pickup': 3,
  Claimed: 4,
}

export const BAO_SOURCES = ['Online', 'Face to face'] as const

export const BAO_LTYPES: BaoLedgerType[] = [
  'Stock In',
  'Reserved',
  'Released',
  'Issued',
  'Sold',
  'Adjustment',
]

export const BAO_EFFECT: Record<Exclude<BaoLedgerType, 'Adjustment'>, [number, number]> = {
  'Stock In': [1, 0],
  Reserved: [0, 1],
  Released: [0, -1],
  Issued: [-1, -1],
  Sold: [-1, 0],
}

export const BAO_DEFAULT_TYPES: BaoItemType[] = [
  {
    id: 'ty-uniform',
    name: 'Uniform',
    category: 'Clothing and Accessories',
    sub: 'Uniform',
    tone: 't-uni',
    icon: 'shirt',
    active: true,
  },
  {
    id: 'ty-book',
    name: 'Book',
    category: 'Books and Academic Materials',
    sub: '',
    tone: 't-study',
    icon: 'book',
    active: true,
  },
  {
    id: 'ty-sablay',
    name: 'Sablay',
    category: 'Clothing and Accessories',
    sub: 'Sablay',
    tone: 't-uni',
    icon: 'shirt',
    active: true,
  },
  {
    id: 'ty-merch',
    name: 'Merchandise',
    category: 'RTU Merchandise',
    sub: '',
    tone: 't-merch',
    icon: 'bag',
    active: true,
  },
  {
    id: 'ty-other',
    name: 'Other',
    category: 'Other Items',
    sub: '',
    tone: 't-drink',
    icon: 'tag',
    active: true,
  },
]

export const BAO_LEGACY_TYPE: Record<string, string> = {
  Uniform: 'ty-uniform',
  Textbook: 'ty-book',
  Manual: 'ty-book',
  Course: 'ty-book',
  Merch: 'ty-merch',
  Sablay: 'ty-sablay',
  Book: 'ty-book',
  Merchandise: 'ty-merch',
}

export const BAO_OPEN: BaoStatus[] = [
  'Request Received',
  'Confirmed',
  'On Hold',
  'Ready for Pickup',
]

export const BAO_EMAIL_EVENTS: BaoStatus[] = [...BAO_STATUSES]
export const BAO_OUTBOX_MAX = 500

export function baoDefaultSettings(): BaoSettings {
  return {
    transitions: {
      'Request Received': ['Confirmed', 'On Hold', 'Cancelled'],
      Confirmed: ['Ready for Pickup', 'On Hold', 'Cancelled'],
      'On Hold': ['Confirmed', 'Ready for Pickup', 'Cancelled'],
      'Ready for Pickup': ['Claimed', 'On Hold', 'Cancelled'],
      Claimed: [],
      Cancelled: [],
    },
    reasonRequired: ['On Hold', 'Cancelled'],
    studentCancelFrom: ['Request Received'],
    queue: { enabled: false, prefix: '', pad: 3, dailyReset: true },
    claimNote: '',
    window: { enabled: false, start: '', end: '', message: '' },
    limitPerStudent: 0,
  }
}

export function baoDefaultEmailConfig(raw?: Partial<BaoEmailConfig>): BaoEmailConfig {
  const events: Record<string, boolean> = {}
  BAO_EMAIL_EVENTS.forEach((e) => {
    events[e] = raw?.events?.[e] !== undefined ? Boolean(raw.events[e]) : true
  })
  return {
    enabled: false,
    provider: raw?.provider || '',
    domain: raw?.domain || 'rtu.edu.ph',
    events,
    lowStock: raw?.lowStock !== undefined ? Boolean(raw.lowStock) : true,
    lowStockTo: Array.isArray(raw?.lowStockTo) ? raw!.lowStockTo : [],
  }
}

export function baoDefaultState(raw?: Partial<BaoState>): BaoState {
  const defSet = baoDefaultSettings()
  const rawSet = raw?.settings || ({} as Partial<BaoSettings>)
  const settings: BaoSettings = {
    ...defSet,
    ...rawSet,
    transitions: {
      ...defSet.transitions,
      ...(rawSet.transitions || {}),
    },
    queue: {
      ...defSet.queue,
      ...(rawSet.queue || {}),
    },
    window: {
      ...defSet.window,
      ...(rawSet.window || {}),
    },
  }
  const types =
    raw?.types && Array.isArray(raw.types) && raw.types.length
      ? raw.types.map((t) => ({ ...t }))
      : BAO_DEFAULT_TYPES.map((t) => ({ ...t }))

  return {
    v: 1,
    settings,
    queue: { day: raw?.queue?.day || '', n: raw?.queue?.n || 0 },
    ledger: Array.isArray(raw?.ledger) ? raw!.ledger : [],
    types,
    recon: Array.isArray(raw?.recon) ? raw!.recon : [],
    outbox: Array.isArray(raw?.outbox) ? raw!.outbox : [],
    email: baoDefaultEmailConfig(raw?.email),
    alerts: raw?.alerts ? { ...raw.alerts } : {},
    seq: {
      led: raw?.seq?.led || 0,
      rec: raw?.seq?.rec || 0,
      ob: raw?.seq?.ob || 0,
    },
    migrated: raw?.migrated || 0,
  }
}

export const baoIsOfficialTxn = (t?: TransactionRecord | null): boolean =>
  Boolean(t && t.type === 'official' && !t.sellerEmail)

export const baoTxnFor = (
  o: OrderRecord | null | undefined,
  txns: TransactionRecord[],
): TransactionRecord | null => (o ? txns.find((t) => t.orderId === o.id) || null : null)

export const baoIsOfficialOrder = (
  o: OrderRecord | null | undefined,
  txns: TransactionRecord[],
): boolean => baoIsOfficialTxn(baoTxnFor(o, txns))

export const baoStatusOf = (t?: TransactionRecord | null): BaoStatus =>
  (t && (t.bst || BAO_FROM_LEGACY[t.status])) || 'Request Received'

export function baoDayKey(d = new Date()): string {
  return (
    String(d.getFullYear()).slice(2) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  )
}

export function baoDate(d?: string | null): string {
  if (!d) return ''
  const x = new Date(/^\d{4}-\d\d-\d\d$/.test(d) ? d + 'T00:00:00' : d)
  return isNaN(x.getTime())
    ? String(d)
    : x.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function baoDt(v?: string | null): string {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
}

export function baoAge(iso: string): string {
  const m = Math.max(0, Date.now() - Date.parse(iso))
  const d = Math.floor(m / 86400000)
  const h = Math.floor(m / 3600000)
  return d >= 1
    ? `${d} day${d === 1 ? '' : 's'}`
    : h >= 1
      ? `${h} hour${h === 1 ? '' : 's'}`
      : 'under 1 hour'
}

export function baoAllowed(bao: BaoState, from: BaoStatus, to: BaoStatus): boolean {
  return ((bao.settings.transitions || {})[from] || []).includes(to)
}

export function baoStudentCanCancel(
  o: OrderRecord,
  txns: TransactionRecord[],
  bao: BaoState,
): boolean {
  const t = baoTxnFor(o, txns)
  if (!baoIsOfficialTxn(t)) return true
  const st = baoStatusOf(t)
  return bao.settings.studentCancelFrom.includes(st) && baoAllowed(bao, st, 'Cancelled')
}

export function baoProgress(t: TransactionRecord): {
  idx: number
  hold: boolean
  cancelled: boolean
  cur: BaoStatus
} {
  const cur = baoStatusOf(t)
  let idx = BAO_STEPS.indexOf(cur)
  ;(t.bhist || []).forEach((h) => {
    const i = BAO_STEPS.indexOf(h.to)
    if (i > idx) idx = i
  })
  if (idx < 0) idx = 0
  return { idx, hold: cur === 'On Hold', cancelled: cur === 'Cancelled', cur }
}

export function baoTypeById(bao: BaoState, id?: string | null): BaoItemType | null {
  if (!id) return null
  return bao.types.find((t) => t.id === id) || null
}

export function baoMatchItemTypeForListing(
  bao: BaoState,
  input: { cat?: string; sub?: string; tag?: string; name?: string },
): BaoItemType | null {
  const cat = input.cat || ''
  const sub = input.sub || ''
  const tag = input.tag || ''
  const name = (input.name || '').toLowerCase()

  // 1. Exact subcategory or tag match first (e.g. Uniform -> ty-uniform)
  if (sub === 'Uniform' || tag === 'Uniform' || /\buniform\b|\bpe shirt\b|\bpolo\b|\bblouse\b/i.test(name)) {
    const uni = bao.types.find((t) => t.id === 'ty-uniform' || t.name === 'Uniform' || t.sub === 'Uniform')
    if (uni) return uni
  }
  // 2. Sablay only when explicitly named Sablay or tag/sub is Sablay
  if (sub === 'Sablay' || tag === 'Sablay' || /\bsablay\b/i.test(name)) {
    const sab = bao.types.find((t) => t.id === 'ty-sablay' || t.name === 'Sablay')
    if (sab) return sab
  }
  // 3. Books & Academic Materials
  if (
    cat === 'Books and Academic Materials' ||
    sub === 'Textbook' ||
    sub === 'Manual' ||
    tag === 'Book' ||
    tag === 'Textbook' ||
    tag === 'Manual'
  ) {
    const bk = bao.types.find((t) => t.id === 'ty-book' || t.name === 'Book' || t.category === 'Books and Academic Materials')
    if (bk) return bk
  }
  // 4. RTU Merchandise
  if (cat === 'RTU Merchandise' || tag === 'Merchandise' || tag === 'Merch') {
    const mc = bao.types.find((t) => t.id === 'ty-merch' || t.name === 'Merchandise' || t.category === 'RTU Merchandise')
    if (mc) return mc
  }
  // 5. Exact category match (excluding Sablay unless name matches)
  const byCat = bao.types.find((t) => t.category === cat && t.id !== 'ty-sablay' && t.name !== 'Sablay')
  if (byCat) return byCat

  return bao.types.find((t) => t.id === 'ty-other' || t.name === 'Other') || bao.types[0] || null
}

export function baoItemType(bao: BaoState, p?: PrototypeProduct | null): BaoItemType | null {
  if (!p) return null
  // If product has sub === 'Uniform' or tag === 'Uniform', always resolve to Uniform type
  if (p.sub === 'Uniform' || p.tag === 'Uniform') {
    const uni = bao.types.find((t) => t.id === 'ty-uniform' || t.name === 'Uniform' || t.sub === 'Uniform')
    if (uni) return uni
  }
  // Guard against items that were accidentally assigned ty-sablay when their name is not Sablay
  const rawId = p.inv?.type
  if (rawId && !(rawId === 'ty-sablay' && !/sablay/i.test(p.name + ' ' + (p.sub || '')))) {
    const found = baoTypeById(bao, rawId)
    if (found) return found
  }
  return (
    baoMatchItemTypeForListing(bao, {
      cat: p.category || p.cat,
      sub: p.sub,
      tag: p.tag,
      name: p.name,
    }) ||
    baoTypeById(bao, BAO_LEGACY_TYPE[p.tag] || 'ty-other') ||
    bao.types[0] ||
    null
  )
}

export interface BaoCountedUnit {
  p: PrototypeProduct
  vid: string
  row: ProductVariationRow | null
  label: string
  onHand: number
  available: number
  low: number | null
}

export function baoUnits(p?: PrototypeProduct | null): BaoCountedUnit[] {
  if (!p) return []
  if (hasVars(p) && p.vars) {
    return p.vars.rows.map((r) => ({
      p,
      vid: r.id,
      row: r,
      label: varLabel(p, r),
      onHand: r.onHand == null ? r.qty : r.onHand,
      available: r.qty,
      low: r.low == null ? null : r.low,
    }))
  }
  return [
    {
      p,
      vid: '',
      row: null,
      label: '',
      onHand: p.onHand == null ? p.left : p.onHand,
      available: p.left,
      low: null,
    },
  ]
}

export function baoUnit(p?: PrototypeProduct | null, vid?: string | null): BaoCountedUnit | null {
  return baoUnits(p).find((u) => u.vid === (vid || '')) || null
}

export const baoReserved = (u: BaoCountedUnit): number => Math.max(0, u.onHand - u.available)

export const baoUnitName = (u: BaoCountedUnit): string =>
  u.p.name + (u.label ? ` (${u.label})` : '')

export function baoThreshold(u: BaoCountedUnit): number | null {
  if (u.low != null) return u.low
  const i = u.p.inv
  if (i && i.low != null) return i.low
  return null
}

export function baoIsLow(u: BaoCountedUnit): boolean {
  const t = baoThreshold(u)
  return t != null && u.available <= t
}

export function baoLowUnits(official: PrototypeProduct[]): BaoCountedUnit[] {
  const out: BaoCountedUnit[] = []
  official.forEach((p) =>
    baoUnits(p).forEach((u) => {
      if (baoIsLow(u)) out.push(u)
    }),
  )
  return out
}

export function baoStockLine(p: PrototypeProduct): string {
  const us = baoUnits(p)
  const oh = us.reduce((a, u) => a + u.onHand, 0)
  const av = us.reduce((a, u) => a + u.available, 0)
  return `${oh} on hand · ${Math.max(0, oh - av)} reserved · ${av} available`
}

export function baoWindowState(
  bao: BaoState,
  p?: PrototypeProduct | null,
): { open: boolean; msg: string } {
  const now = Date.now()
  const check = (
    w: { enabled?: boolean; start?: string; end?: string; message?: string } | null | undefined,
    label: string,
  ) => {
    if (!w || !w.enabled) return null
    const s = w.start ? Date.parse(w.start) : null
    const e = w.end ? Date.parse(w.end) : null
    if (s && !isNaN(s) && now < s) {
      return {
        open: false,
        msg: `${label} ordering opens ${baoDt(w.start)}.${w.message ? ' ' + w.message : ''}`,
      }
    }
    if (e && !isNaN(e) && now > e) {
      return {
        open: false,
        msg: `${label} ordering closed ${baoDt(w.end)}.${w.message ? ' ' + w.message : ''}`,
      }
    }
    return null
  }
  const gw = check(bao.settings.window, 'Store')
  if (gw) return gw
  const iw = check(p?.inv?.win, 'This item')
  if (iw) return iw
  return { open: true, msg: '' }
}

export function baoWindowText(bao: BaoState, p?: PrototypeProduct | null): string[] {
  const out: string[] = []
  const now = Date.now()
  const add = (
    w: { enabled?: boolean; start?: string; end?: string; message?: string } | null | undefined,
    who: string,
  ) => {
    if (!(w && w.enabled && (w.start || w.end))) return
    const s = w.start ? Date.parse(w.start) : null
    const e = w.end ? Date.parse(w.end) : null
    let t = ''
    if (s && !isNaN(s) && now < s) {
      t = `ordering opens ${baoDt(w.start)}${e ? ' and closes ' + baoDt(w.end) : ''}`
    } else if (e && !isNaN(e) && now > e) {
      t = `ordering is closed (it closed ${baoDt(w.end)})`
    } else {
      t = `ordering is open${e ? ' until ' + baoDt(w.end) : s ? ' since ' + baoDt(w.start) : ''}`
    }
    out.push(`${who}: ${t}.${w.message ? ' ' + w.message : ''}`)
  }
  add(bao.settings.window, 'Store')
  add(p?.inv?.win, 'This item')
  return out
}

export function baoLimitFor(bao: BaoState, p?: PrototypeProduct | null): number {
  const i = p?.inv && Number(p.inv.limit)
  if (i && i > 0) return i
  return Number(bao.settings.limitPerStudent) > 0 ? Number(bao.settings.limitPerStudent) : 0
}

export function baoStudentCount(
  bao: BaoState,
  txns: TransactionRecord[],
  p: PrototypeProduct,
  email?: string | null,
  sid?: string | null,
): number {
  const e = String(email || '').toLowerCase()
  let since = 0
  const w = bao.settings.window
  const iw = p.inv?.win
  ;[w, iw].forEach((x) => {
    if (x && x.enabled && x.start && Date.parse(x.start) > since) {
      since = Date.parse(x.start)
    }
  })
  return txns
    .filter(
      (t) =>
        baoIsOfficialTxn(t) &&
        baoStatusOf(t) !== 'Cancelled' &&
        Date.parse(t.created) >= since &&
        ((e && String(t.buyerEmail || '').toLowerCase() === e) ||
          (sid && t.buyerSid && t.buyerSid === sid)),
    )
    .reduce(
      (a, t) =>
        a + t.lines.filter((l) => l.pid === p.id).reduce((b, l) => b + l.qty, 0),
      0,
    )
}

export function baoClaimNotes(
  bao: BaoState,
  official: PrototypeProduct[],
  t: TransactionRecord,
): string[] {
  const out: string[] = []
  if (bao.settings.claimNote) out.push(bao.settings.claimNote)
  t.lines.forEach((l) => {
    const p = official.find((x) => x.id === l.pid)
    if (p?.inv?.claimNote) {
      const s = `${p.name}: ${p.inv.claimNote}`
      if (!out.includes(s)) out.push(s)
    }
  })
  return out
}

export function baoMessage(t: TransactionRecord, to: BaoStatus, note?: string): string {
  const q = t.queue ? ` Queue number: ${t.queue}.` : ''
  const n = note ? ` Note: ${note}` : ''
  const m: Record<BaoStatus, string> = {
    'Request Received': `The BAO received your request ${t.id}.`,
    Confirmed: `The BAO confirmed your request ${t.id}.`,
    'On Hold': `Your request ${t.id} is on hold.`,
    'Ready for Pickup':
      `Your request ${t.id} is ready for pickup.` +
      (t.pickup ? ` Pickup date: ${baoDate(t.pickup)}.` : ''),
    Claimed: `Your request ${t.id} was marked as claimed.`,
    Cancelled: `Your request ${t.id} was cancelled.`,
  }
  return m[to] + q + n
}

export function baoEmailCompose(
  bao: BaoState,
  official: PrototypeProduct[],
  t: TransactionRecord,
  status: BaoStatus,
): { subject: string; text: string } {
  const cl = baoClaimNotes(bao, official, t)
  const lines = [
    'Hello,',
    '',
    baoMessage(t, status, t.note),
    '',
    `Reference: ${t.id}`,
    t.queue ? `Queue number: ${t.queue}` : null,
    `Status: ${status}`,
    'Items:',
    ...t.lines.map((l) => `- ${l.name} x ${l.qty}`),
    t.pickup && status !== 'Cancelled' ? `Pickup date: ${baoDate(t.pickup)}` : null,
    cl.length ? `Claim notes: ${cl.join(' ')}` : null,
    '',
    'You can see the same information in My Orders on RTU Tindahan.',
    'This is an automatic message. Please do not reply.',
  ].filter((x): x is string => x !== null)

  return {
    subject: `[RTU Tindahan] ${t.id}: ${status}`,
    text: lines.join('\n'),
  }
}

export function baoLedgerCheck(
  bao: BaoState,
  official: PrototypeProduct[],
  txns: TransactionRecord[],
): Array<{
  item: string
  ledgerOnHand?: number
  onHand?: number
  ledgerReserved?: number
  reserved: number
  openTickets?: number
}> {
  const sums = new Map<string, { oh: number; rs: number }>()
  const bad: Array<{
    item: string
    ledgerOnHand?: number
    onHand?: number
    ledgerReserved?: number
    reserved: number
    openTickets?: number
  }> = []

  bao.ledger.forEach((e: BaoLedgerEntry) => {
    const k = `${e.pid}|${e.vid || ''}`
    const s = sums.get(k) || { oh: 0, rs: 0 }
    s.oh += e.ohD
    s.rs += e.rsD
    sums.set(k, s)
  })

  official.forEach((p) =>
    baoUnits(p).forEach((u) => {
      const s = sums.get(`${p.id}|${u.vid}`) || { oh: 0, rs: 0 }
      if (
        s.oh !== u.onHand ||
        s.rs !== baoReserved(u) ||
        u.available < 0 ||
        u.onHand < 0
      ) {
        bad.push({
          item: baoUnitName(u),
          ledgerOnHand: s.oh,
          onHand: u.onHand,
          ledgerReserved: s.rs,
          reserved: baoReserved(u),
        })
      }
    }),
  )

  const held = new Map<string, number>()
  txns
    .filter(baoIsOfficialTxn)
    .filter((t) => !['Claimed', 'Cancelled'].includes(baoStatusOf(t)))
    .forEach((t) =>
      t.lines.forEach((l) => {
        if (!l.pid) return
        const k = `${l.pid}|${l.vid || ''}`
        held.set(k, (held.get(k) || 0) + l.qty)
      }),
    )

  official.forEach((p) =>
    baoUnits(p).forEach((u) => {
      const h = held.get(`${p.id}|${u.vid}`) || 0
      if (h !== baoReserved(u)) {
        bad.push({
          item: baoUnitName(u),
          openTickets: h,
          reserved: baoReserved(u),
        })
      }
    }),
  )

  return bad
}

export function baoDownloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const q = (v: string | number | null | undefined) =>
    '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'
  const csv = rows.map((r) => r.map(q).join(',')).join('\r\n')
  const u = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = u
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(u), 500)
}
