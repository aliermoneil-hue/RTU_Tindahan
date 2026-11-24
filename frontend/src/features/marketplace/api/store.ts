/**
 * OFFICIAL STORE API
 * ---------------------------------------------------------------
 * The bridge between Django's store app and the staff screens.
 *
 * The pages keep reading `db.txn`, `db.bao.ledger` and `db.bao.settings` from
 * `TindahanContext`; this module is the only place that knows the backend's
 * field names, exactly like `api/listings.ts` does for the catalogue.
 *
 * Two naming traps:
 *   - the backend stores status codes (`request_received`), the prototype uses
 *     display labels ('Request Received'), so every read maps one to the other
 *   - ids from the server carry the `api:` prefix so a merge can replace server
 *     rows and leave anything still local to the prototype alone
 */

import { apiFetch } from '@/common/api/client'

import { BAO_LEGACY } from '../baoHelpers'
import type {
  BaoLedgerEntry,
  BaoLedgerType,
  BaoReconRecord,
  BaoState,
  BaoStatus,
  PrototypeProduct,
  TransactionHistoryItem,
  TransactionLine,
  TransactionRecord,
} from '../types'

/** Prefix for rows that came from Django, so local ids never collide. */
export const STORE_ID_PREFIX = 'api:'

// ---------------------------------------------------------------------------
// Wire shapes (what Django actually sends)
// ---------------------------------------------------------------------------

export interface ApiTicketLine {
  id: number
  listing: number
  listing_title: string
  variant: number | null
  variant_name: string | null
  quantity: number
  unit_price: string
  line_total: string
}

export interface ApiTicketHistory {
  id: number
  from_status: string
  to_status: string
  changed_by_email: string | null
  note: string
  created_at: string
}

export interface ApiTicket {
  id: number
  reference: string
  buyer: number
  buyer_name: string
  buyer_email: string
  status: string
  status_display: string
  pickup_date: string | null
  claim_notes: string
  cancelled_reason: string
  items: ApiTicketLine[]
  total_amount: string
  is_open: boolean
  status_history: ApiTicketHistory[]
  created_at: string
  updated_at: string
}

export interface ApiStockMovement {
  id: number
  variant: number
  item: string
  variant_name: string
  ticket_reference: string | null
  kind: string
  quantity: number
  reason: string
  on_hand_after: number
  available_after: number
  created_by_email: string | null
  created_at: string
}

export interface ApiDailyCount {
  id: number
  variant: number
  item: string
  variant_name: string
  counted_on: string
  expected_on_hand: number
  counted_quantity: number
  difference: number
  reason: string
  counted_by_email: string | null
  created_at: string
}

export interface ApiStoreSettings {
  low_stock_threshold: number
  max_quantity_per_ticket: number
  max_quantity_per_student: number
  ordering_window_enabled: boolean
  ordering_window_start: string | null
  ordering_window_end: string | null
  allow_cancel_from: string[]
  /** EM-04: where a low stock message goes; empty means it is Skipped. */
  low_stock_emails: string[]
  /** OS-12: the store's own rules, editable by staff. */
  allowed_transitions: Record<string, string[]>
  reason_required: string[]
  queue_prefix: string
  queue_number_width: number
  claim_note: string
  updated_at: string
}

interface ApiPage<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

/** Django status code -> prototype label. */
export function toBaoStatus(code: string): BaoStatus {
  const map: Record<string, BaoStatus> = {
    request_received: 'Request Received',
    confirmed: 'Confirmed',
    on_hold: 'On Hold',
    ready_for_pickup: 'Ready for Pickup',
    claimed: 'Claimed',
    cancelled: 'Cancelled',
  }
  return map[code] ?? 'Request Received'
}

/** Prototype label -> Django status code (what a transition POST needs). */
export function toApiStatus(label: BaoStatus): string {
  const map: Record<BaoStatus, string> = {
    'Request Received': 'request_received',
    Confirmed: 'confirmed',
    'On Hold': 'on_hold',
    'Ready for Pickup': 'ready_for_pickup',
    Claimed: 'claimed',
    Cancelled: 'cancelled',
  }
  return map[label]
}

/** Django ledger kind -> prototype ledger type. */
const LEDGER_KIND: Record<string, BaoLedgerType> = {
  stock_in: 'Stock In',
  reserved: 'Reserved',
  released: 'Released',
  issued: 'Issued',
  sold: 'Sold',
  adjustment: 'Adjustment',
}

const LEDGER_KIND_API: Record<BaoLedgerType, string> = {
  'Stock In': 'stock_in',
  Reserved: 'reserved',
  Released: 'released',
  Issued: 'issued',
  Sold: 'sold',
  Adjustment: 'adjustment',
}

export const toApiLedgerKind = (type: BaoLedgerType): string => LEDGER_KIND_API[type]

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

/** Every ticket (staff) or your own tickets (student). Follows pagination. */
export async function fetchTickets(status?: string): Promise<ApiTicket[]> {
  const collected: ApiTicket[] = []
  let path: string | null = status
    ? `/store/tickets/?status=${encodeURIComponent(status)}`
    : '/store/tickets/'
  for (let page = 0; page < 10 && path; page += 1) {
    const data: ApiPage<ApiTicket> = await apiFetch<ApiPage<ApiTicket>>(path)
    collected.push(...(data.results ?? []))
    path = data.next ? data.next.slice(data.next.indexOf('/api/v1') + '/api/v1'.length) : null
  }
  return collected
}

/** Staff: every stock movement, newest first. */
export async function fetchStock(): Promise<ApiStockMovement[]> {
  const data = await apiFetch<ApiPage<ApiStockMovement>>('/store/stock/')
  return data.results ?? []
}

/** Staff: the day's reconciliation rows. */
export async function fetchDailyCounts(): Promise<ApiDailyCount[]> {
  const data = await apiFetch<ApiPage<ApiDailyCount>>('/store/daily-counts/')
  return data.results ?? []
}

/** Public read, staff write. */
export async function fetchStoreSettings(): Promise<ApiStoreSettings> {
  return apiFetch<ApiStoreSettings>('/store/settings/')
}

export async function patchStoreSettings(
  body: Partial<ApiStoreSettings>,
): Promise<ApiStoreSettings> {
  return apiFetch<ApiStoreSettings>('/store/settings/', { method: 'PATCH', body })
}

/** Move a ticket. The backend checks the transition is allowed. */
export async function transitionTicket(
  reference: string,
  status: BaoStatus,
  note = '',
): Promise<ApiTicket> {
  return apiFetch<ApiTicket>(
    `/store/tickets/${encodeURIComponent(reference)}/transition/`,
    { method: 'POST', body: { status: toApiStatus(status), note } },
  )
}

/** Staff: add stock to one variant. */
export async function stockIn(
  variant: number,
  quantity: number,
  reason = '',
): Promise<void> {
  await apiFetch('/store/stock-in/', {
    method: 'POST',
    body: { variant, quantity, reason: reason || undefined },
  })
}

/** Staff: record a face-to-face sale at the window (no ticket). */
export async function sellStock(
  variant: number,
  quantity: number,
  reason = '',
): Promise<void> {
  await apiFetch('/store/sales/', {
    method: 'POST',
    body: {
      items: [{ variant, quantity }],
      ...(reason ? { reason } : {}),
    },
  })
}

/** Staff: record a physical count for one variant. */
export async function recordDailyCount(
  variant: number,
  counted: number,
  reason = '',
): Promise<void> {
  await apiFetch('/store/daily-counts/', {
    method: 'POST',
    body: { variant, counted_quantity: counted, reason: reason || undefined },
  })
}

/** A student's official-store request. Lines take backend listing/variant ids. */
export async function createTicket(input: {
  items: Array<{ listing: number; variant: number; quantity: number }>
  pickupDate?: string | null
  claimNotes?: string
  /** Office staff only: record the request for another member. */
  buyerEmail?: string
}): Promise<ApiTicket> {
  return apiFetch<ApiTicket>('/store/tickets/', {
    method: 'POST',
    body: {
      items: input.items,
      pickup_date: input.pickupDate || null,
      claim_notes: input.claimNotes || '',
      ...(input.buyerEmail ? { buyer_email: input.buyerEmail } : {}),
    },
  })
}

// ---------------------------------------------------------------------------
// Mapping into the prototype snapshot
// ---------------------------------------------------------------------------

/** The backend ids behind a prototype product/variant pair (`api:slug`, `v12`). */
export function backendIds(product?: PrototypeProduct | null, vid?: string | null): {
  listing: number | null
  variant: number | null
} {
  const listing = product?.apiListingId ?? null
  const variant = vid && /^v\d+$/.test(vid) ? Number(vid.slice(1)) : null
  return { listing, variant }
}

/** One ticket -> the row `StoreOrdersPage` already renders. */
export function toTransactionRecord(
  dto: ApiTicket,
  productOf: (listingId: number) => PrototypeProduct | undefined = () => undefined,
): TransactionRecord {
  const status = toBaoStatus(dto.status)
  const lines: TransactionLine[] = dto.items.map((item) => ({
    pid: productOf(item.listing)?.id ?? `api:listing-${item.listing}`,
    vid: item.variant ? `v${item.variant}` : '',
    name: item.variant_name
      ? `${item.listing_title} (${item.variant_name})`
      : item.listing_title,
    qty: item.quantity,
    price: Number(item.unit_price),
    kind: 'product',
  }))
  const qty = dto.items.reduce((total, item) => total + item.quantity, 0)
  const history: TransactionHistoryItem[] = dto.status_history.map((row) => ({
    status: BAO_LEGACY[toBaoStatus(row.to_status)],
    ts: row.created_at,
    by: row.changed_by_email || '',
    note: row.note,
  }))
  return {
    id: STORE_ID_PREFIX + dto.reference,
    orderId: dto.reference,
    type: 'official',
    kind: 'product',
    lines,
    summary: lines.map((line) => `${line.qty} × ${line.name}`).join(', '),
    qty,
    total: Number(dto.total_amount),
    buyerEmail: dto.buyer_email,
    buyerName: dto.buyer_name,
    buyerSid: '',
    sellerEmail: null,
    sellerName: 'Official RTU Store',
    sellerSid: '',
    meetup: 'Official RTU Store',
    created: dto.created_at,
    updated: dto.updated_at,
    status: BAO_LEGACY[status],
    history,
    bst: status,
    src: 'Online',
    queue: null,
    pickup: dto.pickup_date || '',
    note: dto.cancelled_reason || dto.claim_notes || '',
    staff: '',
    staffEmail: '',
    bhist: dto.status_history.map((row) => ({
      ts: row.created_at,
      from: row.from_status ? toBaoStatus(row.from_status) : null,
      to: toBaoStatus(row.to_status),
      by: row.changed_by_email ? row.changed_by_email.split('@')[0] : 'Backend',
      byEmail: row.changed_by_email || '',
      note: row.note,
    })),
  }
}

/** One stock movement -> a ledger row for the inventory screen. */
export function toLedgerEntry(
  dto: ApiStockMovement,
  product?: PrototypeProduct,
): BaoLedgerEntry {
  const onHand = dto.on_hand_after
  const available = dto.available_after
  return {
    id: STORE_ID_PREFIX + dto.id,
    ts: dto.created_at,
    pid: product?.id ?? `api:listing-${dto.variant}`,
    item: dto.item,
    vid: `v${dto.variant}`,
    label: dto.variant_name || '',
    type: LEDGER_KIND[dto.kind] ?? 'Adjustment',
    qty: dto.quantity,
    ohD: 0,
    rsD: 0,
    ticket: dto.ticket_reference || '',
    reason: dto.reason || '',
    by: dto.created_by_email ? dto.created_by_email.split('@')[0] : 'Backend',
    byEmail: dto.created_by_email || '',
    after: {
      onHand,
      reserved: Math.max(0, onHand - available),
      available,
    },
  }
}

/** One reconciliation row -> the prototype's `BaoReconRecord`. */
export function toReconRecord(
  dto: ApiDailyCount,
  countedBy: string,
): BaoReconRecord {
  return {
    id: STORE_ID_PREFIX + dto.id,
    ts: dto.created_at,
    day: dto.counted_on,
    by: countedBy,
    byEmail: dto.counted_by_email || '',
    lines: [
      {
        pid: `api:variant-${dto.variant}`,
        vid: `v${dto.variant}`,
        item: dto.item,
        label: dto.variant_name || '',
        expected: dto.expected_on_hand,
        counted: dto.counted_quantity,
        diff: dto.difference,
        reason: dto.reason,
      },
    ],
  }
}

/** Settings from Django, narrowed to what the prototype models. */
export function settingsPatch(dto: ApiStoreSettings): {
  limitPerStudent: number
  window: { enabled: boolean; start: string; end: string }
} {
  const clock = (value: string | null) => (value ? value.slice(0, 5) : '')
  return {
    limitPerStudent: dto.max_quantity_per_student || 0,
    window: {
      enabled: dto.ordering_window_enabled,
      start: clock(dto.ordering_window_start),
      end: clock(dto.ordering_window_end),
    },
  }
}

// ---------------------------------------------------------------------------
// Merging into the snapshot
// ---------------------------------------------------------------------------

/** The slice of the prototype snapshot this module rewrites. */
export interface StoreShape {
  txn: TransactionRecord[]
  bao: BaoState
}

export interface StorePayload {
  tickets: ApiTicket[]
  stock: ApiStockMovement[]
  settings?: ApiStoreSettings
  /** Every product the snapshot knows, used to resolve backend ids to rows. */
  products: PrototypeProduct[]
}

/**
 * Replace the backend-sourced store rows, leaving everything else alone.
 *
 * Official tickets are replaced wholesale rather than merged: the server owns
 * them now, and a prototype ticket left behind would look like a real request.
 * Student orders (`type: 'student'`) stay, because nothing else creates them.
 */
/**
 * Replace only the Official Store tickets in a snapshot.
 *
 * A student may read their own tickets but not the stock ledger, so this is
 * the buyer's half of `mergeApiStore`. Tickets are replaced wholesale because
 * the server owns them; student-to-student rows are left alone.
 */
export function mergeApiTickets<T extends { txn: TransactionRecord[] }>(
  prev: T,
  payload: { tickets: ApiTicket[]; products: PrototypeProduct[] },
): T {
  const byListing = new Map<number, PrototypeProduct>()
  payload.products.forEach((product) => {
    if (product.apiListingId) byListing.set(product.apiListingId, product)
  })

  const tickets = payload.tickets.map((dto) =>
    toTransactionRecord(dto, (listingId) => byListing.get(listingId)),
  )
  const studentTxns = prev.txn.filter(
    (txn) => !(txn.type === 'official' && !txn.sellerEmail),
  )
  return { ...prev, txn: [...tickets, ...studentTxns] }
}

export function mergeApiStore<T extends StoreShape>(prev: T, payload: StorePayload): T {
  const byListing = new Map<number, PrototypeProduct>()
  const byVariant = new Map<number, PrototypeProduct>()
  payload.products.forEach((product) => {
    if (product.apiListingId) byListing.set(product.apiListingId, product)
    ;(product.vars?.rows ?? []).forEach((row) => {
      if (/^v\d+$/.test(row.id)) byVariant.set(Number(row.id.slice(1)), product)
    })
  })

  const tickets = payload.tickets.map((dto) =>
    toTransactionRecord(dto, (listingId) => byListing.get(listingId)),
  )
  const studentTxns = prev.txn.filter(
    (txn) => !(txn.type === 'official' && !txn.sellerEmail),
  )

  // The API lists movements oldest first; the screen shows newest first.
  const ledger = payload.stock
    .map((dto) => toLedgerEntry(dto, byVariant.get(dto.variant)))
    .reverse()

  const patch = payload.settings ? settingsPatch(payload.settings) : null
  const settings = patch
    ? {
        ...prev.bao.settings,
        limitPerStudent: patch.limitPerStudent,
        window: { ...prev.bao.settings.window, ...patch.window },
      }
    : prev.bao.settings

  return {
    ...prev,
    txn: [...tickets, ...studentTxns],
    bao: { ...prev.bao, ledger, settings },
  }
}

/** EM-06: one prepared message in the store's outbox. Nothing here was sent. */
export interface ApiOutboxMessage {
  id: number
  kind: 'student' | 'staff'
  kind_display: string
  event: string
  state: 'prepared' | 'skipped'
  state_display: string
  recipients: string[]
  subject: string
  body: string
  note: string
  ticket_reference: string | null
  sent_at: string | null
  created_at: string
}

/** EM-06: the outbox, newest first, optionally narrowed. */
export async function fetchOutbox(filters: {
  kind?: string
  state?: string
} = {}): Promise<ApiOutboxMessage[]> {
  const params = new URLSearchParams()
  if (filters.kind) params.set('kind', filters.kind)
  if (filters.state) params.set('state', filters.state)
  const query = params.toString()
  const collected: ApiOutboxMessage[] = []
  let path: string | null = query ? `/store/outbox/?${query}` : '/store/outbox/'
  for (let page = 0; page < 10 && path; page += 1) {
    const data: ApiPage<ApiOutboxMessage> = await apiFetch<ApiPage<ApiOutboxMessage>>(path)
    collected.push(...(data.results ?? []))
    path = data.next ? data.next.slice(data.next.indexOf('/api/v1') + '/api/v1'.length) : null
  }
  return collected
}

/** EM-06: the same rows as a file. */
export function outboxExportPath(filters: { kind?: string; state?: string } = {}): string {
  const params = new URLSearchParams()
  if (filters.kind) params.set('kind', filters.kind)
  if (filters.state) params.set('state', filters.state)
  const query = params.toString()
  return `/store/outbox/export/${query ? `?${query}` : ''}`
}
