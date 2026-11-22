import type { IconName } from '@/common/components/icons'

export type ListingKind = 'product' | 'service'
export type FulfillmentMethod = 'pickup' | 'delivery' | 'both'
export type ChosenFulfillment = 'pickup' | 'delivery'

export interface ProductVariationAttr {
  name: string
  opts: string[]
  pendingName?: string
}

export interface ProductVariationRow {
  id: string
  key?: string
  opts: Record<string, string>
  qty: number
  onHand?: number
  low?: number | null
  price: number | null
}

export interface ProductVariations {
  attrs: ProductVariationAttr[]
  rows: ProductVariationRow[]
}

export interface PrototypeProduct {
  id: string
  name: string
  price: number
  cat: string
  category?: string
  sub?: string
  tone: string
  icon: IconName
  tag: string
  seller: string
  owner?: string
  left: number
  unit: string
  when: string
  avail?: string
  cond?: string
  desc: string
  imgs?: string[]
  pub?: number
  kind?: 'service'
  svcType?: string
  vars?: ProductVariations
  hidden?: boolean
  fulfillment?: FulfillmentMethod
  onHand?: number
  soldCount?: number
  inv?: BaoProductInv
  /**
   * Set only on products that came from the catalogue API, and equal to the
   * backend's `is_official`. Prototype lists leave it undefined so their older
   * role-based guessing still applies.
   */
  off?: boolean
  /**
   * The backend listing id behind `id` (`api:<slug>`), set only for products
   * that came from the catalogue API. Store endpoints take numeric ids, so a
   * screen that posts a variant back needs this rather than the slug.
   */
  apiListingId?: number
}

export interface UserListingRecord {
  lid: string
  ownerEmail: string
  state: 'live' | 'review' | 'removed'
  paused: boolean
  product: PrototypeProduct
  modHold?: {
    by: string
    ts: string
    note: string
    prev: 'live' | 'review' | 'removed'
    prevStatus?: string
  }
}

export interface SellerListingSummary {
  lid: string
  name: string
  status: 'Active' | 'Paused' | 'Pending approval' | 'Rejected' | 'Removed'
  views: number
  req: number
  price: number
}

export interface SellerRequestItem {
  id: string
  who: string
  what: string
  amt: number
  state: 'new' | 'accepted' | 'done' | 'declined' | 'cancelled'
  when: string
  orderId: string
  buyerEmail: string
  fulfillment?: ChosenFulfillment
  proofPhoto?: string | null
  proofAt?: string | null
  proofBy?: string | null
}

export interface OrderLine {
  pid: string
  qty: number
  vid?: string
  vlabel?: string
  price: number
  name?: string
  kind?: ListingKind
}

export interface OrderRecord {
  id: string
  title: string
  total: number
  status: 'Awaiting seller' | 'Meetup set' | 'Completed' | 'Cancelled'
  tab: 'Active' | 'Completed' | 'Cancelled'
  seller: string
  when: string
  stage: number
  tone: string
  icon: IconName
  buyerEmail: string
  sellerEmail: string | null
  lines: OrderLine[]
  fulfillment?: ChosenFulfillment
  proofPhoto?: string | null
  proofAt?: string | null
  proofBy?: string | null
}

export interface CartLine {
  id: string
  qty: number
  vid: string
  place: string
  time: string
  date?: string
  fulfillment?: ChosenFulfillment
  deliverySpot?: string
  edit?: boolean
  editing?: boolean
}

export interface NotificationLink {
  k:
    | 'order'
    | 'request'
    | 'txn'
    | 'listing'
    | 'message'
    | 'post'
    | 'approval'
    | 'freports'
    | 'reviews'
    | 'forum'
    | 'baostock'
    | 'baoorders'
  id?: string
}

export interface NotificationItem {
  t: string
  read: boolean
  ts: string
  at?: string
  link?: NotificationLink | null
}

export interface SellerChecklist {
  profile: boolean
  pickup: boolean
  rules: boolean
}

export interface PrototypeAccount {
  email: string
  ph: string
  first: string
  last: string
  name: string
  sid: string
  role: 'student' | 'moderator'
  aff: string
  prog: string
  since: string | Date
  verified: boolean
  status: 'active' | 'suspended' | 'banned'
  statusNote?: string
  statusBy?: string
  statusAt?: string
  base: number
  orders: OrderRecord[]
  cart: CartLine[]
  sellerList: SellerListingSummary[]
  sellerReq: SellerRequestItem[]
  windows: string[]
  checklist: SellerChecklist
  notifs: NotificationItem[]
  favs: string[]
  sfavs: string[]
  avatar: string | null
  draft?: string | null
}

export interface DraftVariationRow {
  id: string
  key: string
  opts: Record<string, string>
  qty: string
  price: string
}

export interface ListingDraft {
  type: ListingKind
  editLid: string | null
  title: string
  cat: string
  sub: string
  desc: string
  price: string
  qty: string
  cond: string
  place: string
  window: string
  tStart: string
  tEnd: string
  days: string[]
  agree: boolean
  images: string[]
  svcType: string
  unit: string
  fulfillment?: FulfillmentMethod
  vOn: boolean
  vAttrs: ProductVariationAttr[]
  vRows: DraftVariationRow[]
}

export interface ModerationFlag {
  id: string
  lid: string
  title: string
  pri: string
  risky: boolean
  price: number
  conf: number
  state: 'open' | 'approved' | 'removed'
  submitted: string
  decidedAt?: string
  reason: string
  note?: string
  seller: string
}

export interface AnnouncementItem {
  id: string
  t: string
  d: string
  b: string
}

export type ReactionKey = 'like' | 'love' | 'haha' | 'wow' | 'sad'

export interface ForumComment {
  id: string
  by: string
  email: string
  role: string
  text: string
  ts: string
  parent: string | null
  edited?: string
  deleted?: boolean
  hidden?: { by: string; ts: string }
}

export interface ForumPost {
  id: string
  kind: 'post' | 'student' | 'school' | 'notice'
  topic?: string
  title: string
  body: string
  by: string
  authorEmail?: string | null
  ts: string
  edited?: string
  pinned?: boolean
  hidden?: { by: string; ts: string }
  imgs?: string[]
  pid?: string
  price?: number
  tag?: string
  left?: number
  svc?: boolean
  aid?: string
  reacts: Record<string, ReactionKey>
  comments: ForumComment[]
  reports?: string[]
}

export interface ForumReport {
  id: string
  type: 'post' | 'comment' | 'order'
  postId: string
  commentId: string | null
  orderId?: string | null
  reporterRole?: 'buyer' | 'seller'
  reason: string
  details: string
  reporterEmail: string
  reporterName: string
  targetEmail: string | null
  targetName: string
  snap: {
    title: string
    text: string
    imgs: number
  }
  ts: string
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned'
  handledBy?: string
  handledAt?: string
  action?: 'hide' | 'restore' | 'delete' | 'warn'
  note?: string
}

export interface ModerationLogEntry {
  id: string
  ts: string
  by: string
  byEmail: string
  kind: string
  type: 'post' | 'comment' | 'order'
  postId: string
  commentId?: string | null
  reportId: string | null
  targetName: string
  note: string
  outcome: string
}

export interface MessageRef {
  type: 'product' | 'service' | 'order'
  id: string
  name: string
  pid: string | null
}

export interface ChatMessage {
  id: string
  from: string
  name: string
  staff: boolean
  text: string
  ts: string
  ref: MessageRef | null
  un?: string[]
  reacts?: Record<string, string>
  adminReview?: {
    listingId: string
    listingTitle: string
    decision: 'Not Approved' | 'Approved'
    reason: string
    flagId: string
  }
}

export interface Conversation {
  id: string
  alias?: string[]
  buyer: string
  buyerName: string
  seller: string | null
  sellerName: string
  ref: MessageRef
  msgs: ChatMessage[]
  last: string
  created: string
  seen: Record<string, number>
}

export interface TransactionHistoryItem {
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled'
  ts: string
  by: string
  note: string
}

export interface TransactionLine {
  pid: string | null
  vid?: string
  name: string
  qty: number
  price: number
  kind: ListingKind
}

export interface TransactionRecord {
  id: string
  orderId: string
  type: 'student' | 'official'
  kind: 'product' | 'service' | 'mixed'
  lines: TransactionLine[]
  summary: string
  qty: number
  total: number
  buyerEmail: string
  buyerName: string
  buyerSid: string
  sellerEmail: string | null
  sellerName: string
  sellerSid: string
  meetup: string
  fulfillment?: ChosenFulfillment
  created: string
  updated: string
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled'
  history: TransactionHistoryItem[]
  bst?: BaoStatus
  src?: 'Online' | 'Face to face'
  queue?: string | null
  pickup?: string
  note?: string
  staff?: string
  staffEmail?: string
  bhist?: BaoStatusHistoryItem[]
}

export interface ReviewRecord {
  id: string
  key: string
  kind: 'seller' | 'item'
  orderId: string
  pid: string
  sellerKey: string
  sellerName: string
  buyerEmail: string
  buyerName: string
  stars: number
  text: string
  ts: number
  edited: number | null
}

export interface AuditLogEntry {
  id: string
  ts: string
  by: string
  byName: string
  action: string
  targetType: string
  targetId: string
  targetName: string
  note: string
}

export interface ConfirmDialogConfig {
  id: string
  title: string
  msg: string
  yes: string
  no: string
  danger?: boolean
  run: () => void
}


export type BaoStatus =
  | 'Request Received'
  | 'Confirmed'
  | 'On Hold'
  | 'Ready for Pickup'
  | 'Claimed'
  | 'Cancelled'

export type BaoLedgerType =
  | 'Stock In'
  | 'Reserved'
  | 'Released'
  | 'Issued'
  | 'Sold'
  | 'Adjustment'

export interface BaoStatusHistoryItem {
  from: BaoStatus | null
  to: BaoStatus
  by: string
  byEmail: string
  ts: string
  note: string
  migrated?: boolean
}

export interface BaoOrderingWindow {
  enabled: boolean
  start: string
  end: string
  message: string
}

export interface BaoProductInv {
  type: string
  low: number | null
  win: BaoOrderingWindow | null
  limit: number
  claimNote: string
  mig?: number
}

export interface BaoItemType {
  id: string
  name: string
  category: string
  sub: string
  tone: string
  icon: IconName
  active: boolean
}

export interface BaoLedgerEntry {
  id: string
  ts: string
  pid: string
  item: string
  vid: string
  label: string
  type: BaoLedgerType
  qty: number
  ohD: number
  rsD: number
  ticket: string
  reason: string
  by: string
  byEmail: string
  pend?: boolean
  migrated?: boolean
  after: {
    onHand: number
    reserved: number
    available: number
  }
}

export interface BaoReconLine {
  pid: string
  item: string
  vid: string
  label: string
  expected: number
  counted: number
  diff: number
  reason: string
}

export interface BaoReconRecord {
  id: string
  ts: string
  day: string
  by: string
  byEmail: string
  lines: BaoReconLine[]
}

export interface BaoOutboxEntry {
  id: string
  ts: string
  kind: 'student' | 'staff'
  event: string
  ticket: string
  to: string[]
  subject: string
  text: string
  state: 'prepared' | 'skipped'
  note: string
  sentAt: string | null
}

export interface BaoEmailConfig {
  enabled: boolean
  provider: string
  domain: string
  events: Record<string, boolean>
  lowStock: boolean
  lowStockTo: string[]
}

export interface BaoSettings {
  transitions: Record<BaoStatus, BaoStatus[]>
  reasonRequired: BaoStatus[]
  studentCancelFrom: BaoStatus[]
  queue: {
    enabled: boolean
    prefix: string
    pad: number
    dailyReset: boolean
  }
  claimNote: string
  window: BaoOrderingWindow
  limitPerStudent: number
}

export interface BaoState {
  v: number
  settings: BaoSettings
  queue: { day: string; n: number }
  ledger: BaoLedgerEntry[]
  types: BaoItemType[]
  recon: BaoReconRecord[]
  outbox: BaoOutboxEntry[]
  email: BaoEmailConfig
  alerts: Record<string, { since: string; available: number }>
  seq: { led: number; rec: number; ob: number }
  migrated: number
}
