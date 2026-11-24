import {
  BAO_EFFECT,
  BAO_EMAIL_EVENTS,
  BAO_FROM_LEGACY,
  BAO_LEGACY,
  BAO_LEGACY_TYPE,
  BAO_LTYPES,
  BAO_ORDER_STATUS,
  BAO_OUTBOX_MAX,
  BAO_STAGE,
  BAO_STATUSES,
  baoAllowed,
  baoDate,
  baoDayKey,
  baoDefaultEmailConfig,
  baoDefaultState,
  baoEmailCompose,
  baoIsLow,
  baoIsOfficialOrder,
  baoIsOfficialTxn,
  baoItemType,
  baoMatchItemTypeForListing,
  baoLimitFor,
  baoMessage,
  baoReserved,
  baoStatusOf,
  baoStudentCount,
  baoThreshold,
  baoTxnFor,
  baoTypeById,
  baoUnit,
  baoUnitName,
  baoUnits,
  baoWindowState,
} from '../baoHelpers'
import { getPickupDates } from "../dateHelper"
import { playHeart, playMessage, playNotice, playPop, playRemove, playSuccess } from "@/common/sounds"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ApiRequestError, apiFetch, getToken } from '@/common/api/client'
import {
  API_ID_PREFIX,
  createListing,
  fetchListings,
  fetchMyListings,
  mergeApiCatalogue,
  type ApiListing,
  type ApiPage,
} from '../api/listings'
import {
  apiConversationId,
  fetchConversations,
  markConversationRead,
  mergeApiConversations,
  openConversation,
  sendMessage as postChatMessage,
} from '../api/messages'
import {
  favoriteKeys,
  fetchFavorites,
  toggleListingFavorite,
  toggleSellerFavorite,
} from '../api/favorites'
import {
  deleteReview as deleteApiReview,
  fetchReviews,
  reviewRecordFromApi,
  submitReview as postReview,
} from '../api/reviews'
import {
  FORUM_PREFIX,
  apiForumId,
  createForumPost as createForumPostApi,
  deleteForumComment as deleteForumCommentApi,
  deleteForumPost as deleteForumPostApi,
  announcementFromApi,
  fetchForumPosts,
  fetchForumReports,
  fetchNotices,
  forumPostFromApi,
  forumReportFromApi,
  moderateForumComment,
  moderateForumPost,
  postForumComment,
  reactForumPost,
  resolveForumReportApi,
  submitForumReportApi,
  updateForumComment as updateForumCommentApi,
  updateForumPost as updateForumPostApi,
  type ApiForumReport,
} from '../api/forum'
import {
  apiNotificationId,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  notificationFromApi,
} from '../api/notifications'
import {
  accountFromAdminUser,
  auditEntryFromApi,
  downloadDatabaseBackup,
  fetchAdminUsers,
  fetchAuditLog,
  setUserStatus as setUserStatusApi,
} from '../api/admin'
import {
  createOrder as createApiOrder,
  fetchOrders as fetchApiOrders,
  orderRecordFromApi,
  orderStatusFromApi,
  setOrderPayment as setOrderPaymentApi,
  transitionOrder as transitionApiOrder,
  type ApiOrder,
} from '../api/orders'
import {
  STORE_ID_PREFIX,
  createTicket,
  fetchStock,
  fetchStoreSettings,
  fetchTickets,
  mergeApiStore,
  mergeApiTickets,
  patchStoreSettings,
  recordDailyCount,
  sellStock as postWalkInSale,
  stockIn as postStockIn,
  transitionTicket as postTicketTransition,
} from '../api/store'
import { navigate } from '@/common/router/router'
import { useAuth } from '@/features/authentication'
import { useProfileSettings } from '../profileSettingsStore'
import type { User } from '@/common/types'
import {
  CATEGORIES,
  CAT_META,
  CONDITIONS,
  FR_ACTIONS,
  FR_REASONS,
  ORDER_REPORT_REASONS_BUYER,
  ORDER_REPORT_REASONS_SELLER,
  getSellerTimeWindows,
  OFFCAT,
  OFFSUB,
  OTYPE,
  PLACES,
  SERVICES_CAT,
  SUBCATS,
  SVC_TYPES,
  SVC_UNITS,
  TIMES,
  TX_FLOW,
  TX_NOTE,
  VAR_LIMITS,
  blankDraft,
  cleanDays,
  findVar,
  hash,
  hasVars,
  isSvc,
  mkAcct,
  normCat,
  nowT,
  sellerLabel,
  shortName,
  stamp,
  stockOf,
  subOf,
  syncLeft,
  tc,
  timeError,
  toHM,
  toMin,
  uid,
  unitPrice,
  varLabel,
  vLineName,
  vSyncRows,
  winText,
  parseWindow,
} from '../constants'
import {
  IMGK,
  IMG_RULES,
  clearAllImgs,
  imgSrc,
  imgsOf,
  loadImgs,
  removeImg,
  type StoredImage,
} from '../imageStore'
import type {
  AnnouncementItem,
  AuditLogEntry,
  CartLine,
  ConfirmDialogConfig,
  Conversation,
  ForumComment,
  ForumPost,
  ForumReport,
  ListingDraft,
  MessageRef,
  ModerationFlag,
  ModerationLogEntry,
  NotificationLink,
  OrderLine,
  OrderRecord,
  PrototypeAccount,
  PrototypeProduct,
  ReactionKey,
  ReviewRecord,
  TransactionRecord,
  UserListingRecord,
  BaoItemType,
  BaoLedgerEntry,
  BaoLedgerType,
  BaoReconRecord,
  BaoSettings,
  BaoState,
  BaoStatus,
  ChosenFulfillment,
  FulfillmentMethod,
} from '../types'

const DBK = 'rtu_db_v2'

interface DatabaseSnapshot {
  v: number
  accounts: PrototypeAccount[]
  userListings: UserListingRecord[]
  flags: ModerationFlag[]
  official: PrototypeProduct[]
  ann: AnnouncementItem[]
  feed: ForumPost[]
  conv: Conversation[]
  txn: TransactionRecord[]
  reviews: ReviewRecord[]
  freports: ForumReport[]
  modlog: ModerationLogEntry[]
  audit: AuditLogEntry[]
  bao: BaoState
  seq: {
    o: number
    l: number
    f: number
    fd: number
    cv: number
    tx: number
  }
  images?: Record<string, StoredImage>
}



function defaultDbState(): DatabaseSnapshot {
  // Clean slate: no sample data. Everything is created by users.
  return {
    v: 3,
    accounts: [],
    userListings: [],
    flags: [],
    official: [],
    ann: [],
    feed: [],
    conv: [],
    txn: [],
    reviews: [],
    freports: [],
    modlog: [],
    audit: [],
    bao: baoDefaultState(),
    seq: { o: 1, l: 1, f: 0, fd: 0, cv: 0, tx: 0 },
  }
}

function reviveJson(_k: string, v: unknown): unknown {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>
    if (Array.isArray(obj.$set)) return obj.$set
    if (typeof obj.$date === 'string') return obj.$date
  }
  return v
}

function pairKey(a?: string | null, b?: string | null): string {
  return [a || '@official', b || '@official'].sort().join('|')
}

function annId(a: AnnouncementItem): string {
  if (a.id) return a.id
  a.id = 'a' + hash((a.t || '') + (a.d || '') + (a.b || ''))
  return a.id
}


function syncBaoTypeMaps(bao: BaoState) {
  bao.types.forEach((t) => {
    OFFCAT[t.name] = t.category
    if (t.sub) OFFSUB[t.name] = t.sub
    OTYPE[t.name] = [t.tone || 't-drink', t.icon || 'tag']
  })
}

function runBaoMigration(snap: DatabaseSnapshot): DatabaseSnapshot {
  const bao = baoDefaultState(snap.bao)
  syncBaoTypeMaps(bao)

  // Stage 1: ensure every official ticket has BAO fields
  snap.txn.forEach((t) => {
    if (!baoIsOfficialTxn(t) || t.bst) return
    t.bst = BAO_FROM_LEGACY[t.status] || 'Request Received'
    t.src = t.src || 'Online'
    if (t.queue === undefined) t.queue = null
    if (t.pickup === undefined) t.pickup = ''
    if (t.note === undefined) t.note = ''
    if (!Array.isArray(t.bhist)) {
      t.bhist = (t.history || []).map((h, i, arr) => ({
        from: i ? BAO_FROM_LEGACY[arr[i - 1].status] || null : null,
        to: BAO_FROM_LEGACY[h.status] || t.bst || 'Request Received',
        by: h.by || 'System',
        byEmail: '',
        ts: h.ts,
        note: h.note || '',
        migrated: true,
      }))
    }
  })

  // Stage 2: ensure every official product has inv and opening stock ledger lines
  const openTxns = snap.txn
    .filter(baoIsOfficialTxn)
    .filter((t) => !['Claimed', 'Cancelled'].includes(baoStatusOf(t)))

  // Automatically promote any product in userListings owned by a moderator/staff account into snap.official
  const staffEmails = new Set(
    snap.accounts.filter((a) => a.role === 'moderator' || a.aff === 'Staff').map((a) => a.email),
  )
  const remainingUserListings: UserListingRecord[] = []
  snap.userListings.forEach((ul) => {
    const p = ul.product
    // Products from the catalogue API already carry the backend's answer in
    // `off`; promoting them by the owner's role would turn a staff member's
    // ordinary listing into an Official Store item.
    const fromApi = typeof p?.off === 'boolean'
    const shouldPromote =
      p && !isSvc(p) && (p.cat === 'Official' || (!fromApi && staffEmails.has(ul.ownerEmail)))
    if (shouldPromote) {
      if (!snap.official.some((o) => o.id === p.id)) {
        const matchedType = baoMatchItemTypeForListing(bao, {
          cat: p.category || p.cat,
          sub: p.sub,
          tag: p.tag,
          name: p.name,
        })
        const origCat = p.cat === 'Official' ? p.category || normCat(p) : p.cat
        const origSub = p.sub || subOf(p)
        p.cat = 'Official'
        p.category = origCat
        if (origSub) p.sub = origSub
        p.tag = origSub === 'Uniform' ? 'Uniform' : matchedType ? matchedType.name : p.tag
        p.seller = 'RTU Pasig Campus Store'
        p.hidden = Boolean(ul.paused || ul.state !== 'live')
        p.inv = {
          type: matchedType ? matchedType.id : 'ty-other',
          low: null,
          win: null,
          limit: 0,
          claimNote: '',
          ...(p.inv || {}),
          mig: 0,
        }
        snap.official.unshift(p)
      }
    } else {
      remainingUserListings.push(ul)
    }
  })
  snap.userListings = remainingUserListings

  snap.official.forEach((p) => {
    // Fix any item accidentally tagged as Sablay when it is actually a Uniform or other clothing item
    const matched = baoMatchItemTypeForListing(bao, {
      cat: p.category || p.cat,
      sub: p.sub,
      tag: p.tag,
      name: p.name,
    })
    if (
      p.inv &&
      p.inv.type === 'ty-sablay' &&
      !/sablay/i.test(p.name + ' ' + (p.sub || '')) &&
      matched &&
      matched.id !== 'ty-sablay'
    ) {
      p.inv.type = matched.id
      if (matched.name === 'Uniform' || p.sub === 'Uniform') {
        p.tag = 'Uniform'
        p.sub = 'Uniform'
      } else {
        p.tag = matched.name
      }
    }
    if (p.sub === 'Uniform' || p.tag === 'Uniform') {
      p.tag = 'Uniform'
      p.sub = 'Uniform'
      if (p.inv) p.inv.type = 'ty-uniform'
    }
    if (p.inv && p.inv.mig) return
    p.inv = {
      type: BAO_LEGACY_TYPE[p.tag] || 'ty-other',
      low: null,
      win: null,
      limit: 0,
      claimNote: '',
      ...(p.inv || {}),
      mig: 1,
    }
    baoUnits(p).forEach((u) => {
      const held = openTxns.reduce(
        (acc, t) =>
          acc +
          t.lines
            .filter((l) => l.pid === p.id && (l.vid || '') === u.vid)
            .reduce((b, l) => b + l.qty, 0),
        0,
      )
      const oh = u.available + held
      if (u.row) u.row.onHand = oh
      else p.onHand = oh
      if (oh > 0) {
        bao.seq.led += 1
        bao.ledger.push({
          id: 'L-' + String(bao.seq.led).padStart(5, '0'),
          ts: new Date().toISOString(),
          pid: p.id,
          item: p.name,
          vid: u.vid,
          label: u.label,
          type: 'Stock In',
          qty: oh,
          ohD: oh,
          rsD: 0,
          ticket: '',
          reason: 'Opening balance when the stock ledger started (from the older stock number)',
          by: 'System',
          byEmail: '',
          migrated: true,
          after: { onHand: oh, reserved: 0, available: oh },
        })
      }
      let run = 0
      openTxns.forEach((t) =>
        t.lines
          .filter((l) => l.pid === p.id && (l.vid || '') === u.vid)
          .forEach((l) => {
            run += l.qty
            bao.seq.led += 1
            bao.ledger.push({
              id: 'L-' + String(bao.seq.led).padStart(5, '0'),
              ts: new Date().toISOString(),
              pid: p.id,
              item: p.name,
              vid: u.vid,
              label: u.label,
              type: 'Reserved',
              qty: l.qty,
              ohD: 0,
              rsD: l.qty,
              ticket: t.id,
              reason: 'Open ticket when the stock ledger started',
              by: 'System',
              byEmail: '',
              migrated: true,
              after: { onHand: oh, reserved: run, available: oh - run },
            })
          }),
      )
    })
  })

  snap.bao = bao
  return snap
}

function normalizeLoadedDb(raw: string | null): DatabaseSnapshot {
  if (!raw) return defaultDbState()
  try {
    const parsed = JSON.parse(raw, reviveJson) as Partial<DatabaseSnapshot>
    if (!parsed || (parsed.v !== 2 && parsed.v !== 3)) return defaultDbState()
    const accounts = (parsed.accounts || []).map((a) =>
      mkAcct({
        ...a,
        email: String(a.email || '').trim().toLowerCase(),
        first: a.first || (a.name ? a.name.split(' ')[0] : 'Student'),
        last: a.last || (a.name ? a.name.split(' ').slice(1).join(' ') : ''),
        windows: cleanDays(a.windows),
        favs: Array.isArray(a.favs) ? a.favs : [],
        sfavs: Array.isArray(a.sfavs) ? a.sfavs : [],
        status: a.status || 'active',
        notifs: (a.notifs || []).map((n) => ({
          ...n,
          link: n.link === undefined ? null : n.link,
        })),
      }),
    )

    const userListings = (parsed.userListings || []).map((l) => {
      const p = l.product
      if (p) {
        if (!isSvc(p)) {
          p.cat = normCat(p)
          const sb = subOf(p)
          if (sb) p.sub = sb
          else delete p.sub
        }
        if (!p.imgs) p.imgs = []
        if (p.pub == null) p.pub = 0
        if (p.avail) p.avail = cleanDays(p.avail).join(', ')
      }
      return l
    })

    const official = (parsed.official || []).map((p) => {
      const c = normCat(p)
      p.category = c
      const sb = subOf(p)
      if (sb) p.sub = sb
      else delete p.sub
      if (!p.imgs) p.imgs = []
      if (p.pub == null) p.pub = 0
      return p
    })

    const ann = (parsed.ann || []).map((a) => {
      annId(a)
      return a
    })

    const feed = (parsed.feed || []).map((f) => ({
      ...f,
      reacts: f.reacts || {},
      comments: (f.comments || []).map((c) => ({ ...c, parent: c.parent || null })),
      imgs: Array.isArray(f.imgs) ? f.imgs : [],
    }))

    return runBaoMigration({
      v: 3,
      accounts,
      userListings,
      flags: parsed.flags || [],
      official,
      ann,
      feed,
      conv: parsed.conv || [],
      txn: parsed.txn || [],
      reviews: parsed.reviews || [],
      freports: parsed.freports || [],
      modlog: parsed.modlog || [],
      audit: parsed.audit || [],
      bao: baoDefaultState(parsed.bao),
      seq: {
        o: parsed.seq?.o || 1,
        l: parsed.seq?.l || 10,
        f: parsed.seq?.f || 0,
        fd: parsed.seq?.fd || feed.length,
        cv: parsed.seq?.cv || (parsed.conv || []).length,
        tx: parsed.seq?.tx || (parsed.txn || []).length,
      },
    })
  } catch {
    return defaultDbState()
  }
}

export interface BrowseFilterState {
  q: string
  cats: string[]
  sub: string
  tag: string
  sellerType: string[]
  maxPrice: string
  onlyToday: boolean
  mapFree: boolean
  sortBy: string
  rateBasis: 'item' | 'seller'
  page: number
}

export type ActiveModal =
  | null
  | { kind: 'guidelines' }
  | { kind: 'policy' }
  | { kind: 'rules' }
  | { kind: 'modguide' }
  | { kind: 'gate'; route: string; why?: string; after?: string }
  | { kind: 'seller-profile'; sellerName: string }
  | { kind: 'edit-profile' }
  | { kind: 'verif-status' }
  | { kind: 'archive' }
  | { kind: 'announcement'; title: string }
  | { kind: 'export-record' }
  | { kind: 'manage-listings' }
  | { kind: 'txn-view'; txnId: string }
  | { kind: 'forum-photo'; postId: string; index: number }
  | { kind: 'forum-edit-post'; postId: string }
  | { kind: 'forum-report'; postId: string; commentId: string | null }
  | { kind: 'order-report'; orderId: string; role: 'buyer' | 'seller'; targetEmail: string | null; targetName: string; itemTitle: string }
  | { kind: 'forum-mod-action'; reportId: string }
  | { kind: 'review-delete'; reviewId: string }
  | { kind: 'admin-user'; email: string }
  | { kind: 'admin-remove-listing'; lid: string }
  | { kind: 'reset-all' }
  | { kind: 'section-tips'; section: 'books' | 'merch' }
  | { kind: 'bao-ticket'; txnId: string }
  | { kind: 'bao-move'; pid: string; vid: string; type: 'Stock In' | 'Adjustment' | 'Sold' }
  | { kind: 'bao-item'; pid: string }
  | { kind: 'bao-email-prev'; emailId: string }

interface TindahanContextValue {
  db: DatabaseSnapshot
  currentAccount: PrototypeAccount | null
  isStaffUser: boolean
  /** Only an administrator may download the database backup. */
  isAdminUser: boolean
  /**
   * Listing approval belongs to moderators and administrators, per the role
   * split in the SRS. Office Staff run the Official Store instead, so they see
   * the store screens but not the moderation queue.
   */
  canModerate: boolean
  storageOk: boolean
  storageKb: number
  listingsLoading: boolean
  /** Listings waiting for a moderator, straight from the server. */
  pendingListings: ApiListing[]
  /** The signed-in member's own listings, any moderation state. */
  myListings: ApiListing[]
  refreshMyListings: () => Promise<void>
  /** Server-side requests: what I bought and what I sold. */
  apiOrders: ApiOrder[]
  refreshOrders: () => Promise<void>
  setOrderPaymentMethod: (reference: string, method: 'cash' | 'p2p') => Promise<void>
  /** Open the server thread with another member and hop to Messages. */
  openThreadWith: (input: {
    sellerEmail?: string
    buyerEmail?: string
    listingSlug?: string | null
  }) => Promise<boolean>
  /** Seller side: accept, decline or complete. Buyer side: cancel. */
  actOnOrder: (
    reference: string,
    status: 'accepted' | 'declined' | 'completed' | 'cancelled',
  ) => Promise<boolean>
  /** Approve or reject a listing in Django, then refresh the queue and catalogue. */
  moderateListing: (slug: string, decision: 'approve' | 'reject', reason?: string) => Promise<boolean>
  hasSettledInitialFetch: boolean
  toastMsg: string | null
  toast: (msg: string) => void
  activeModal: ActiveModal
  openModal: (m: ActiveModal) => void
  closeModal: () => void
  confirmDialog: ConfirmDialogConfig | null
  confirmDlg: (cfg: Omit<ConfirmDialogConfig, 'id'>) => void
  closeConfirmDlg: () => void

  // Computed catalogue
  allOnSale: PrototypeProduct[]
  allProducts: PrototypeProduct[]
  allServices: PrototypeProduct[]
  byId: (id?: string | null) => PrototypeProduct | undefined
  sellerKind: (p?: PrototypeProduct | null) => 'student' | 'school'
  sellerKeyOf: (p?: PrototypeProduct | null) => string
  sellerKeyByName: (name: string) => string
  sellerNameOf: (key: string) => string
  acctByEmail: (email?: string | null) => PrototypeAccount | undefined

  // Ratings & sales
  ratingOf: (kind: 'item' | 'seller', key: string) => { avg: number; n: number }
  salesIndex: Map<string, { units: number; orders: number }>
  sortProducts: (list: PrototypeProduct[], mode: string, rateBasis?: 'item' | 'seller') => PrototypeProduct[]
  orderRateable: (o: OrderRecord) => boolean
  reviewOf: (kind: 'seller' | 'item', orderId: string, pid?: string) => ReviewRecord | undefined
  submitReview: (kind: 'seller' | 'item', orderId: string, pid: string, stars: number, text: string) => boolean
  confirmDeleteReview: (reviewId: string) => void

  // Browse & selection state
  browseState: BrowseFilterState
  setBrowseState: React.Dispatch<React.SetStateAction<BrowseFilterState>>
  browseFor: (opts: Partial<BrowseFilterState> & { goBrowse?: boolean }) => void
  clearBrowseFilters: () => void

  selectedProductId: string | null
  setSelectedProductId: (id: string | null) => void
  openProduct: (id: string) => void

  selectedPostId: string | null
  highlightedCommentId: string | null
  openPost: (postId: string, commentId?: string | null) => void

  // Favorites
  toggleFav: (productId: string) => void
  toggleSellerFav: (sellerKey: string) => void

  // Cart & Orders
  cartCount: number
  cartTotal: number
  cartStep: 1 | 2 | 3
  setCartStep: (s: 1 | 2 | 3) => void
  cartMsg: string
  cartPayment: 'cash' | 'p2p'
  setCartPayment: (method: 'cash' | 'p2p') => void
  setCartMsg: (s: string) => void
  cartAgree: boolean
  setCartAgree: (b: boolean) => void
  cartErr: string
  setCartErr: (s: string) => void
  selectedCartItems: Set<number>
  toggleCartSelect: (idx: number) => void
  toggleCartSelectAll: () => void
  addToCart: (id: string, qty: number, vid?: string, fulfillment?: ChosenFulfillment) => boolean
  reserveNow: (id: string, qty: number, vid?: string, fulfillment?: ChosenFulfillment) => void
  updateCartQty: (idx: number, delta: number) => void
  removeCartLine: (idx: number) => void
  toggleCartEdit: (idx: number) => void
  updateCartMeetup: (idx: number, field: 'place' | 'time' | 'date' | 'fulfillment' | 'deliverySpot', value: string) => void
  sendMeetupRequest: () => void

  lastOrderId: string | null
  lastOrderIds: string[]
  selectedOrderId: string | null
  setSelectedOrderId: (id: string | null) => void
  orderTab: 'Requesting' | 'For Pickup' | 'Completed' | 'Cancelled'
  setOrderTab: (t: 'Requesting' | 'For Pickup' | 'Completed' | 'Cancelled') => void
  proposeOrderMeetup: (orderId: string, place: string, time: string) => void
  confirmOrderPickup: (orderId: string, proofImgId?: string | null) => void
  cancelOrderRequest: (orderId: string) => void
  cancelMultipleOrders: (orderIds: string[]) => void

  // Seller / My Shop & Create Listing
  shopTab: 'overview' | 'orders' | 'listings' | 'reviews'
  setShopTab: (t: 'overview' | 'orders' | 'listings' | 'reviews') => void
  draft: ListingDraft
  setDraft: React.Dispatch<React.SetStateAction<ListingDraft>>
  listStep: 1 | 2 | 3
  setListStep: (s: 1 | 2 | 3) => void
  draftErrs: Record<string, string>
  setDraftErrs: React.Dispatch<React.SetStateAction<Record<string, string>>>
  startEditListing: (lid: string) => void
  cancelEditListing: () => void
  saveListingDraftToAccount: () => void
  validateCurrentListingForSubmit: () => boolean
  submitListingStepOrPublish: () => void
  toggleSellerListingPause: (idx: number) => void
  deleteSellerListing: (idx: number) => void
  respondSellerRequest: (reqId: string, action: 'accept' | 'decline' | 'done' | 'undo', proofImgId?: string | null) => void
  toggleChecklist: (key: 'profile' | 'pickup' | 'rules', checked?: boolean) => void
  continueSellerSetup: () => void

  // Profile & Notifications
  toggleSellingWindow: (day: string) => void
  saveProfile: (
    name: string,
    prog: string,
    newAvatarId: string | null,
    removeAvatar: boolean,
    yearLevel?: number | null,
    contactNumber?: string,
    profilePhotoFile?: File | null,
  ) => Promise<boolean>
  markAllNotifsRead: () => void
  openNotification: (index: number) => void

  // Messages
  selectedConvId: string | null
  setSelectedConvId: (id: string | null) => void
  myConversations: Conversation[]
  unreadMessagesCount: number
  unreadInConv: (c: Conversation) => number
  startProductConversation: (productId: string, text: string) => boolean
  sendOrderMessage: (orderId: string, text: string, navigateToMessages?: boolean) => boolean
  openSellerRequestChat: (reqId: string) => void
  sendChatMessage: (convId: string, text: string) => boolean
  reactToChatMessage: (convId: string, msgIdx: number, emoji: string) => void
  markConvRead: (convId: string) => void
  openContextOrder: (orderId: string, convId: string) => void

  // Forum
  createForumPost: (
    title: string,
    body: string,
    topic: string,
    asNotice: boolean,
    imgs: string[],
    schedule?: { date: string; start: string; end?: string; place: string },
  ) => boolean
  editForumPost: (postId: string, title: string, body: string) => boolean
  deleteForumPost: (postId: string) => void
  toggleForumReaction: (postId: string, react: ReactionKey) => void
  togglePinPost: (postId: string) => void
  toggleHidePost: (postId: string) => void
  addForumComment: (postId: string, parentId: string | null, text: string) => boolean
  editForumComment: (postId: string, commentId: string, text: string) => boolean
  deleteForumComment: (postId: string, commentId: string) => void
  toggleHideComment: (postId: string, commentId: string) => void
  submitForumReport: (postId: string, commentId: string | null, reason: string, details: string) => boolean
  submitOrderReport: (orderId: string, role: 'buyer' | 'seller', targetEmail: string | null, targetName: string, itemTitle: string, reason: string, details: string) => boolean
  setForumReportStatus: (reportId: string, st: 'open' | 'reviewed' | 'dismissed') => void
  applyForumModerationAction: (reportId: string, act: 'hide' | 'restore' | 'delete' | 'warn', note: string) => boolean

  // Admin / Staff
  selectedFlagId: string | null
  setSelectedFlagId: (id: string | null) => void
  modTab: 'open' | 'done'
  setModTab: (t: 'open' | 'done') => void
  decideFlag: (decision: 'approved' | 'removed', note: string) => void
  reopenFlag: () => void
  adminSetUserStatus: (email: string, to: 'active' | 'suspended' | 'banned', reason: string) => boolean
  adminRemoveListing: (lid: string, reason: string) => boolean
  adminRestoreListing: (lid: string) => boolean
  adminPauseListing: (lid: string, reason: string) => boolean
  adminResumeListing: (lid: string) => boolean
  adminActTransaction: (txnId: string, to: 'Confirmed' | 'Completed' | 'Cancelled') => void
  exportTransactionsCsv: (rows: TransactionRecord[]) => void
  saveOfficialProduct: (input: { id: string | null; name: string; tag: string; price: number; stock: number; desc: string }) => boolean
  toggleHideOfficialProduct: (id: string) => void
  deleteOfficialProduct: (id: string) => void
  postStaffAnnouncement: (title: string, body: string) => boolean
  deleteStaffAnnouncement: (idx: number) => void
  exportDatabaseBackup: () => void
  resetEverything: () => void
  imgVersion: number
  bumpImgVersion: () => void

  // BAO v1.6 Official RTU Store Management
  baoTab: 'list' | 'overview' | 'f2f' | 'sheet' | 'email' | 'settings'
  setBaoTab: (t: 'list' | 'overview' | 'f2f' | 'sheet' | 'email' | 'settings') => void
  baoSearch: string
  setBaoSearch: (q: string) => void
  baoStatusFilter: string
  setBaoStatusFilter: (s: string) => void
  invTab: 'items' | 'ledger' | 'types' | 'rules' | 'recon'
  setInvTab: (t: 'items' | 'ledger' | 'types' | 'rules' | 'recon') => void
  baoOrderProblem: (
    p: PrototypeProduct | undefined | null,
    addQty?: number,
    who?: { email?: string | null; sid?: string | null; cart?: boolean },
  ) => string
  baoTransitionTicket: (
    txnId: string,
    to: BaoStatus,
    opt?: { note?: string; pickup?: string; byStudent?: boolean },
  ) => { ok: boolean; msg?: string }
  baoSaveOrderSettings: (nextSettings: Partial<BaoSettings>) => void
  baoApplyStockMove: (
    items: Array<{
      pid: string
      vid?: string
      type: BaoLedgerType
      qty: number
      reason?: string
      ticket?: string
    }>,
  ) => { ok: boolean; msg?: string }
  baoSaveItemSettings: (
    pid: string,
    input: {
      typeId: string
      low: number | null
      limit: number
      claimNote: string
      win: { enabled: boolean; start: string; end: string; message: string }
      varAttrName?: string
      rowLows?: Record<string, number | null>
    },
  ) => boolean
  baoStartItemSizes: (pid: string, firstLabel: string) => boolean
  baoAddItemSizeRow: (pid: string, label: string, openingQty: number) => boolean
  baoRemoveItemSizeRow: (pid: string, rowId: string) => boolean
  baoSaveItemTypes: (nextTypes: BaoItemType[]) => boolean
  baoSaveStoreWindowAndLimit: (
    win: { enabled: boolean; start: string; end: string; message: string },
    limitPerStudent: number,
  ) => boolean
  baoCreateFaceToFaceOrder: (input: {
    name: string
    sid: string
    email: string
    date: string
    notes: string
    lines: Array<{ pid: string; vid: string; qty: number }>
  }) => Promise<{ ok: boolean; msg?: string; txnId?: string; queue?: string | null }>
  baoSaveDailyReconciliation: (
    counts: Record<string, string>,
    reasons: Record<string, string>,
  ) => { ok: boolean; msg?: string; recId?: string }
  baoSaveEmailSettings: (
    events: Record<string, boolean>,
    lowStock: boolean,
    lowStockToText: string,
  ) => boolean
  baoExportPreparedEmailsJson: () => void
}

const TindahanContext = createContext<TindahanContextValue | null>(null)

export function TindahanProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const canModerate = user?.role === 'moderator' || user?.role === 'administrator'
  const { blocked: storeBlocked } = useProfileSettings(user?.email || '')
  const [db, setDb] = useState<DatabaseSnapshot>(() => {
    loadImgs()
    try {
      return normalizeLoadedDb(localStorage.getItem(DBK))
    } catch {
      return defaultDbState()
    }
  })
  const [storageOk, setStorageOk] = useState<boolean>(() => {
    try {
      localStorage.setItem('__t', '1')
      localStorage.removeItem('__t')
      return true
    } catch {
      return false
    }
  })
  const [imgVersion, setImgVersion] = useState(0)
  const bumpImgVersion = useCallback(() => setImgVersion((v) => v + 1), [])
  const [listingsLoading, setListingsLoading] = useState<boolean>(true)
  const [hasSettledInitialFetch, setHasSettledInitialFetch] = useState<boolean>(false)
  // Guards against a double click posting the same new listing twice.
  const publishingRef = useRef(false)

  /** Re-read the published catalogue and fold it into the snapshot. */
  const refreshListings = useCallback(async () => {
    try {
      const listings = await fetchListings()
      if (listings.length === 0) return
      setDb((prev) => mergeApiCatalogue(prev, listings))
    } catch {
      /* backend offline: keep the snapshot that is already on screen */
    }
  }, [])

  // The seller's own rows, including the ones still waiting for approval. The
  // public feed never carries those, so they are fetched separately.
  const [myListings, setMyListings] = useState<ApiListing[]>([])
  const refreshMyListings = useCallback(async () => {
    try {
      setMyListings(await fetchMyListings())
    } catch {
      /* backend offline: leave whatever was loaded */
    }
  }, [])

  // Student-to-student requests live on the server too, so the seller really
  // receives them. Both roles are fetched: one call returns what I bought and
  // what I sold.
  const [apiOrders, setApiOrders] = useState<ApiOrder[]>([])
  // OT-06: either party records how the money will move; the server notifies
  // the other one and refuses a closed order.
  const setOrderPaymentMethod = useCallback(
    async (reference: string, method: 'cash' | 'p2p') => {
      try {
        await setOrderPaymentApi(reference, method)
        await refreshOrders()
        toast(
          method === 'cash'
            ? 'Payment set to cash at the meet-up.'
            : 'Payment set to a transfer between you.',
        )
      } catch (err) {
        toast(err instanceof ApiRequestError ? err.message : 'That choice could not be saved.')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const refreshOrders = useCallback(async () => {
    if (!getToken()) {
      setApiOrders([])
      return
    }
    try {
      const list = await fetchApiOrders()
      setApiOrders(list)
      // Keep the buyer's local order record in step with the seller's answer,
      // so one screen cannot say "Awaiting seller" while the other says
      // "Accepted".
      const email = user?.email
      if (email) {
        setDb((prev) => {
          const me = prev.accounts.find((a) => a.email === email)
          if (!me) return prev
          let changed = false
          let orders = me.orders.map((order) => {
            const remote = list.find((row) => row.reference === order.id)
            if (!remote) return order
            const { status, tab } = orderStatusFromApi(remote)
            // Local checkout lines carry the UI id only. Copy the backend
            // listing id across so a sold-out item can still be rated from the
            // completed order.
            const mapped = orderRecordFromApi(remote)
            const lines = (order.lines || []).map((line) => {
              if (line.apiListingId) return line
              const match = mapped.lines.find((m) => m.pid === line.pid)
              return match?.apiListingId ? { ...line, apiListingId: match.apiListingId } : line
            })
            const linesChanged = lines.some((line, i) => line !== (order.lines || [])[i])
            if (order.status === status && order.tab === tab && !linesChanged) return order
            changed = true
            return { ...order, status, tab, lines }
          })
          // Orders the server knows about but this browser never created (a
          // request sent from another device, or one that predates the local
          // snapshot) still belong in My Orders; without this the "sent"
          // summary shows an order that the tabs below it count as zero.
          const known = new Set(orders.map((order) => order.id))
          const additions = list
            .filter((row) => row.buyer_email === email && !known.has(row.reference))
            .map((row) => orderRecordFromApi(row))
          if (additions.length) {
            orders = [...additions, ...orders]
            changed = true
          }
          if (!changed) return prev
          return {
            ...prev,
            accounts: prev.accounts.map((a) =>
              a.email === email ? { ...a, orders } : a,
            ),
          }
        })
      }
    } catch {
      /* backend offline: keep what was loaded */
    }
  }, [user])

  // Threads with other members live on the server, so a reply actually crosses.
  const refreshConversations = useCallback(async () => {
    if (!getToken()) return
    try {
      const list = await fetchConversations()
      setDb((prev) => mergeApiConversations(prev, list, user?.email))
    } catch {
      /* backend offline: keep the local threads */
    }
  }, [user])

  // Saved products and sellers belong to the member, not to this browser. The
  // server is the truth for anything it can hold; prototype-only ids and the
  // "official" bucket have no user behind them, so they stay local.
  const refreshFavorites = useCallback(async () => {
    if (!getToken() || !user?.email) return
    const email = user.email
    try {
      const { favs, sfavs } = favoriteKeys(await fetchFavorites())
      setDb((prev) => {
        const me = prev.accounts.find((a) => a.email === email)
        if (!me) return prev
        const localFavs = me.favs.filter((id) => !id.startsWith(API_ID_PREFIX))
        const localSfavs = me.sfavs.filter((key) => key === 'official')
        const merged = {
          ...me,
          favs: [...new Set([...favs, ...localFavs])],
          sfavs: [...new Set([...sfavs, ...localSfavs])],
        }
        return {
          ...prev,
          accounts: prev.accounts.map((a) => (a.email === email ? merged : a)),
        }
      })
    } catch {
      /* backend offline: keep the local hearts */
    }
  }, [user])

  // A rating is only written after a completed order, so the server is the
  // truth once it has the row. Server rows replace local rows with the same
  // key; prototype-only reviews stay.
  const refreshReviews = useCallback(async () => {
    try {
      const rows = await fetchReviews()
      const mine = user?.email ?? ''
      const mapped = rows.map((row) => reviewRecordFromApi(row, mine))
      const keys = new Set(mapped.map((r) => r.key))
      setDb((prev) => ({
        ...prev,
        reviews: [...mapped, ...prev.reviews.filter((r) => !keys.has(r.key))],
      }))
    } catch {
      /* backend offline: keep the local reviews */
    }
  }, [user])

  // Forum posts and reports live on the server so another member's post, a
  // comment, or a moderation decision actually reaches everyone. Server rows
  // replace the previous server rows; prototype-only posts stay.
  const refreshForum = useCallback(async () => {
    try {
      const [posts, reports] = await Promise.all([
        fetchForumPosts(),
        getToken() ? fetchForumReports() : Promise.resolve([] as ApiForumReport[]),
      ])
      const mine = user?.email ?? ''
      const mappedPosts = posts.map((p) => forumPostFromApi(p, mine))
      const mappedReports = reports.map((r) => forumReportFromApi(r, mine))
      setDb((prev) => ({
        ...prev,
        feed: [
          ...mappedPosts,
          ...prev.feed.filter((p) => !p.id.startsWith(FORUM_PREFIX)),
        ],
        freports: [
          ...mappedReports,
          ...prev.freports.filter((r) => !r.id.startsWith(FORUM_PREFIX)),
        ],
      }))
    } catch {
      /* backend offline: keep the local feed */
    }
  }, [user])

  // Announcements are notice posts, so the panel and the forum's Notices tab
  // read the same server rows. The local list is replaced: it was per browser.
  const refreshAnnouncements = useCallback(async () => {
    try {
      const rows = await fetchNotices()
      const mapped = rows.map(announcementFromApi)
      setDb((prev) => ({ ...prev, ann: mapped }))
    } catch {
      /* backend offline: keep what is on screen */
    }
  }, [])

  // The inbox is the server's: every event that used to write a local
  // notification now emits a row both sides can see. The provider replaces the
  // local list with it so a badge cannot count events the server never had.
  const refreshNotifications = useCallback(async () => {
    if (!getToken() || !user?.email) return
    const email = user.email
    try {
      const list = await fetchNotifications()
      const mapped = list.slice(0, 40).map(notificationFromApi)
      setDb((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.email === email ? { ...a, notifs: mapped } : a,
        ),
      }))
    } catch {
      /* backend offline: keep what is on screen */
    }
  }, [user])

  // Staff only: the users table and the audit log. The server wins on role,
  // status and join date; the local record keeps its cart, orders and
  // notifications. Accounts this browser has never seen are added.
  const refreshAdminData = useCallback(async () => {
    const role = user?.role
    if (!getToken() || (role !== 'moderator' && role !== 'administrator')) return
    try {
      const [users, entries] = await Promise.all([fetchAdminUsers(), fetchAuditLog()])
      setDb((prev) => {
        const byEmail = new Map(users.map((u) => [u.email, u]))
        const accounts = prev.accounts.map((account) => {
          const row = byEmail.get(account.email)
          if (!row) return account
          const fresh = accountFromAdminUser(row)
          return {
            ...account,
            role: fresh.role,
            status: fresh.status,
            statusNote: fresh.statusNote,
            statusBy: fresh.statusBy,
            statusAt: fresh.statusAt,
            verified: fresh.verified,
            since: fresh.since,
            name: fresh.name,
            first: fresh.first,
            last: fresh.last,
            sid: fresh.sid,
            prog: row.college_name || account.prog,
            apiUserId: fresh.apiUserId,
            adminListingCount: fresh.adminListingCount,
            adminOrderCount: fresh.adminOrderCount,
            adminPostCount: fresh.adminPostCount,
          }
        })
        const known = new Set(prev.accounts.map((a) => a.email))
        for (const row of users) {
          if (!known.has(row.email)) accounts.push(accountFromAdminUser(row))
        }
        const mappedAudit = entries.map(auditEntryFromApi)
        const localAudit = prev.audit.filter((e) => !e.id.startsWith('api:'))
        const audit = [...localAudit, ...mappedAudit].sort(
          (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
        )
        return { ...prev, accounts, audit }
      })
    } catch {
      /* backend offline: keep the local accounts and log */
    }
  }, [user])

  // The moderation queue lives on the server; the mount effect fills it.
  const [pendingListings, setPendingListings] = useState<ApiListing[]>([])
  const refreshPendingListings = useCallback(async () => {
    try {
      // AI-11: the queue holds the untouched rows *and* the ones the screening
      // rejected and nobody has confirmed or reversed yet.
      const [waiting, rejected] = await Promise.all([
        apiFetch<ApiPage<ApiListing>>('/listings/?status=pending_screening,needs_review'),
        apiFetch<ApiPage<ApiListing>>('/listings/?status=rejected&awaiting=ai'),
      ])
      setPendingListings([...(waiting.results ?? []), ...(rejected.results ?? [])])
    } catch {
      /* backend offline: leave the queue as it was */
    }
  }, [])

  // -----------------------------------------------------------------------
  // Load the published catalogue from Django once per page load.
  //
  // The result is merged into the same snapshot the pages already read, so no
  // page component changed. Entries are tagged with an `api:` id prefix, which
  // lets the merge replace only backend data and leave anything created in the
  // prototype alone. If the server is unreachable, the local snapshot stands.
  // -----------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        // Concurrent, not one after another. Over the tunnel each round trip
        // costs a few hundred milliseconds, and five in a row was most of the
        // time the app spent before it could show anything.
        await Promise.allSettled([
          refreshListings(),
          refreshPendingListings(),
          refreshMyListings(),
          refreshOrders(),
          refreshConversations(),
          refreshFavorites(),
          refreshReviews(),
          refreshForum(),
          refreshAnnouncements(),
          refreshNotifications(),
          refreshAdminData(),
        ])
      } finally {
        if (!cancelled) {
          setListingsLoading(false)
          setHasSettledInitialFetch(true)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  },
    [
      refreshListings,
      refreshPendingListings,
      refreshMyListings,
      refreshOrders,
      setOrderPaymentMethod,
      refreshConversations,
      refreshFavorites,
      refreshReviews,
      refreshForum,
      refreshAnnouncements,
      refreshNotifications,
      refreshAdminData,
    ],
  )

  // The Official Store's tickets and stock ledger live on the server too, but
  // only staff accounts may read them. The merge replaces the prototype's demo
  // tickets and ledger with the real rows; if the backend is unreachable the
  // snapshot is left as it was.
  const storeStaff = Boolean(
    user &&
      (user.role === 'moderator' ||
        user.role === 'administrator' ||
        user.role === 'office_staff'),
  )
  const refreshStore = useCallback(async () => {
    if (!storeStaff) return
    try {
      const [tickets, stock, settings] = await Promise.all([
        fetchTickets(),
        fetchStock(),
        fetchStoreSettings(),
      ])
      setDb((prev) =>
        mergeApiStore(prev, {
          tickets,
          stock,
          settings,
          products: [...prev.official, ...prev.userListings.map((l) => l.product)],
        }),
      )
    } catch {
      /* backend offline or not staff: keep the local snapshot */
    }
  }, [storeStaff])

  useEffect(() => {
    void refreshStore()
  }, [refreshStore])

  // A student may read their own tickets but not the stock ledger. Without
  // this, a staff confirmation never reached the buyer's My orders without a
  // reload.
  const refreshMyTickets = useCallback(async () => {
    if (!user || storeStaff) return
    try {
      const tickets = await fetchTickets()
      setDb((prev) =>
        mergeApiTickets(prev, {
          tickets,
          products: [...prev.official, ...prev.userListings.map((l) => l.product)],
        }),
      )
    } catch {
      /* backend offline: keep the snapshot */
    }
  }, [storeStaff, user])

  useEffect(() => {
    void refreshMyTickets()
  }, [refreshMyTickets])

  // Keep the shared lists fresh: a reply, a new post, a newly approved listing
  // or a status change should land on its own, not only after a reload.
  //
  // Two tiers, because they cost different things. Chat feels live at 10s. The
  // forum and the catalogue are watched, not chatted in, so 20-30s is enough.
  // The public lists poll for visitors too; the account-only ones need a token.
  useEffect(() => {
    const signedIn = Boolean(getToken())
    // Declared here rather than using isStaffUser: that memo is defined below
    // this effect, and a moderator or administrator always has the role.
    const staff = Boolean(
      user &&
        (user.role === 'moderator' ||
          user.role === 'administrator' ||
          user.role === 'office_staff'),
    )
    const timers: number[] = []

    if (signedIn) {
      timers.push(window.setInterval(() => void refreshConversations(), 10000))
      timers.push(window.setInterval(() => void refreshOrders(), 30000))
      timers.push(window.setInterval(() => void refreshNotifications(), 20000))
    }

    // A post written on another account, or a listing a moderator just
    // approved, has to appear without a reload. Both endpoints are public.
    const forum = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void refreshForum()
      void refreshAnnouncements()
    }, 20000)
    const catalogue = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void refreshListings()
      if (!signedIn) return
      void refreshMyListings()
      if (staff) void refreshPendingListings()
    }, 30000)
    timers.push(forum, catalogue)

    // Store tickets: a buyer's own at 30 s, the staff queue and ledger at 60 s
    // (the ledger is the heavier read and only staff may ask for it).
    const myTickets = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || !signedIn || staff) return
      void refreshMyTickets()
    }, 30000)
    timers.push(myTickets)
    if (staff) {
      timers.push(
        window.setInterval(() => {
          if (document.visibilityState !== 'visible') return
          void refreshStore()
        }, 60000),
      )
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void refreshForum()
      void refreshAnnouncements()
      void refreshListings()
      if (!signedIn) return
      void refreshConversations()
      void refreshOrders()
      void refreshNotifications()
      void refreshMyListings()
      void refreshMyTickets()
      if (staff) {
        void refreshPendingListings()
        void refreshStore()
      }
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      timers.forEach((timer) => window.clearInterval(timer))
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [
    refreshAnnouncements,
    refreshConversations,
    refreshForum,
    refreshListings,
    refreshMyListings,
    refreshNotifications,
    refreshOrders,
    refreshPendingListings,
    refreshMyTickets,
    refreshStore,
    user,
  ])

  // UI overlays
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const toast = useCallback((msg: string) => {
    playNotice()
    setToastMsg(msg)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 2600)
  }, [])

  const [activeModal, setActiveModal] = useState<ActiveModal>(null)

  // Clear gate modal when user signs in so it never lingers after authentication.
  useEffect(() => {
    if (user && activeModal?.kind === 'gate') {
      setActiveModal(null)
    }
  }, [user, activeModal])
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null)

  // -----------------------------------------------------------------------
  // Moderation decisions, straight from the catalogue API.
  //
  // The queue used to be prototype flags with no backend behind them. This
  // power the staff decision buttons that actually change a listing in Django.
  // -----------------------------------------------------------------------
  /** Approve or reject a listing on the server, then refresh both lists. */
  const moderateListing = useCallback(
    async (slug: string, decision: 'approve' | 'reject', reason = '') => {
      try {
        await apiFetch<ApiListing>(`/listings/${encodeURIComponent(slug)}/${decision}/`, {
          method: 'POST',
          body: decision === 'reject' ? { reason } : {},
        })
        await Promise.all([refreshPendingListings(), refreshListings()])
        toast(
          decision === 'approve'
            ? 'Listing approved and published.'
            : 'Listing rejected. The seller can fix it and submit again.',
        )
        return true
      } catch (err) {
        toast(err instanceof ApiRequestError ? err.message : 'That decision could not be saved.')
        return false
      }
    },
    [refreshListings, refreshPendingListings, toast],
  )

  const openModal = useCallback((m: ActiveModal) => setActiveModal(m), [])
  const closeModal = useCallback(() => setActiveModal(null), [])
  const confirmDlg = useCallback((cfg: Omit<ConfirmDialogConfig, 'id'>) => {
    setConfirmDialog({ ...cfg, id: 'c' + uid() })
  }, [])
  const closeConfirmDlg = useCallback(() => setConfirmDialog(null), [])

  // Browse / navigation state
  const [browseState, setBrowseState] = useState<BrowseFilterState>({
    q: '',
    cats: [],
    sub: '',
    tag: '',
    sellerType: [],
    maxPrice: '',
    onlyToday: false,
    mapFree: false,
    sortBy: 'Recommended',
    rateBasis: 'item',
    page: 1,
  })
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null)

  // Cart UI state
  const [cartStep, setCartStep] = useState<1 | 2 | 3>(1)
  // OT-06: cash at the meet-up, or a transfer between the two students. The
  // platform records the choice and never touches the money.
  const [cartPayment, setCartPayment] = useState<'cash' | 'p2p'>('cash')
  const [cartMsg, setCartMsg] = useState(
    'Hi! I will be at the pickup spot a few minutes early. Please confirm your preferred payment method after accepting.',
  )
  const [cartAgree, setCartAgree] = useState(false)
  const [cartErr, setCartErr] = useState('')
  const [selectedCartItems, setSelectedCartItems] = useState<Set<number>>(new Set())
  const [lastOrderId, setLastOrderId] = useState<string | null>(null)
  const [lastOrderIds, setLastOrderIds] = useState<string[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [orderTab, setOrderTab] = useState<'Requesting' | 'For Pickup' | 'Completed' | 'Cancelled'>('Requesting')

  // Seller / Create Listing UI state
  const [shopTab, setShopTab] = useState<'overview' | 'orders' | 'listings' | 'reviews'>('overview')
  const [draft, setDraft] = useState<ListingDraft>(blankDraft)
  const [listStep, setListStep] = useState<1 | 2 | 3>(1)
  const [draftErrs, setDraftErrs] = useState<Record<string, string>>({})

  // Messages & Admin UI state
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null)
  const [modTab, setModTab] = useState<'open' | 'done'>('open')

  // BAO v1.6 UI state
  const [baoTab, setBaoTab] = useState<'list' | 'overview' | 'f2f' | 'sheet' | 'email' | 'settings'>('list')
  const [baoSearch, setBaoSearch] = useState('')
  const [baoStatusFilter, setBaoStatusFilter] = useState('')
  const [invTab, setInvTab] = useState<'items' | 'ledger' | 'types' | 'rules' | 'recon'>('items')

  // Save to localStorage on db changes
  const lastSavedRef = useRef<string>('')
  useEffect(() => {
    const raw = JSON.stringify(db)
    if (raw === lastSavedRef.current) return
    lastSavedRef.current = raw
    try {
      localStorage.setItem(DBK, raw)
    } catch {
      setStorageOk(false)
    }
  }, [db])

  // Cross-tab storage sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === IMGK) {
        loadImgs()
        bumpImgVersion()
        return
      }
      if (e.key === DBK && e.newValue && e.newValue !== lastSavedRef.current) {
        lastSavedRef.current = e.newValue
        setDb(normalizeLoadedDb(e.newValue))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [bumpImgVersion])

  // Sync authenticated `user` from AuthContext into `db.accounts`
  useEffect(() => {
    if (!user) return
    const email = user.email.trim().toLowerCase()
    const isStaffRole =
      user.role === 'moderator' || user.role === 'administrator' || user.role === 'office_staff'

    setDb((prev) => {
      const existing = prev.accounts.find((a) => a.email === email)
      if (existing) {
        if (isStaffRole) {
          const needsRoleSync = existing.role !== 'moderator'
          const hasUnmigratedStaffListings = prev.userListings.some(
            (ul) => ul.ownerEmail === email && ul.product && !isSvc(ul.product),
          )
          if (needsRoleSync || hasUnmigratedStaffListings) {
            const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
            const me = next.accounts.find((a) => a.email === email)
            if (me) {
              me.role = 'moderator'
              me.aff = 'Staff'
            }
            const kept: UserListingRecord[] = []
            next.userListings.forEach((ul) => {
              const p = ul.product
              if (ul.ownerEmail === email && p && !isSvc(p)) {
                if (!next.official.some((o) => o.id === p.id)) {
                  const matchedType = baoMatchItemTypeForListing(next.bao, {
                    cat: p.category || p.cat,
                    sub: p.sub,
                    tag: p.tag,
                    name: p.name,
                  })
                  const origCat = p.cat === 'Official' ? p.category || normCat(p) : p.cat
                  const origSub = p.sub || subOf(p)
                  p.cat = 'Official'
                  p.category = origCat
                  if (origSub) p.sub = origSub
                  p.tag = origSub === 'Uniform' ? 'Uniform' : matchedType ? matchedType.name : p.tag
                  p.seller = 'RTU Pasig Campus Store'
                  p.onHand = p.onHand ?? p.left
                  p.hidden = Boolean(ul.paused || ul.state !== 'live')
                  p.inv = {
                    type: matchedType ? matchedType.id : 'ty-other',
                    low: null,
                    win: null,
                    limit: 0,
                    claimNote: '',
                    ...(p.inv || {}),
                    mig: 1,
                  }
                  next.official.unshift(p)
                  if (p.left > 0 && !next.bao.ledger.some((e) => e.pid === p.id)) {
                    next.bao.seq.led += 1
                    next.bao.ledger.push({
                      id: 'L-' + String(next.bao.seq.led).padStart(5, '0'),
                      ts: new Date().toISOString(),
                      pid: p.id,
                      item: p.name,
                      vid: '',
                      label: '',
                      type: 'Stock In',
                      qty: p.left,
                      ohD: p.left,
                      rsD: 0,
                      ticket: '',
                      reason: 'Opening stock when promoted to Official RTU Store',
                      by: me?.name || 'Admin',
                      byEmail: email,
                      after: { onHand: p.left, reserved: 0, available: p.left },
                    })
                  }
                }
              } else {
                kept.push(ul)
              }
            })
            next.userListings = kept
            return next
          }
        }
        // Check if blocked (suspended or banned)
        if (existing.status === 'suspended' || existing.status === 'banned') {
          const msg =
            existing.status === 'banned'
              ? 'Your account has been banned. Please contact the RTU Office of Student Affairs.'
              : 'Your account is suspended. Please contact the RTU Office of Student Affairs.'
          window.setTimeout(() => {
            void logout()
            toast(msg)
          }, 0)
        }
        return prev
      }
      const parts = (user.display_name || 'Student').trim().split(/\s+/)
      const first = tc(parts[0] || 'Student')
      const last = tc(parts.slice(1).join(' ') || '')
      const newAcct = mkAcct({
        email,
        first,
        last,
        sid: isStaffRole ? 'EMP-0042' : email.split('@')[0],
        role: isStaffRole ? 'moderator' : 'student',
        aff: isStaffRole
          ? 'Staff'
          : user.member_type === 'faculty'
            ? 'Faculty'
            : user.member_type === 'personnel'
              ? 'Personnel'
              : 'Student',
        prog: user.college || 'BS Information Technology',
        verified: user.is_verified !== false,
        status: user.status || 'active',
        notifs: [
          {
            t: 'Welcome to RTU Tindahan. Your RTU email is confirmed.',
            read: false,
            ts: nowT(),
            at: new Date().toISOString(),
            link: null,
          },
        ],
      })
      return {
        ...prev,
        accounts: [...prev.accounts, newAcct],
      }
    })
  }, [user, logout, toast])

  // Load saved listing draft when switching user
  const prevEmailRef = useRef<string | null>(null)
  useEffect(() => {
    const email = user ? user.email.trim().toLowerCase() : null
    if (email === prevEmailRef.current) return
    prevEmailRef.current = email
    const acct = email ? db.accounts.find((a) => a.email === email) : undefined
    if (!email) {
      setDraft(blankDraft(isStaffUser, acct?.windows))
      setListStep(1)
      return
    }
    if (acct?.draft) {
      try {
        const parsed = JSON.parse(acct.draft) as Partial<ListingDraft>
        setDraft({
          ...blankDraft(),
          ...parsed,
          days: cleanDays(parsed.days),
          images: Array.isArray(parsed.images) ? parsed.images : [],
          editLid: null,
        })
      } catch {
        setDraft(blankDraft(isStaffUser, acct?.windows))
      }
    } else {
      setDraft(blankDraft(isStaffUser, acct?.windows))
    }
    setListStep(1)
  }, [user, db.accounts])

  // Ensure signed in user has a corresponding account in db.accounts
  useEffect(() => {
    if (!user) return
    const email = user.email.trim().toLowerCase()
    setDb((prev) => {
      if (prev.accounts.some((a) => a.email === email)) return prev
      const newAcct = mkAcct({
        email,
        name: user.display_name,
        first: user.display_name.split(' ')[0] || 'Student',
        last: user.display_name.split(' ').slice(1).join(' ') || '',
        sid: email.split('@')[0],
        role: user.role === 'moderator' || user.role === 'administrator' || user.role === 'office_staff' ? 'moderator' : 'student',
        aff: user.member_type === 'personnel' ? 'Staff' : 'Student',
        prog: user.college || 'BS Information Technology',
        status: user.status === 'banned' ? 'banned' : user.status === 'suspended' ? 'suspended' : 'active',
        verified: user.is_verified,
        since: user.date_joined || new Date().toISOString(),
      })
      return {
        ...prev,
        accounts: [...prev.accounts, newAcct],
      }
    })
  }, [user])

  const currentAccount = useMemo(() => {
    if (!user) return null
    const email = user.email.trim().toLowerCase()
    return db.accounts.find((a) => a.email === email) || null
  }, [user, db.accounts])

  const defaultTabSetRef = useRef<boolean>(false)

  // Determine whether an Active order belongs in 'Requesting' or 'For Pickup'.
  // Student seller orders: status 'Awaiting seller'/'Pending' or stage <= 1 => Requesting;
  // status 'Meetup set' or stage >= 2 => For Pickup.
  // Official RTU Store (BAO) orders: status 'Request Received' => Requesting;
  // status 'Confirmed'/'Ready for Pickup' => For Pickup.
  function isRequestingOrder(o: OrderRecord): boolean {
    if (o.tab !== 'Active') return false
    const t = baoTxnFor(o, db.txn)
    if (baoIsOfficialTxn(t) && t) {
      const st = baoStatusOf(t)
      return st === 'Request Received'
    }
    return o.status === 'Awaiting seller' || o.stage <= 1
  }

  function isForPickupOrder(o: OrderRecord): boolean {
    if (o.tab !== 'Active') return false
    const t = baoTxnFor(o, db.txn)
    if (baoIsOfficialTxn(t) && t) {
      const st = baoStatusOf(t)
      return st === 'Confirmed' || st === 'Ready for Pickup'
    }
    return o.status === 'Meetup set' || o.stage >= 2
  }

  // Default the initial active tab: 'For Pickup' if there are pickup-ready
  // active orders and none requesting, otherwise 'Requesting'.
  useEffect(() => {
    if (!currentAccount || defaultTabSetRef.current) return
    const requesting = currentAccount.orders.filter(o => isRequestingOrder(o)).length
    const forPickup = currentAccount.orders.filter(o => isForPickupOrder(o)).length
    if (forPickup > 0 && requesting === 0) {
      setOrderTab('For Pickup')
    } else {
      setOrderTab('Requesting')
    }
    defaultTabSetRef.current = true
  }, [currentAccount])

  // Kick blocked user if status changed in another tab or action
  useEffect(() => {
    if (
      currentAccount &&
      (currentAccount.status === 'suspended' || currentAccount.status === 'banned')
    ) {
      const msg =
        currentAccount.status === 'banned'
          ? 'Your account has been banned. Please contact the RTU Office of Student Affairs.'
          : 'Your account is suspended. Please contact the RTU Office of Student Affairs.'
      void logout()
      toast(msg)
    }
  }, [currentAccount, logout, toast])

  const isStaffUser = useMemo(() => {
    if (!user) return false
    if (user.role === 'moderator' || user.role === 'administrator' || user.role === 'office_staff')
      return true
    return currentAccount?.role === 'moderator'
  }, [user, currentAccount])

  const isAdminUser = useMemo(() => user?.role === 'administrator', [user])

  const acctByEmail = useCallback(
    (email?: string | null) => {
      if (!email) return undefined
      const norm = String(email).trim().toLowerCase()
      return db.accounts.find((a) => a.email === norm)
    },
    [db.accounts],
  )

  const sellerKind = useCallback(
    (p?: PrototypeProduct | null): 'student' | 'school' => {
      if (!p) return 'student'
      // Products from the API carry the backend's own answer. Guessing from the
      // owner's role made every listing by office staff or a moderator look like
      // an Official RTU Store item, which is wrong: officialness is a listing
      // flag, not a property of the seller.
      if (typeof p.off === 'boolean') return p.off ? 'school' : 'student'
      if (p.cat === 'Official') return 'school'
      const o = p.owner ? acctByEmail(p.owner) : undefined
      return o && o.role === 'moderator' ? 'school' : 'student'
    },
    [acctByEmail],
  )

  const allOnSale = useMemo(() => {
    const blocked = new Set(
      [
        ...db.accounts
          .filter((a) => a.status && a.status !== 'active')
          .map((a) => a.email),
        ...storeBlocked,
      ],
    )
    const officialLive = db.official.filter((p) => !p.hidden)
    const studentLive = db.userListings
      .filter((l) => l.state === 'live' && !l.paused && !l.modHold && !blocked.has(l.ownerEmail))
      .map((l) => l.product)
    return [...officialLive, ...studentLive]
  }, [db.accounts, db.official, db.userListings, storeBlocked])

  const allProducts = useMemo(() => allOnSale.filter((p) => !isSvc(p)), [allOnSale])
  const allServices = useMemo(() => allOnSale.filter((p) => isSvc(p)), [allOnSale])

  const byId = useCallback(
    (id?: string | null): PrototypeProduct | undefined => {
      if (!id) return undefined
      return (
        db.official.find((p) => p.id === id) ||
        db.userListings.map((l) => l.product).find((p) => p && p.id === id)
      )
    },
    [db.official, db.userListings],
  )

  const sellerKeyOf = useCallback((p?: PrototypeProduct | null): string => {
    return (p && p.owner) || 'official'
  }, [])

  const sellerKeyByName = useCallback(
    (name: string): string => {
      const p = allOnSale.find((x) => x.seller === name)
      return p ? sellerKeyOf(p) : ''
    },
    [allOnSale, sellerKeyOf],
  )

  const sellerNameOf = useCallback(
    (key: string): string => {
      if (key === 'official') return 'Official RTU Store'
      const p =
        allOnSale.find((x) => x.owner === key) ||
        db.userListings.map((l) => l.product).find((x) => x && x.owner === key)
      const a = acctByEmail(key)
      return (p && p.seller) || (a && a.name) || 'Seller'
    },
    [allOnSale, db.userListings, acctByEmail],
  )

  // Ratings & Sales
  const ratingOf = useCallback(
    (kind: 'item' | 'seller', key: string): { avg: number; n: number } => {
      let sum = 0
      let n = 0
      db.reviews.forEach((r) => {
        if (r.kind === kind) {
          const k = r.kind === 'item' ? r.pid : r.sellerKey
          if (k === key) {
            sum += r.stars
            n++
          }
        }
      })
      return n ? { avg: sum / n, n } : { avg: 0, n: 0 }
    },
    [db.reviews],
  )

  const salesIndex = useMemo(() => {
    const m = new Map<string, { units: number; orders: number }>()
    db.txn.forEach((t) => {
      if (t.status !== 'Completed') return
      ;(t.lines || []).forEach((l) => {
        if (!l.pid) return
        const a = m.get(l.pid) || { units: 0, orders: 0 }
        a.units += Number(l.qty) || 0
        a.orders++
        m.set(l.pid, a)
      })
    })
    return m
  }, [db.txn])

  const sortProducts = useCallback(
    (
      list: PrototypeProduct[],
      mode: string,
      rateBasis: 'item' | 'seller' = browseState.rateBasis,
    ): PrototypeProduct[] => {
      const idNum = (id: string) => parseInt(String(id).replace(/\D/g, ''), 10) || 0
      const byNewest = (a: PrototypeProduct, b: PrototypeProduct) =>
        (b.pub || 0) - (a.pub || 0) ||
        idNum(b.id) - idNum(a.id) ||
        String(a.name).localeCompare(String(b.name))

      const l = list.slice()
      if (mode === 'Newest') return l.sort(byNewest)
      if (mode === 'Price: low to high') return l.sort((a, b) => a.price - b.price || byNewest(a, b))
      if (mode === 'Price: high to low') return l.sort((a, b) => b.price - a.price || byNewest(a, b))
      if (mode === 'Best-Selling' || mode === 'Least-Sold') {
        const g = (p: PrototypeProduct) => salesIndex.get(p.id) || { units: 0, orders: 0 }
        if (mode === 'Best-Selling') {
          return l.sort(
            (a, b) => g(b).units - g(a).units || g(b).orders - g(a).orders || byNewest(a, b),
          )
        }
        return l.sort(
          (a, b) => g(a).units - g(b).units || g(b).orders - g(a).orders || byNewest(a, b),
        )
      }
      if (mode === 'Small sellers first') {
        // A "small seller" is a verified student whose live catalogue is at
        // most three listings (the backend decides, and sends the flag). Rows
        // that did not come from the API have no count, so they sort last.
        const small = (p: PrototypeProduct) => (p.smallSeller ? 1 : 0)
        const count = (p: PrototypeProduct) =>
          p.sellerListingCount ?? Number.MAX_SAFE_INTEGER
        return l.sort(
          (a, b) => small(b) - small(a) || count(a) - count(b) || byNewest(a, b),
        )
      }
      if (mode === 'Top-Rated' || mode === 'Lowest-Rated') {
        const r = (p: PrototypeProduct) =>
          rateBasis === 'seller' ? ratingOf('seller', sellerKeyOf(p)) : ratingOf('item', p.id)
        const low = mode === 'Lowest-Rated'
        return l.sort((a, b) => {
          const x = r(a)
          const y = r(b)
          if (!x.n || !y.n) return !x.n && !y.n ? byNewest(a, b) : x.n ? -1 : 1
          return (low ? x.avg - y.avg : y.avg - x.avg) || y.n - x.n || byNewest(a, b)
        })
      }
      return l
    },
    [browseState.rateBasis, ratingOf, salesIndex, sellerKeyOf],
  )

  const browseFor = useCallback(
    (opts: Partial<BrowseFilterState> & { goBrowse?: boolean }) => {
      setBrowseState((prev) => ({
        ...prev,
        q: opts.q ?? '',
        cats: opts.cats ?? [],
        sub: opts.sub ?? '',
        tag: opts.tag ?? '',
        sellerType: opts.sellerType ?? [],
        maxPrice: opts.maxPrice ?? '',
        onlyToday: opts.onlyToday ?? false,
        mapFree: opts.mapFree ?? prev.mapFree,
        sortBy: opts.sortBy ?? prev.sortBy,
        page: 1,
      }))
      if (opts.goBrowse !== false) {
        navigate('browse')
      }
    },
    [],
  )

  const clearBrowseFilters = useCallback(() => {
    setBrowseState((prev) => ({
      ...prev,
      q: '',
      cats: [],
      sub: '',
      tag: '',
      sellerType: [],
      maxPrice: '',
      onlyToday: false,
      page: 1,
    }))
  }, [])

  const openProduct = useCallback(
    (id: string) => {
      if (!currentAccount) {
        setActiveModal({ kind: 'gate', route: 'product', why: 'open a listing and reserve it', after: `product?id=${id}` })
        return
      }
      setSelectedProductId(id)
      // Increment view count if viewing another student seller's listing
      setDb((prev) => {
        const p =
          prev.official.find((x) => x.id === id) ||
          prev.userListings.map((l) => l.product).find((x) => x && x.id === id)
        if (!p || !p.owner || p.owner === currentAccount.email) return prev
        return {
          ...prev,
          accounts: prev.accounts.map((a) => {
            if (a.email !== p.owner) return a
            return {
              ...a,
              sellerList: a.sellerList.map((sl) =>
                sl.lid === p.id ? { ...sl, views: sl.views + 1 } : sl,
              ),
            }
          }),
        }
      })
      navigate(`product?id=${encodeURIComponent(id)}`)
    },
    [currentAccount],
  )

  const openPost = useCallback((postId: string, commentId: string | null = null) => {
    setSelectedPostId(postId)
    setHighlightedCommentId(commentId)
    navigate(`post?id=${encodeURIComponent(postId)}`)
  }, [])

  // Favorites
  const setFavorite = useCallback(
    (productId: string, saved: boolean) => {
      if (!currentAccount) return
      setDb((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => {
          if (a.email !== currentAccount.email) return a
          const has = a.favs.includes(productId)
          if (saved === has) return a
          return {
            ...a,
            favs: saved ? [...a.favs, productId] : a.favs.filter((x) => x !== productId),
          }
        }),
      }))
    },
    [currentAccount],
  )

  const toggleFav = useCallback(
    async (productId: string) => {
      if (!currentAccount) {
        setActiveModal({ kind: 'gate', route: 'browse', why: 'save items to your favorites', after: 'browse' })
        return
      }
      const had = currentAccount.favs.includes(productId)
      // A prototype-only product has no server row to hold the heart.
      const apiListingId = byId(productId)?.apiListingId
      if (!had) playHeart()
      setFavorite(productId, !had)

      if (!apiListingId) {
        toast(had ? 'Removed from favorites.' : 'Saved to your favorites.')
        return
      }

      try {
        const result = await toggleListingFavorite(apiListingId)
        // The server owns the answer: a local heart left over from the
        // prototype must not make the click look saved when it is not.
        if (result.saved !== !had) setFavorite(productId, result.saved)
        toast(result.saved ? 'Saved to your favorites.' : 'Removed from favorites.')
      } catch (err) {
        setFavorite(productId, had)
        toast(err instanceof ApiRequestError ? err.message : 'That favorite could not be saved.')
      }
    },
    [byId, currentAccount, setFavorite, toast],
  )

  const toggleSellerFav = useCallback(
    async (sellerKey: string) => {
      if (!currentAccount || !sellerKey || sellerKey === currentAccount.email) return
      const had = currentAccount.sfavs.includes(sellerKey)
      if (!had) playHeart()
      const apply = (saved: boolean) =>
        setDb((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) => {
            if (a.email !== currentAccount.email) return a
            const has = a.sfavs.includes(sellerKey)
            if (saved === has) return a
            return {
              ...a,
              sfavs: saved ? [...a.sfavs, sellerKey] : a.sfavs.filter((x) => x !== sellerKey),
            }
          }),
        }))
      apply(!had)

      // "Official RTU Store" is a bucket, not an account. A seller whose
      // listings all came from the prototype has no row on the server either.
      const onServer =
        sellerKey !== 'official' &&
        allOnSale.some((p) => p.owner === sellerKey && p.apiListingId)
      if (!onServer) {
        toast(had ? 'Seller removed from your favorites.' : 'Seller added to your favorites.')
        return
      }

      try {
        const result = await toggleSellerFavorite(sellerKey)
        if (result.saved !== !had) apply(result.saved)
        toast(
          result.saved
            ? 'Seller added to your favorites.'
            : 'Seller removed from your favorites.',
        )
      } catch (err) {
        apply(had)
        toast(err instanceof ApiRequestError ? err.message : 'That favorite could not be saved.')
      }
    },
    [allOnSale, currentAccount, toast],
  )

  // Cart calculations & actions
  const cartCount = useMemo(() => {
    if (!currentAccount) return 0
    return currentAccount.cart.reduce((sum, c) => sum + c.qty, 0)
  }, [currentAccount])

  const cartTotal = useMemo(() => {
    if (!currentAccount) return 0
    return currentAccount.cart.reduce((sum, c) => {
      const p = byId(c.id)
      return sum + (p ? unitPrice(p, c.vid) * c.qty : 0)
    }, 0)
  }, [currentAccount, byId])

  const baoOrderProblem = useCallback(
    (
      p: PrototypeProduct | undefined | null,
      addQty = 0,
      who?: { email?: string | null; sid?: string | null; cart?: boolean },
    ): string => {
      if (!p || !db.official.some((x) => x.id === p.id)) return ''
      const w = baoWindowState(db.bao, p)
      if (!w.open) return w.msg
      const lim = baoLimitFor(db.bao, p)
      if (lim > 0) {
        const targetWho = who || {
          email: currentAccount?.email,
          sid: currentAccount?.sid,
          cart: true,
        }
        const inCart = targetWho.cart
          ? (currentAccount?.cart || [])
              .filter((item) => item.id === p.id)
              .reduce((a, item) => a + item.qty, 0)
          : 0
        const had = baoStudentCount(db.bao, db.txn, p, targetWho.email, targetWho.sid)
        if (had + inCart + (addQty || 0) > lim) {
          return (
            `${p.name}: the limit is ${lim} per student.` +
            (had ? ` You already requested ${had}.` : '') +
            (inCart ? ` You have ${inCart} in your cart.` : '')
          )
        }
      }
      return ''
    },
    [db.official, db.bao, db.txn, currentAccount],
  )

  const addToCart = useCallback(
    (id: string, qty: number, vid = '', fulfillment?: ChosenFulfillment): boolean => {
      if (!currentAccount) {
        setActiveModal({ kind: 'gate', route: 'cart', why: 'use your request cart', after: 'cart' })
        return false
      }
      const p = byId(id)
      if (!p) return false
      if (p.owner && p.owner === currentAccount.email) {
        toast('That is your own listing.')
        return false
      }
      if (!allOnSale.some((x) => x.id === id)) {
        toast('That listing is not available right now.')
        return false
      }
      const allowedFulfillment: FulfillmentMethod | string =
        p.fulfillment || (p.cat === 'Official' ? 'pickup' : 'pickup')
      if (
        allowedFulfillment !== 'pickup' &&
        allowedFulfillment !== 'delivery' &&
        allowedFulfillment !== 'both'
      ) {
        toast('This listing does not have a valid fulfillment method configured.')
        return false
      }
      let chosenFulfillment: ChosenFulfillment = 'pickup'
      if (allowedFulfillment === 'pickup') {
        if (fulfillment === 'delivery') {
          toast('This seller only offers campus pickup for this listing.')
          return false
        }
        chosenFulfillment = 'pickup'
      } else if (allowedFulfillment === 'delivery') {
        if (fulfillment === 'pickup') {
          toast('This seller only offers delivery for this listing.')
          return false
        }
        chosenFulfillment = 'delivery'
      } else {
        chosenFulfillment = fulfillment === 'delivery' ? 'delivery' : 'pickup'
      }

      const cleanQty = Math.floor(Number(qty))
      if (!(cleanQty >= 1)) return false
      const baoProb = baoOrderProblem(p, cleanQty)
      if (baoProb) {
        toast(baoProb)
        return false
      }
      let cleanVid = vid
      if (hasVars(p)) {
        if (!cleanVid || !findVar(p, cleanVid)) {
          toast(
            'Please choose your ' +
              p.vars!.attrs.map((a) => a.name.toLowerCase()).join(' and ') +
              ' first.',
          )
          return false
        }
      } else {
        cleanVid = ''
      }
      const exIdx = currentAccount.cart.findIndex((c) => c.id === id && (c.vid || '') === cleanVid)
      const ex = exIdx >= 0 ? currentAccount.cart[exIdx] : undefined
      const have = ex ? ex.qty : 0
      const stock = stockOf(p, cleanVid)
      if (have + cleanQty > stock) {
        toast(stock ? `Only ${stock} left.` : 'Sold out.')
        return false
      }

      // Build the new cart array with the latest reserved item on top (index 0)
      let newCart: typeof currentAccount.cart
      if (exIdx >= 0) {
        // Existing line: increment qty, optionally update fulfillment, move to index 0
        newCart = currentAccount.cart.map((c, i) => {
          if (i === exIdx) {
            return {
              ...c,
              qty: c.qty + cleanQty,
              ...(fulfillment ? { fulfillment: chosenFulfillment } : {}),
            }
          }
          return c
        })
        const [movedLine] = newCart.splice(exIdx, 1)
        newCart.unshift(movedLine!)
      } else {
        // New line: prepend at index 0
        const dateOpts = getPickupDates(p).options
        const defaultDate = dateOpts[0]?.label || 'Today'
        const sellerWins = getSellerTimeWindows(p)
        const newLine = {
          id,
          qty: cleanQty,
          vid: cleanVid,
          place: (p.when.split(',')[0] || (p.cat === 'Official' ? 'BAU Office' : PLACES[1])).trim(),
          time: sellerWins[0] || (p.when.split(',')[1] || TIMES[1]).trim(),
          date: defaultDate,
          fulfillment: p.cat === 'Official' ? 'pickup' : chosenFulfillment,
          deliverySpot: '',
        }
        newCart = [newLine, ...currentAccount.cart]
      }

      // Remap selectedCartItems: newly reserved item auto-checked at index 0,
      // previous selections shifted to account for the reorder
      setSelectedCartItems(prev => {
        const next = new Set<number>()
        next.add(0) // the newly reserved / moved item is always checked
        prev.forEach(oldIdx => {
          if (exIdx >= 0 && oldIdx === exIdx) return // already at index 0
          if (exIdx >= 0 && oldIdx < exIdx) next.add(oldIdx + 1)
          else if (exIdx >= 0 && oldIdx > exIdx) next.add(oldIdx)
          else next.add(oldIdx + 1)
        })
        return next
      })

      setDb((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => {
          if (a.email !== currentAccount.email) return a
          return { ...a, cart: newCart }
        }),
      }))
      playSuccess()
      return true
    },
    [currentAccount, byId, allOnSale, baoOrderProblem, toast],
  )

  const reserveNow = useCallback(
    (id: string, qty: number, vid = '', fulfillment?: ChosenFulfillment) => {
      if (!addToCart(id, qty, vid, fulfillment)) return
      setCartStep(1)
      navigate('cart')
      toast('Reserved. Review your request next.')
    },
    [addToCart, toast],
  )

  const updateCartQty = useCallback(
    (idx: number, delta: number) => {
      if (!currentAccount) return
      const c = currentAccount.cart[idx]
      if (!c) return
      const p = byId(c.id)
      const nextQty = c.qty + delta
      if (nextQty < 1) return
      if (p && nextQty > stockOf(p, c.vid)) {
        toast(`Only ${stockOf(p, c.vid)} left.`)
        return
      }
      setDb((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => {
          if (a.email !== currentAccount.email) return a
          const nextCart = a.cart.map((item, i) =>
            i === idx ? { ...item, qty: nextQty } : item,
          )
          return { ...a, cart: nextCart }
        }),
      }))
    },
    [currentAccount, byId, sellerKind, toast],
  )

  const removeCartLine = useCallback(
    (idx: number) => {
      if (!currentAccount) return
      setDb((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => {
          if (a.email !== currentAccount.email) return a
          const nextCart = a.cart.filter((_, i) => i !== idx)
          if (!nextCart.length) setCartStep(1)
          return { ...a, cart: nextCart }
        }),
      }))
      setSelectedCartItems(prev => {
        const next = new Set<number>()
        prev.forEach(i => {
          if (i === idx) return
          next.add(i > idx ? i - 1 : i)
        })
        return next
      })
      playRemove()
      toast('Removed from your cart.')
    },
    [currentAccount, toast],
  )

  const toggleCartEdit = useCallback(
    (idx: number) => {
      if (!currentAccount) return
      setDb((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => {
          if (a.email !== currentAccount.email) return a
          const nextCart = a.cart.map((item, i) =>
            i === idx ? { ...item, edit: !item.edit } : item,
          )
          return { ...a, cart: nextCart }
        }),
      }))
    },
    [currentAccount],
  )

  const toggleCartSelect = useCallback(
    (idx: number) => {
      setSelectedCartItems((prev) => {
        const next = new Set(prev)
        if (next.has(idx)) next.delete(idx)
        else next.add(idx)
        return next
      })
    },
    [],
  )

  const toggleCartSelectAll = useCallback(() => {
    if (!currentAccount) return
    const allSelected = currentAccount.cart.every((_, i) => selectedCartItems.has(i))
    setSelectedCartItems((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        currentAccount.cart.forEach((_, i) => next.delete(i))
      } else {
        currentAccount.cart.forEach((_, i) => next.add(i))
      }
      return next
    })
  }, [currentAccount, selectedCartItems])

  const updateCartMeetup = useCallback(
    (
      idx: number,
      field: 'place' | 'time' | 'date' | 'fulfillment' | 'deliverySpot',
      value: string,
    ) => {
      if (!currentAccount) return
      const line = currentAccount.cart[idx]
      if (!line) return
      const p = byId(line.id)
      const isOfficialItem = Boolean(p && (p.cat === 'Official' || sellerKind(p) === 'school'))
      if (isOfficialItem && (field === 'place' || field === 'time' || field === 'fulfillment')) {
        toast('Location and time window for Official RTU Store items are set by the administrators.')
        return
      }
      if (field === 'time' && p) {
        const allowedWins = getSellerTimeWindows(p)
        if (!allowedWins.includes(value)) {
          toast('Please pick a time window within the seller’s available schedule.')
          return
        }
      }
      if (field === 'fulfillment') {
        const allowed = p?.fulfillment || 'pickup'
        if (allowed === 'pickup' && value !== 'pickup') {
          toast('This seller only offers Pickup for this listing.')
          return
        }
        if (allowed === 'delivery' && value !== 'delivery') {
          toast('This seller only offers Delivery for this listing.')
          return
        }
        if (value !== 'pickup' && value !== 'delivery') {
          toast('Please select a valid fulfillment method.')
          return
        }
      }
      setDb((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => {
          if (a.email !== currentAccount.email) return a
          const nextCart = a.cart.map((item, i) =>
            i === idx ? { ...item, [field]: value } : item,
          )
          return { ...a, cart: nextCart }
        }),
      }))
    },
    [currentAccount, byId, toast],
  )

  const sendMeetupRequest = useCallback(() => {
    if (!currentAccount) return
    if (!cartAgree) {
      setCartErr('Please confirm that you understand how payment works.')
      return
    }
    const selectedIdx = Array.from(selectedCartItems)
    if (!selectedIdx.length) {
      setCartErr('Select at least 1 item to continue.')
      toast('Select at least 1 item to continue.')
      return
    }
    const selectedCart = selectedIdx.map((i) => currentAccount.cart[i]).filter(Boolean)

    // Validate selected cart items
    for (const c of selectedCart) {
      const p = byId(c.id)
      if (!p || !allOnSale.some((x) => x.id === c.id)) {
        const msg = 'An item in your cart is no longer available. Remove it to continue.'
        setCartErr(msg)
        toast(msg)
        return
      }
      if (p.owner && p.owner === currentAccount.email) {
        const msg = 'Your cart has your own listing. Remove it to continue.'
        setCartErr(msg)
        toast(msg)
        return
      }
      if (hasVars(p) && !findVar(p, c.vid)) {
        const msg = `${p.name}: the chosen variation is no longer offered. Remove it to continue.`
        setCartErr(msg)
        toast(msg)
        return
      }
      const st = stockOf(p, c.vid)
      if (c.qty > st) {
        const msg = `${p.name}: only ${st} left. Lower the quantity to continue.`
        setCartErr(msg)
        toast(msg)
        return
      }
      const baoProb = baoOrderProblem(p, 0)
      if (baoProb) {
        setCartErr(baoProb)
        toast(baoProb)
        return
      }
      const allowedFulfillment = p.fulfillment || 'pickup'
      if (
        allowedFulfillment !== 'pickup' &&
        allowedFulfillment !== 'delivery' &&
        allowedFulfillment !== 'both'
      ) {
        const msg = `${p.name}: no valid fulfillment method is configured by the seller.`
        setCartErr(msg)
        toast(msg)
        return
      }
      const chosen =
        c.fulfillment || (allowedFulfillment === 'delivery' ? 'delivery' : 'pickup')
      if (
        (allowedFulfillment === 'pickup' && chosen !== 'pickup') ||
        (allowedFulfillment === 'delivery' && chosen !== 'delivery')
      ) {
        const msg = `${p.name}: only ${allowedFulfillment} is available for this listing.`
        setCartErr(msg)
        toast(msg)
        return
      }
    }

    const commit = (refs?: {
      officialRef?: string
      bySeller?: Record<string, string>
    }) => {
    let firstOrder: OrderRecord | null = null
    let orderCount = 0
    let createdIds: string[] = []

    setDb((prev) => {
      const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
      const findProductInNext = (pid: string): PrototypeProduct | undefined =>
        next.official.find((x) => x.id === pid) ||
        next.userListings.map((l) => l.product).find((x) => x && x.id === pid)

      const buyer = next.accounts.find((a) => a.email === currentAccount.email)
      if (!buyer) return prev

      const now = new Date()
      const dayCode =
        String(now.getFullYear()).slice(2) +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0')

      const groups = new Map<string, { c: CartLine; p: PrototypeProduct }[]>()
      selectedIdx.forEach((idx) => {
        const c = buyer.cart[idx]
        if (!c) return
        const p = findProductInNext(c.id)
        if (!p) return
        if (!groups.has(p.seller)) groups.set(p.seller, [])
        groups.get(p.seller)!.push({ c, p })
      })

      const madeOrders: OrderRecord[] = []

      groups.forEach((items, seller) => {
        const f = items[0]
        const n = items.reduce((acc, x) => acc + x.c.qty, 0)
        const total = items.reduce((acc, x) => acc + unitPrice(x.p, x.c.vid) * x.c.qty, 0)
        const owner = f.p.owner
          ? next.accounts.find((a) => a.email === f.p.owner)
          : undefined

        // A request may already exist on the server — an Official Store ticket
        // or a student-to-student order — posted before this snapshot was
        // built. Its reference is the id both sides quote.
        const isOfficialGroup = !owner && (f.p.off === true || f.p.cat === 'Official')
        const serverRef =
          (isOfficialGroup ? refs?.officialRef : refs?.bySeller?.[f.p.owner || '']) ||
          null

        const orderId =
          serverRef || `RTU-${dayCode}-${String(next.seq.o++).padStart(3, '0')}`
        const title =
          items.length === 1
            ? `${f.c.qty > 1 ? f.c.qty + ' × ' : ''}${vLineName(f.p, f.c.vid)}`
            : `${n} items from ${seller}`

        const lines: OrderLine[] = items.map((x) => ({
          pid: x.p.id,
          qty: x.c.qty,
          vid: x.c.vid || '',
          vlabel: x.c.vid && findVar(x.p, x.c.vid) ? vLineName(x.p, x.c.vid).replace(/^.*?\((.*)\)$/, '$1') : '',
          price: unitPrice(x.p, x.c.vid),
        }))
        const dateLabel = f.c.date || 'Today'
        const allowedF = f.p.fulfillment || 'pickup'
        const chosenFulfillment: ChosenFulfillment =
          allowedF === 'delivery'
            ? 'delivery'
            : allowedF === 'pickup'
              ? 'pickup'
              : f.c.fulfillment === 'delivery'
                ? 'delivery'
                : 'pickup'
        const methodPrefix = chosenFulfillment === 'delivery' ? 'Delivery' : 'Pickup'
        const spotText =
          chosenFulfillment === 'delivery' && f.c.deliverySpot?.trim()
            ? `${f.c.place} (${f.c.deliverySpot.trim()})`
            : f.c.place
        const when = `${methodPrefix} · ${spotText}, ${dateLabel} ${f.c.time}`

        const o: OrderRecord = {
          id: orderId,
          title,
          total,
          status: 'Awaiting seller',
          tab: 'Active',
          seller,
          when,
          fulfillment: chosenFulfillment,
          stage: 1,
          tone: f.p.tone,
          icon: f.p.icon,
          buyerEmail: buyer.email,
          sellerEmail: owner ? owner.email : null,
          lines,
        }

        buyer.orders.unshift(o)
        madeOrders.push(o)

        // Restock (-1)
        lines.forEach((l) => {
          const prod = findProductInNext(l.pid)
          if (!prod) return
          if (l.vid && hasVars(prod)) {
            const vr = findVar(prod, l.vid)
            if (vr) {
              vr.qty = Math.max(0, vr.qty - l.qty)
              syncLeft(prod)
            }
          } else {
            prod.left = Math.max(0, prod.left - l.qty)
          }
        })

        if (owner) {
          owner.sellerReq.unshift({
            id: 'q' + orderId,
            who: buyer.name,
            what:
              items.length === 1
                ? title
                : `${title}: ${items.map((x) => `${x.c.qty} × ${vLineName(x.p, x.c.vid)}`).join(', ')}`,
            amt: total,
            state: 'new',
            when,
            orderId,
            buyerEmail: buyer.email,
            fulfillment: chosenFulfillment,
          })
          items.forEach((x) => {
            const sl = owner.sellerList.find((z) => z.lid === x.p.id)
            if (sl) sl.req++
          })
          owner.notifs.unshift({
            t: `${buyer.name} requested ${title}. Open My shop to accept or decline.`,
            read: false,
            ts: nowT(),
            at: now.toISOString(),
            link: { k: 'request', id: orderId },
          })
        } else {
          next.accounts
            .filter((a) => a.role === 'moderator')
            .forEach((a) => {
              a.notifs.unshift({
                t: `New request for the Official RTU Store: ${title} from ${buyer.name}. Open Store orders to handle it.`,
                read: false,
                ts: nowT(),
                at: now.toISOString(),
                link: { k: 'txn', id: orderId },
              })
            })
        }

        // Create Transaction Record (TXN)
        const txnLines = items.map((x) => ({
          pid: x.p.id,
          vid: x.c.vid || '',
          name: vLineName(x.p, x.c.vid),
          qty: x.c.qty,
          price: unitPrice(x.p, x.c.vid),
          kind: (isSvc(x.p) ? 'service' : 'product') as 'product' | 'service',
        }))
        const svcCount = txnLines.filter((l) => l.kind === 'service').length
        const isOfficial = f.p.cat === 'Official' || (owner && owner.role === 'moderator')
        const txnId = serverRef
          ? STORE_ID_PREFIX + serverRef
          : `TXN-${dayCode}-${String(++next.seq.tx).padStart(3, '0')}`

        // BAO v1.6 queue number & ledger lines for Official Store requests
        let queueVal: string | null = null
        if (isOfficial && !o.sellerEmail) {
          const qCfg = next.bao.settings.queue
          if (qCfg && qCfg.enabled) {
            const qDay = baoDayKey(now)
            if (qCfg.dailyReset && next.bao.queue.day !== qDay) {
              next.bao.queue = { day: qDay, n: 0 }
            }
            next.bao.queue.day = qDay
            next.bao.queue.n += 1
            queueVal =
              String(qCfg.prefix || '') +
              String(next.bao.queue.n).padStart(Math.max(1, Number(qCfg.pad) || 1), '0')
          }

          // Write Reserved ledger lines for each official item
          lines.forEach((l) => {
            const prod = next.official.find((x) => x.id === l.pid)
            if (!prod) return
            const u = baoUnit(prod, l.vid)
            const curOh = u ? u.onHand : prod.onHand ?? prod.left + l.qty
            const curAv = u ? u.available : prod.left
            next.bao.seq.led += 1
            next.bao.ledger.push({
              id: 'L-' + String(next.bao.seq.led).padStart(5, '0'),
              ts: now.toISOString(),
              pid: prod.id,
              item: prod.name,
              vid: l.vid || '',
              label: u ? u.label : '',
              type: 'Reserved',
              qty: l.qty,
              ohD: 0,
              rsD: l.qty,
              ticket: txnId,
              reason: 'Student request received',
              by: buyer.name,
              byEmail: buyer.email,
              after: {
                onHand: curOh,
                reserved: Math.max(0, curOh - curAv),
                available: curAv,
              },
            })
          })
        }

        const newTxn: TransactionRecord = {
          id: txnId,
          orderId: o.id,
          type: isOfficial ? 'official' : 'student',
          kind: svcCount === txnLines.length ? 'service' : svcCount ? 'mixed' : 'product',
          lines: txnLines,
          summary: txnLines.map((l) => l.name + (l.qty > 1 ? ' × ' + l.qty : '')).join(', '),
          qty: txnLines.reduce((acc, l) => acc + l.qty, 0),
          total: o.total,
          buyerEmail: buyer.email,
          buyerName: buyer.name,
          buyerSid: buyer.sid,
          sellerEmail: o.sellerEmail,
          sellerName: owner ? owner.name : o.seller,
          sellerSid: owner ? owner.sid : '',
          meetup: o.when,
          fulfillment: chosenFulfillment,
          created: now.toISOString(),
          updated: now.toISOString(),
          status: 'Pending',
          history: [
            {
              status: 'Pending',
              ts: now.toISOString(),
              by: buyer.name,
              note: TX_NOTE.Pending,
            },
          ],
          ...(isOfficial && !o.sellerEmail
            ? {
                bst: 'Request Received',
                src: 'Online',
                queue: queueVal,
                pickup: '',
                note: '',
                bhist: [
                  {
                    from: null,
                    to: 'Request Received',
                    by: buyer.name,
                    byEmail: buyer.email,
                    ts: now.toISOString(),
                    note: 'Request sent by the student',
                  },
                ],
              }
            : {}),
        }
        next.txn.push(newTxn)

        // Prepare email in BAO outbox & check low stock for official tickets
        if (isOfficial && !o.sellerEmail) {
          const emCfg = baoDefaultEmailConfig(next.bao.email)
          if (emCfg.events['Request Received'] !== false) {
            const composed = baoEmailCompose(next.bao, next.official, newTxn, 'Request Received')
            const toAddr = String(buyer.email || '').toLowerCase()
            const validTo = Boolean(toAddr && toAddr.endsWith('@' + emCfg.domain))
            next.bao.seq.ob += 1
            next.bao.outbox.push({
              id: 'E-' + String(next.bao.seq.ob).padStart(5, '0'),
              ts: now.toISOString(),
              kind: 'student',
              event: 'Request Received',
              ticket: newTxn.id,
              to: toAddr ? [toAddr] : [],
              subject: composed.subject,
              text: composed.text,
              state: validTo ? 'prepared' : 'skipped',
              note: validTo
                ? 'Not sent. Email sending is off.'
                : 'Skipped. This ticket has no RTU email.',
              sentAt: null,
            })
            if (next.bao.outbox.length > BAO_OUTBOX_MAX) {
              next.bao.outbox.splice(0, next.bao.outbox.length - BAO_OUTBOX_MAX)
            }
          }
          // Low stock check
          next.official.forEach((op) =>
            baoUnits(op).forEach((u) => {
              const aKey = `${op.id}|${u.vid}`
              if (baoIsLow(u)) {
                if (!next.bao.alerts[aKey]) {
                  next.bao.alerts[aKey] = { since: now.toISOString(), available: u.available }
                  const alertTxt = `Low stock: ${baoUnitName(u)} has ${u.available} available.`
                  next.accounts
                    .filter((a) => a.role === 'moderator')
                    .forEach((a) =>
                      a.notifs.unshift({
                        t: alertTxt,
                        read: false,
                        ts: nowT(),
                        at: now.toISOString(),
                        link: { k: 'baostock' },
                      }),
                    )
                  if (emCfg.lowStock) {
                    next.bao.seq.ob += 1
                    next.bao.outbox.push({
                      id: 'E-' + String(next.bao.seq.ob).padStart(5, '0'),
                      ts: now.toISOString(),
                      kind: 'staff',
                      event: 'Low stock',
                      ticket: '',
                      to: emCfg.lowStockTo.slice(),
                      subject: `[RTU Tindahan] Low stock: ${baoUnitName(u)}`,
                      text: [
                        'Hello,',
                        '',
                        `${baoUnitName(u)} is running low in the Official RTU Store.`,
                        `On hand: ${u.onHand}`,
                        `Reserved: ${baoReserved(u)}`,
                        `Available: ${u.available}`,
                        `Low stock level: ${baoThreshold(u)}`,
                        '',
                        'This is an automatic message. Please do not reply.',
                      ].join('\n'),
                      state: emCfg.lowStockTo.length ? 'prepared' : 'skipped',
                      note: emCfg.lowStockTo.length
                        ? 'Not sent. Email sending is off.'
                        : 'Skipped. No staff email addresses are set yet.',
                      sentAt: null,
                    })
                  }
                }
              } else if (next.bao.alerts[aKey]) {
                delete next.bao.alerts[aKey]
              }
            }),
          )
        }

        // A server order has a server thread; a local one would be a second,
        // empty conversation nobody on the other side can see.
        if (!serverRef) {
        // Open or append Order Conversation (CONV)
        const sellerEmail = o.sellerEmail || null
        const pk = pairKey(buyer.email, sellerEmail)
        let conv = next.conv.find((c) => pairKey(c.buyer, c.seller) === pk)
        const ref: MessageRef = {
          type: 'order',
          id: o.id,
          name: o.title,
          pid: f.p.id,
        }
        if (!conv) {
          conv = {
            id: 'cv' + ++next.seq.cv,
            buyer: buyer.email,
            buyerName: buyer.name,
            seller: sellerEmail,
            sellerName: sellerEmail ? o.seller : 'RTU Pasig Campus Store',
            ref,
            msgs: [],
            last: now.toISOString(),
            created: now.toISOString(),
            seen: {},
          }
          next.conv.push(conv)
        }
        const msgText = (cartMsg || '').trim() || `Hi! I sent a request for ${title}.`
        conv.msgs.push({
          id: uid(),
          from: buyer.email,
          name: buyer.name,
          staff: false,
          text: msgText,
          ts: now.toISOString(),
          ref,
        })
        conv.ref = ref
        conv.last = now.toISOString()
        conv.seen[buyer.email] = conv.msgs.length
        }
      })

      // Remove only selected items from cart; unselected items stay
      const selectedSet = new Set(selectedIdx)
      buyer.cart = buyer.cart.filter((_, i) => !selectedSet.has(i))
      createdIds = madeOrders.map((o) => o.id)
      firstOrder = madeOrders[0] || null
      orderCount = madeOrders.length
      return next
    })

    setTimeout(() => {
      if (firstOrder) {
        const fo = firstOrder as OrderRecord
        setLastOrderIds(createdIds)
        setLastOrderId(createdIds[0] || '')
        setSelectedOrderId(fo.id)
        setOrderTab('Requesting')
        setCartAgree(false)
        setCartErr('')
        setSelectedCartItems(new Set())
        // Stay on CartPage at Step 3 so the confirmation renders in-place
        setCartStep(3)
        toast(
          `Request sent to ${fo.seller}` +
            (orderCount > 1 ? ` and ${orderCount - 1} more.` : '.'),
        )
      }
    }, 0)
    }

    // An Official RTU Store request belongs to the backend: it holds the
    // reservation, enforces the per-student limit and the ordering window, and
    // mints the ticket reference the office works from. Post it first, then
    // build the local order around the server's reference. Anything still
    // prototype-local (or a signed-out visitor) keeps the old path.
    const officialLines = currentAccount.cart
      .map((c) => ({ c, p: byId(c.id) }))
      .filter((x) => x.p && (x.p.off === true || x.p.cat === 'Official'))
    const postableOfficial = officialLines.filter(
      (x) => x.p?.apiListingId && /^v\d+$/.test(x.c.vid || ''),
    )

    // Everything else that came from the backend belongs to a student seller,
    // and goes to /orders/ so that seller actually receives it.
    const sellerGroups = new Map<
      string,
      Array<{ c: CartLine; p: PrototypeProduct }>
    >()
    currentAccount.cart.forEach((c) => {
      const p = byId(c.id)
      if (!p || p.off === true || p.cat === 'Official' || !p.apiListingId) return
      const owner = p.owner || ''
      if (!owner.includes('@') || owner === currentAccount.email) return
      if (!sellerGroups.has(owner)) sellerGroups.set(owner, [])
      sellerGroups.get(owner)!.push({ c, p })
    })

    const canPostOfficial =
      Boolean(getToken()) &&
      postableOfficial.length > 0 &&
      postableOfficial.length === officialLines.length
    const canPostOrders = Boolean(getToken()) && sellerGroups.size > 0

    if (!canPostOfficial && !canPostOrders) {
      commit()
      return
    }

    void (async () => {
      try {
        let officialRef: string | undefined
        const bySeller: Record<string, string> = {}

        if (canPostOfficial) {
          const ticket = await createTicket({
            items: postableOfficial.map((x) => ({
              listing: x.p!.apiListingId as number,
              variant: Number((x.c.vid || '').slice(1)),
              quantity: x.c.qty,
            })),
            pickupDate: null,
            claimNotes: (cartMsg || '').trim(),
          })
          officialRef = ticket.reference
        }

        for (const [owner, items] of sellerGroups) {
          const order = await createApiOrder({
            lines: items.map((x) => ({
              listing: x.p.apiListingId as number,
              quantity: x.c.qty,
            })),
            fulfillment: items[0].p.fulfillment ?? 'pickup',
            meetupPlace: items[0].c.place || items[0].p.when,
            meetupTime: items[0].c.time || '',
            note: (cartMsg || '').trim(),
            paymentMethod: cartPayment,
          })
          bySeller[owner] = order.reference

          // Open the thread on the server right away: both sides then find it
          // in Messages, and the note the buyer typed is its first message.
          // A thread failure must not undo a request that already exists.
          try {
            const conversation = await openConversation({
              sellerEmail: owner,
              listingSlug: items[0].p.id.replace(/^api:/, ''),
            })
            const note = (cartMsg || '').trim()
            if (note) await postChatMessage(conversation.id, note)
          } catch {
            /* the order is what matters; the thread can be opened from Messages */
          }
        }

        commit({ officialRef, bySeller })

        // The snapshot update runs inside React's render pass, so the local
        // `firstOrder` may not be set by the time the inner timeout fires. The
        // reference is known here, so open the confirmation screen with it.
        const firstRef = officialRef || Object.values(bySeller)[0]
        if (firstRef) {
          setTimeout(() => {
            setLastOrderId(firstRef)
            setSelectedOrderId(firstRef)
            setOrderTab('Requesting')
            setCartStep(1)
            setCartAgree(false)
            setCartErr('')
            navigate('confirm')
            toast(`Request sent. Your reference is ${firstRef}.`)
          }, 50)
        }
        void refreshStore()
        void refreshOrders()
      } catch (err) {
        const msg =
          err instanceof ApiRequestError
            ? err.message
            : 'The request could not be sent. Please try again.'
        setCartErr(msg)
        toast(msg)
      }
    })()
  }, [
    currentAccount,
    cartAgree,
    cartMsg,
    cartPayment,
    setCartPayment,
    byId,
    allOnSale,
    baoOrderProblem,
    toast,
    refreshStore,
    refreshOrders,
  ])

  // Buyer Order Actions
  const proposeOrderMeetup = useCallback(
    (orderId: string, place: string, time: string) => {
      if (!currentAccount) return
      const curOrd = currentAccount.orders.find((x) => x.id === orderId)
      if (curOrd && (!curOrd.sellerEmail || baoIsOfficialOrder(curOrd, db.txn))) {
        toast('Location and time window for Official RTU Store orders are managed by the administrators.')
        return
      }
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const buyer = next.accounts.find((a) => a.email === currentAccount.email)
        const o = buyer?.orders.find((x) => x.id === orderId)
        if (!buyer || !o) return prev
        o.when = `${place}, Today ${time}`
        o.status = 'Awaiting seller'
        o.stage = 1
        const ow = o.sellerEmail ? next.accounts.find((a) => a.email === o.sellerEmail) : undefined
        const r = ow?.sellerReq.find((x) => x.orderId === o.id)
        if (ow && r) {
          r.state = 'new'
          r.when = `${place}, Today`
          ow.notifs.unshift({
            t: `${buyer.name} proposed a new meetup for ${o.id}: ${o.when}.`,
            read: false,
            ts: nowT(),
            at: new Date().toISOString(),
            link: { k: 'request', id: o.id },
          })
        }
        // Sync TXN
        const tx = next.txn.find((t) => t.orderId === o.id)
        if (tx && tx.status !== 'Pending') {
          tx.status = 'Pending'
          tx.updated = new Date().toISOString()
          tx.history.push({
            status: 'Pending',
            ts: tx.updated,
            by: buyer.name,
            note: TX_NOTE.Pending,
          })
        }
        return next
      })
      toast('New meetup proposal sent.')
    },
    [currentAccount, toast],
  )

  const confirmOrderPickup = useCallback(
    (orderId: string, proofImgId?: string | null) => {
      if (!currentAccount) return
      const curOrd = currentAccount.orders.find((x) => x.id === orderId)
      if (curOrd && baoIsOfficialOrder(curOrd, db.txn)) {
        toast('Only the BAO can mark an Official RTU Store request as claimed.')
        return
      }
      if (curOrd && curOrd.status !== 'Meetup set') {
        toast('You can confirm pickup after the seller accepts your request.')
        return
      }
      const nowIso = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const buyer = next.accounts.find((a) => a.email === currentAccount.email)
        const o = buyer?.orders.find((x) => x.id === orderId)
        if (!buyer || !o) return prev
        if (o.status !== 'Meetup set') return prev
        o.stage = 4
        o.status = 'Completed'
        o.tab = 'Completed'
        if (proofImgId) {
          o.proofPhoto = proofImgId
          o.proofAt = nowIso
          o.proofBy = buyer.name
        }
        const ow = o.sellerEmail ? next.accounts.find((a) => a.email === o.sellerEmail) : undefined
        const r = ow?.sellerReq.find((x) => x.orderId === o.id)
        if (ow && r) {
          r.state = 'done'
          if (proofImgId) {
            r.proofPhoto = proofImgId
            r.proofAt = nowIso
            r.proofBy = buyer.name
          }
          ow.notifs.unshift({
            t: `${buyer.name} confirmed pickup for ${o.id}${proofImgId ? ' with a meetup proof photo' : ''}.`,
            read: false,
            ts: nowT(),
            at: nowIso,
            link: { k: 'request', id: o.id },
          })
        }
        const tx = next.txn.find((t) => t.orderId === o.id)
        if (tx && tx.status !== 'Completed') {
          tx.status = 'Completed'
          tx.updated = nowIso
          tx.history.push({
            status: 'Completed',
            ts: tx.updated,
            by: buyer.name,
            note: proofImgId ? `${TX_NOTE.Completed} (Proof photo attached)` : TX_NOTE.Completed,
          })
        }
        return next
      })
      setOrderTab('Completed')
      toast('Pickup confirmed with proof. Thanks for trading on campus.')
    },
    [currentAccount, db.txn, toast],
  )

  // =========================================================================
  // BAO v1.6 OFFICIAL RTU STORE MANAGEMENT ACTIONS
  // =========================================================================

  const applyLedgerOnSnapshot = (
    next: DatabaseSnapshot,
    items: Array<{
      pid: string
      vid?: string
      type: BaoLedgerType
      qty: number
      reason?: string
      ticket?: string
    }>,
    actor: { by: string; byEmail: string; sys?: boolean },
  ): { ok: boolean; msg?: string; entries?: BaoLedgerEntry[] } => {
    if (!actor.sys && !isStaffUser) {
      return { ok: false, msg: 'Only RTU staff can change stock.' }
    }
    if (!items || !items.length) {
      return { ok: false, msg: 'Nothing to change.' }
    }

    const sim = new Map<
      string,
      { u: ReturnType<typeof baoUnit>; oh: number; av: number }
    >()
    const plan: Array<{
      it: (typeof items)[0]
      u: NonNullable<ReturnType<typeof baoUnit>>
      q: number
      doh: number
      drs: number
      key: string
    }> = []

    for (const it of items) {
      const p = next.official.find((x) => x.id === it.pid)
      if (!p) {
        return { ok: false, msg: 'That item is not in the Official RTU Store.' }
      }
      const u = baoUnit(p, it.vid)
      if (!u) {
        return { ok: false, msg: `${p.name}: that size is not available.` }
      }
      if (!BAO_LTYPES.includes(it.type)) {
        return { ok: false, msg: 'Unknown stock change.' }
      }
      const n = Number(it.qty)
      if (!Number.isInteger(n) || n === 0 || (it.type !== 'Adjustment' && n < 0)) {
        return { ok: false, msg: `${baoUnitName(u)}: enter a whole number of units.` }
      }
      if (it.type === 'Adjustment' && !String(it.reason || '').trim()) {
        return { ok: false, msg: 'A reason is required for an adjustment.' }
      }
      const key = `${it.pid}|${it.vid || ''}`
      const st = sim.get(key) || { u, oh: u.onHand, av: u.available }
      const [doh, drs] =
        it.type === 'Adjustment' ? [n < 0 ? -1 : 1, 0] : BAO_EFFECT[it.type]
      const q = Math.abs(n)
      st.oh += doh * q
      st.av += doh * q - drs * q
      if (st.oh < 0 || st.av < 0 || st.oh - st.av < 0) {
        const res = baoReserved(u)
        const why =
          it.type === 'Reserved' ||
          it.type === 'Sold' ||
          (it.type === 'Adjustment' && n < 0)
            ? `only ${st.av - (doh * q - drs * q)} available${
                it.type === 'Adjustment' && res > 0
                  ? ` (${res} reserved for open tickets)`
                  : ''
              }`
            : it.type === 'Released' || it.type === 'Issued'
              ? 'it is not reserved that many times'
              : 'the number would go below zero'
        return { ok: false, msg: `${baoUnitName(u)}: ${why}.` }
      }
      sim.set(key, st)
      plan.push({ it, u, q, doh, drs, key })
    }

    const out: BaoLedgerEntry[] = []
    const run = new Map<string, { oh: number; av: number }>()
    const now = new Date().toISOString()

    plan.forEach((s) => {
      const cur = run.get(s.key) || { oh: s.u.onHand, av: s.u.available }
      cur.oh += s.doh * s.q
      cur.av += s.doh * s.q - s.drs * s.q
      run.set(s.key, cur)
      next.bao.seq.led += 1
      const entry: BaoLedgerEntry = {
        id: 'L-' + String(next.bao.seq.led).padStart(5, '0'),
        ts: now,
        pid: s.it.pid,
        item: s.u.p.name,
        vid: s.it.vid || '',
        label: s.u.label,
        type: s.it.type,
        qty: s.q,
        ohD: s.doh * s.q,
        rsD: s.drs * s.q,
        ticket: s.it.ticket || '',
        reason: String(s.it.reason || '').trim(),
        by: actor.by,
        byEmail: actor.byEmail,
        after: {
          onHand: cur.oh,
          reserved: Math.max(0, cur.oh - cur.av),
          available: cur.av,
        },
      }
      next.bao.ledger.push(entry)
      out.push(entry)
    })

    sim.forEach((st) => {
      const u = st.u
      if (!u) return
      if (u.row) {
        u.row.onHand = st.oh
        u.row.qty = st.av
        syncLeft(u.p)
      } else {
        u.p.onHand = st.oh
        u.p.left = st.av
      }
    })

    // Check low stock alerts
    const emCfg = baoDefaultEmailConfig(next.bao.email)
    next.official.forEach((op) =>
      baoUnits(op).forEach((u) => {
        const aKey = `${op.id}|${u.vid}`
        if (baoIsLow(u)) {
          if (!next.bao.alerts[aKey]) {
            next.bao.alerts[aKey] = { since: now, available: u.available }
            const alertTxt = `Low stock: ${baoUnitName(u)} has ${u.available} available.`
            next.accounts
              .filter((a) => a.role === 'moderator')
              .forEach((a) =>
                a.notifs.unshift({
                  t: alertTxt,
                  read: false,
                  ts: nowT(),
                  at: now,
                  link: { k: 'baostock' },
                }),
              )
            if (emCfg.lowStock) {
              next.bao.seq.ob += 1
              next.bao.outbox.push({
                id: 'E-' + String(next.bao.seq.ob).padStart(5, '0'),
                ts: now,
                kind: 'staff',
                event: 'Low stock',
                ticket: '',
                to: emCfg.lowStockTo.slice(),
                subject: `[RTU Tindahan] Low stock: ${baoUnitName(u)}`,
                text: [
                  'Hello,',
                  '',
                  `${baoUnitName(u)} is running low in the Official RTU Store.`,
                  `On hand: ${u.onHand}`,
                  `Reserved: ${baoReserved(u)}`,
                  `Available: ${u.available}`,
                  `Low stock level: ${baoThreshold(u)}`,
                  '',
                  'This is an automatic message. Please do not reply.',
                ].join('\n'),
                state: emCfg.lowStockTo.length ? 'prepared' : 'skipped',
                note: emCfg.lowStockTo.length
                  ? 'Not sent. Email sending is off.'
                  : 'Skipped. No staff email addresses are set yet.',
                sentAt: null,
              })
            }
          }
        } else if (next.bao.alerts[aKey]) {
          delete next.bao.alerts[aKey]
        }
      }),
    )

    return { ok: true, entries: out }
  }

  const baoTransitionTicket = useCallback(
    (
      txnId: string,
      to: BaoStatus,
      opt?: { note?: string; pickup?: string; byStudent?: boolean },
    ): { ok: boolean; msg?: string } => {
      if (!currentAccount) return { ok: false, msg: 'Sign in first.' }
      const existingTxn = db.txn.find((x) => x.id === txnId)
      if (!baoIsOfficialTxn(existingTxn) || !existingTxn) {
        return { ok: false, msg: 'This is not an Official RTU Store ticket.' }
      }
      const from = baoStatusOf(existingTxn)
      const byStudent = Boolean(opt?.byStudent)
      if (byStudent) {
        if (currentAccount.email !== existingTxn.buyerEmail) {
          return { ok: false, msg: 'You can only change your own request.' }
        }
        if (to !== 'Cancelled' || !db.bao.settings.studentCancelFrom.includes(from)) {
          return {
            ok: false,
            msg: 'The BAO has already started on this request. Please message the BAO office to change it.',
          }
        }
      } else if (!isStaffUser) {
        return { ok: false, msg: 'Only RTU staff can do that.' }
      }
      if (!BAO_STATUSES.includes(to)) {
        return { ok: false, msg: 'Unknown status.' }
      }
      if (from === to) {
        return { ok: false, msg: `This ticket is already ${to}.` }
      }
      if (!baoAllowed(db.bao, from, to)) {
        return { ok: false, msg: `The workflow does not allow ${from} to ${to}.` }
      }
      const note = String(opt?.note || '').trim()
      if (db.bao.settings.reasonRequired.includes(to) && !note) {
        return { ok: false, msg: `Add a reason before choosing ${to}.` }
      }

      let outcome: { ok: boolean; msg?: string } = { ok: true }

      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const t = next.txn.find((x) => x.id === txnId)
        if (!t) return prev

        // Apply ledger stock hook if Cancelled or Claimed
        if (to === 'Cancelled') {
          const alreadyReleased = next.bao.ledger.some(
            (e) => e.ticket === t.id && e.type === 'Released',
          )
          if (!alreadyReleased) {
            const lines = t.lines
              .filter((l) => l.pid && next.official.some((op) => op.id === l.pid))
              .map((l) => ({
                pid: l.pid!,
                vid: l.vid || '',
                type: 'Released' as const,
                qty: l.qty,
                ticket: t.id,
                reason: `Ticket cancelled${note ? ': ' + note : ''}`,
              }))
            if (lines.length) {
              const res = applyLedgerOnSnapshot(next, lines, {
                by: currentAccount.name,
                byEmail: currentAccount.email,
                sys: true,
              })
              if (!res.ok) {
                outcome = res
                return prev
              }
            }
          }
        } else if (to === 'Claimed') {
          const alreadyIssued = next.bao.ledger.some(
            (e) => e.ticket === t.id && e.type === 'Issued',
          )
          if (!alreadyIssued) {
            const lines = t.lines
              .filter((l) => l.pid && next.official.some((op) => op.id === l.pid))
              .map((l) => ({
                pid: l.pid!,
                vid: l.vid || '',
                type: 'Issued' as const,
                qty: l.qty,
                ticket: t.id,
                reason: 'Ticket claimed',
              }))
            if (lines.length) {
              const res = applyLedgerOnSnapshot(next, lines, {
                by: currentAccount.name,
                byEmail: currentAccount.email,
                sys: true,
              })
              if (!res.ok) {
                outcome = res
                return prev
              }
            }
          }
        }

        const now = new Date().toISOString()
        const by = byStudent ? t.buyerName : currentAccount.name
        const buyer = next.accounts.find((a) => a.email === t.buyerEmail)
        const ord = buyer?.orders.find((x) => x.id === t.orderId)
        const legacy = BAO_LEGACY[to]

        t.bst = to
        t.note = note
        if (opt?.pickup !== undefined) t.pickup = opt.pickup
        t.updated = now
        if (!Array.isArray(t.bhist)) t.bhist = []
        t.bhist.push({
          from,
          to,
          by,
          byEmail: currentAccount.email,
          ts: now,
          note,
        })

        if (legacy !== t.status) {
          t.status = legacy
          t.history.push({
            status: legacy,
            ts: now,
            by,
            note: TX_NOTE[legacy],
          })
        }

        if (ord) {
          ord.status = BAO_ORDER_STATUS[to]
          if (BAO_STAGE[to]) ord.stage = BAO_STAGE[to]!
          ord.tab =
            to === 'Claimed' ? 'Completed' : to === 'Cancelled' ? 'Cancelled' : 'Active'
        }

        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'ticket status',
          targetType: 'ticket',
          targetId: t.id,
          targetName: t.summary,
          note: `${from} to ${to}${note ? ': ' + note : ''}`,
        })

        if (buyer && ord && !byStudent) {
          buyer.notifs.unshift({
            t: baoMessage(t, to, note),
            read: false,
            ts: nowT(),
            at: now,
            link: { k: 'order', id: ord.id },
          })
        }
        if (byStudent && ord) {
          next.accounts
            .filter((a) => a.role === 'moderator')
            .forEach((a) =>
              a.notifs.unshift({
                t: `${t.buyerName} cancelled ticket ${t.id}.`,
                read: false,
                ts: nowT(),
                at: now,
                link: { k: 'txn', id: ord.id },
              }),
            )
        }

        // Prepare email event in outbox
        const emCfg = baoDefaultEmailConfig(next.bao.email)
        if (BAO_EMAIL_EVENTS.includes(to) && emCfg.events[to] !== false) {
          const composed = baoEmailCompose(next.bao, next.official, t, to)
          const toAddr = String(t.buyerEmail || '').toLowerCase()
          const validTo = Boolean(toAddr && toAddr.endsWith('@' + emCfg.domain))
          next.bao.seq.ob += 1
          next.bao.outbox.push({
            id: 'E-' + String(next.bao.seq.ob).padStart(5, '0'),
            ts: now,
            kind: 'student',
            event: to,
            ticket: t.id,
            to: toAddr ? [toAddr] : [],
            subject: composed.subject,
            text: composed.text,
            state: validTo ? 'prepared' : 'skipped',
            note: validTo
              ? 'Not sent. Email sending is off.'
              : 'Skipped. This ticket has no RTU email.',
            sentAt: null,
          })
          if (next.bao.outbox.length > BAO_OUTBOX_MAX) {
            next.bao.outbox.splice(0, next.bao.outbox.length - BAO_OUTBOX_MAX)
          }
        }

        return next
      })

      // The ticket may live on the server. The local snapshot has already
      // moved (so the screen answers instantly); the server call is what makes
      // it real, and a rejection reloads the server's truth.
      if (outcome.ok && txnId.startsWith(STORE_ID_PREFIX)) {
        const reference = txnId.slice(STORE_ID_PREFIX.length)
        void postTicketTransition(reference, to, opt?.note || '')
          .then(() => refreshStore())
          .catch((err: unknown) => {
            toast(
              err instanceof ApiRequestError
                ? err.message
                : 'The server did not accept that change. Reloading.',
            )
            void refreshStore()
          })
      }

      return outcome
    },
    [currentAccount, isStaffUser, db.txn, db.bao, refreshStore, toast],
  )


  const cancelOrderRequest = useCallback(
    (orderId: string) => {
      if (!currentAccount) return
      const curOrd = currentAccount.orders.find((x) => x.id === orderId)
      if (!curOrd) return

      // Block cancellation once meetup is set (For Pickup / Completed / Cancelled)
      const t = baoTxnFor(curOrd, db.txn ?? [])
      if (baoIsOfficialTxn(t) && t) {
        const st = baoStatusOf(t)
        if (st !== 'Request Received') {
          toast('This order is already set for meetup and can no longer be cancelled.')
          return
        }
      } else {
        if (curOrd.status !== 'Awaiting seller' && curOrd.stage > 1) {
          toast('This order is already set for meetup and can no longer be cancelled.')
          return
        }
      }

      const offTxn = baoTxnFor(curOrd, db.txn)
      if (offTxn && baoIsOfficialTxn(offTxn)) {
        confirmDlg({
          title: 'Cancel this request?',
          msg: 'The Official RTU Store will be notified and reserved stock will be released.',
          yes: 'Yes, cancel request',
          no: 'Keep request',
          danger: true,
          run: () => {
            const res = baoTransitionTicket(offTxn.id, 'Cancelled', {
              byStudent: true,
              note: 'Cancelled by the student',
            })
            if (!res.ok) {
              toast(res.msg || 'Could not cancel request.')
              return
            }
            setOrderTab('Cancelled')
            toast('Request cancelled.')
          },
        })
        return
      }
      confirmDlg({
        title: 'Cancel this request?',
        msg: 'The seller will be told right away. Items go back to stock.',
        yes: 'Yes, cancel request',
        no: 'Keep request',
        danger: true,
        run: () => {
          setDb((prev) => {
            const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
            const findProductInNext = (pid: string): PrototypeProduct | undefined =>
              next.official.find((x) => x.id === pid) ||
              next.userListings.map((l) => l.product).find((x) => x && x.id === pid)

            const buyer = next.accounts.find((a) => a.email === currentAccount.email)
            const o = buyer?.orders.find((x) => x.id === orderId)
            if (!buyer || !o) return prev
            o.status = 'Cancelled'
            o.tab = 'Cancelled'
            // Restock (+1)
            ;(o.lines || []).forEach((l) => {
              const prod = findProductInNext(l.pid)
              if (!prod) return
              if (l.vid && hasVars(prod)) {
                const vr = findVar(prod, l.vid)
                if (vr) {
                  vr.qty = Math.max(0, vr.qty + l.qty)
                  syncLeft(prod)
                }
              } else {
                prod.left = Math.max(0, prod.left + l.qty)
              }
            })
            const ow = o.sellerEmail
              ? next.accounts.find((a) => a.email === o.sellerEmail)
              : undefined
            const r = ow?.sellerReq.find((x) => x.orderId === o.id)
            if (ow && r) {
              r.state = 'cancelled'
              ow.notifs.unshift({
                t: `${buyer.name} cancelled request ${o.id}.`,
                read: false,
                ts: nowT(),
                at: new Date().toISOString(),
                link: { k: 'request', id: o.id },
              })
            }
            const tx = next.txn.find((t) => t.orderId === o.id)
            if (tx && tx.status !== 'Cancelled') {
              tx.status = 'Cancelled'
              tx.updated = new Date().toISOString()
              tx.history.push({
                status: 'Cancelled',
                ts: tx.updated,
                by: buyer.name,
                note: TX_NOTE.Cancelled,
              })
            }
            return next
          })
          setOrderTab('Cancelled')
          toast('Request cancelled.')
        },
      })
    },
    [currentAccount, db.txn, baoTransitionTicket, confirmDlg, toast],
  )

  const cancelMultipleOrders = useCallback(
    (orderIds: string[]) => {
      if (!currentAccount) return

      // Filter to strictly cancellable orders
      const cancellable = orderIds
        .map((id) => currentAccount.orders.find((o) => o.id === id))
        .filter((o): o is OrderRecord => Boolean(o))
        .filter((o) => {
          const t = baoTxnFor(o, db.txn ?? [])
          if (baoIsOfficialTxn(t) && t) {
            return baoStatusOf(t) === 'Request Received'
          }
          return o.tab === 'Active' && (o.status === 'Awaiting seller' || o.stage <= 1)
        })

      if (!cancellable.length) {
        toast('No selected orders can be cancelled.')
        return
      }

      confirmDlg({
        title: `Cancel ${cancellable.length} requests?`,
        msg:
          cancellable.length === 1
            ? 'This will release reserved stock and notify the seller.'
            : 'This will release reserved stock for all selected orders and notify the sellers.',
        yes: 'Yes, cancel requests',
        no: 'Keep requests',
        danger: true,
        run: () => {
          setDb((prev) => {
            const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
            const buyer = next.accounts.find((a) => a.email === currentAccount.email)
            const now = new Date().toISOString()
            const TX = TX_NOTE.Cancelled

            for (const o of cancellable) {
              const ord = buyer?.orders.find((x) => x.id === o.id)
              if (!ord) continue

              const t = baoTxnFor(ord, next.txn ?? [])
              if (baoIsOfficialTxn(t) && t) {
                // Official BAO order: release reserved stock via ledger
                const alreadyReleased = next.bao.ledger.some(
                  (e) => e.ticket === t.id && e.type === 'Released',
                )
                if (!alreadyReleased) {
                  const lines = t.lines
                    .filter((l) => l.pid && next.official.some((op) => op.id === l.pid))
                    .map((l) => ({
                      pid: l.pid!,
                      vid: l.vid || '',
                      type: 'Released' as const,
                      qty: l.qty,
                      ticket: t.id,
                      reason: `Ticket cancelled (batch)`,
                    }))
                  if (lines.length) {
                    applyLedgerOnSnapshot(next, lines, {
                      by: currentAccount.name,
                      byEmail: currentAccount.email,
                      sys: true,
                    })
                  }
                }

                t.bst = 'Cancelled'
                t.status = 'Cancelled'
                t.updated = now
                if (!Array.isArray(t.bhist)) t.bhist = []
                t.bhist.push({
                  from: baoStatusOf(t) === 'Cancelled' ? 'Cancelled' : 'Request Received',
                  to: 'Cancelled',
                  by: currentAccount.name,
                  byEmail: currentAccount.email,
                  ts: now,
                  note: 'Cancelled by the student (batch)',
                })
                if (t.status !== 'Cancelled') {
                  t.status = 'Cancelled'
                  t.history.push({
                    status: 'Cancelled',
                    ts: now,
                    by: currentAccount.name,
                    note: TX,
                  })
                }

                ord.status = 'Cancelled'
                ord.tab = 'Cancelled'

                // Notify moderators
                next.accounts
                  .filter((a) => a.role === 'moderator')
                  .forEach((m) => {
                    m.notifs.unshift({
                      t: `BAO order #${t.id} cancelled by student (batch).`,
                      read: false,
                      ts: now,
                      at: now,
                      link: { k: 'order', id: t.id },
                    })
                  })
              } else {
                // Student order: cancel and restock
                ord.status = 'Cancelled'
                ord.tab = 'Cancelled'

                // Restock product/variant
                ;(ord.lines || []).forEach((l) => {
                  const prod =
                    next.official.find((x) => x.id === l.pid) ||
                    next.userListings.map((x) => x.product).find((x) => x && x.id === l.pid)
                  if (!prod) return
                  if (l.vid && hasVars(prod)) {
                    const vr = findVar(prod, l.vid)
                    if (vr) {
                      vr.qty = Math.max(0, vr.qty + l.qty)
                      syncLeft(prod)
                    }
                  } else {
                    prod.left = Math.max(0, prod.left + l.qty)
                  }
                })

                // Set matching sellerReq.state = 'cancelled' and notify seller
                const ow = ord.sellerEmail
                  ? next.accounts.find((a) => a.email === ord.sellerEmail)
                  : undefined
                const r = ow?.sellerReq.find((x) => x.orderId === ord.id)
                if (ow && r) {
                  r.state = 'cancelled'
                  ow.notifs.unshift({
                    t: `${buyer?.name || currentAccount.name} cancelled request ${ord.id}.`,
                    read: false,
                    ts: nowT(),
                    at: now,
                    link: { k: 'request', id: ord.id },
                  })
                }

                // Update matching txn to 'Cancelled'
                const tx = next.txn.find((x) => x.orderId === ord.id)
                if (tx && tx.status !== 'Cancelled') {
                  tx.status = 'Cancelled'
                  tx.updated = now
                  tx.history.push({
                    status: 'Cancelled',
                    ts: now,
                    by: buyer?.name || currentAccount.name,
                    note: TX,
                  })
                }
              }
            }

            return next
          })
          setOrderTab('Cancelled')
          toast(
            `Cancelled ${cancellable.length} request${cancellable.length === 1 ? '' : 's'}.`,
          )
        },
      })
    },
    [currentAccount, db.txn, baoTxnFor, baoIsOfficialTxn, baoStatusOf, applyLedgerOnSnapshot, hasVars, findVar, syncLeft, confirmDlg, setOrderTab, toast, nowT],
  )

  // Seller Request Actions
  const respondSellerRequest = useCallback(
    (reqId: string, action: 'accept' | 'decline' | 'done' | 'undo', proofImgId?: string | null) => {
      if (!currentAccount) return
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const findProductInNext = (pid: string): PrototypeProduct | undefined =>
          next.official.find((x) => x.id === pid) ||
          next.userListings.map((l) => l.product).find((x) => x && x.id === pid)

        const seller = next.accounts.find((a) => a.email === currentAccount.email)
        const r = seller?.sellerReq.find((x) => x.id === reqId)
        if (!seller || !r) return prev

        const was = r.state
        const buyer = next.accounts.find((a) => a.email === r.buyerEmail)
        const o = buyer?.orders.find((x) => x.id === r.orderId)

        const adjustStock = (sign: 1 | -1) => {
          if (!o) return
          ;(o.lines || []).forEach((l) => {
            const prod = findProductInNext(l.pid)
            if (!prod) return
            if (l.vid && hasVars(prod)) {
              const vr = findVar(prod, l.vid)
              if (vr) {
                vr.qty = Math.max(0, vr.qty + sign * l.qty)
                syncLeft(prod)
              }
            } else {
              prod.left = Math.max(0, prod.left + sign * l.qty)
            }
          })
        }

        if (action === 'accept') {
          r.state = 'accepted'
          if (o && buyer) {
            o.status = 'Meetup set'
            o.stage = 2
            o.tab = 'Active'
            buyer.notifs.unshift({
              t: `${seller.name} accepted your request ${o.id}. Meetup is set.`,
              read: false,
              ts: nowT(),
              at: new Date().toISOString(),
              link: { k: 'order', id: o.id },
            })
          }
        } else if (action === 'decline') {
          r.state = 'declined'
          if (o && buyer) {
            o.status = 'Cancelled'
            o.stage = 1
            o.tab = 'Cancelled'
            adjustStock(1)
            buyer.notifs.unshift({
              t: `${seller.name} declined your request ${o.id}.`,
              read: false,
              ts: nowT(),
              at: new Date().toISOString(),
              link: { k: 'order', id: o.id },
            })
          }
        } else if (action === 'done') {
          const nowIso = new Date().toISOString()
          r.state = 'done'
          if (proofImgId) {
            r.proofPhoto = proofImgId
            r.proofAt = nowIso
            r.proofBy = seller.name
          }
          if (o && buyer) {
            o.status = 'Completed'
            o.stage = 4
            o.tab = 'Completed'
            if (proofImgId) {
              o.proofPhoto = proofImgId
              o.proofAt = nowIso
              o.proofBy = seller.name
            }
            buyer.notifs.unshift({
              t: `Pickup confirmed for ${o.id}${proofImgId ? ' with a meetup proof photo' : ''}.`,
              read: false,
              ts: nowT(),
              at: nowIso,
              link: { k: 'order', id: o.id },
            })
          }
        } else if (action === 'undo') {
          r.state = 'new'
          if (o && buyer) {
            o.status = 'Awaiting seller'
            o.stage = 1
            o.tab = 'Active'
            if (was === 'declined') adjustStock(-1)
            buyer.notifs.unshift({
              t: `${seller.name} reopened your request ${o.id}.`,
              read: false,
              ts: nowT(),
              at: new Date().toISOString(),
              link: { k: 'order', id: o.id },
            })
          }
        }

        if (o) {
          const tx = next.txn.find((t) => t.orderId === o.id)
          const targetTxStatus = TX_FLOW[o.status]
          if (tx && targetTxStatus && tx.status !== targetTxStatus) {
            tx.status = targetTxStatus
            tx.updated = new Date().toISOString()
            tx.history.push({
              status: targetTxStatus,
              ts: tx.updated,
              by: seller.name,
              note: TX_NOTE[targetTxStatus],
            })
          }
        }
        return next
      })

      if (action === 'accept') toast('Accepted. The buyer was notified.')
      else if (action === 'decline') toast('Declined. The buyer was notified.')
      else if (action === 'done') toast('Pickup recorded. Thanks for trading on campus.')
    },
    [currentAccount, toast],
  )

  // Seller Listing Management
  const toggleSellerListingPause = useCallback(
    (idx: number) => {
      if (!currentAccount) return
      const l = currentAccount.sellerList[idx]
      if (!l || (l.status !== 'Active' && l.status !== 'Paused')) return
      const nextStatus = l.status === 'Active' ? 'Paused' : 'Active'
      setDb((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => {
          if (a.email !== currentAccount.email) return a
          return {
            ...a,
            sellerList: a.sellerList.map((sl, i) =>
              i === idx ? { ...sl, status: nextStatus } : sl,
            ),
          }
        }),
        userListings: prev.userListings.map((ul) =>
          ul.lid === l.lid ? { ...ul, paused: nextStatus === 'Paused' } : ul,
        ),
      }))
      toast(
        `${l.name} ${nextStatus === 'Active' ? 'is live again.' : 'is paused. Buyers cannot see it.'}`,
      )
    },
    [currentAccount, toast],
  )

  const deleteSellerListing = useCallback(
    (idx: number) => {
      if (!currentAccount) return
      const l = currentAccount.sellerList[idx]
      if (!l) return
      confirmDlg({
        title: 'Delete this listing?',
        msg: `"${l.name}" will be removed from Tindahan. Open requests for it are not deleted.`,
        yes: 'Delete listing',
        no: 'Keep listing',
        danger: true,
        run: () => {
          setDb((prev) => ({
            ...prev,
            accounts: prev.accounts.map((a) => {
              const nextCart = a.cart.filter((c) => c.id !== l.lid)
              if (a.email !== currentAccount.email) return { ...a, cart: nextCart }
              return {
                ...a,
                cart: nextCart,
                sellerList: a.sellerList.filter((_, i) => i !== idx),
              }
            }),
            userListings: prev.userListings.filter((ul) => ul.lid !== l.lid),
            feed: prev.feed.filter(
              (f) => !(f.pid === l.lid && f.kind !== 'notice' && f.kind !== 'post'),
            ),
          }))
          toast('Listing deleted.')
        },
      })
    },
    [currentAccount, confirmDlg, toast],
  )

  const startEditListing = useCallback(
    (lid: string) => {
      if (!currentAccount) return
      const officialProd = isStaffUser ? db.official.find((x) => x.id === lid) : undefined
      const ul = db.userListings.find(
        (x) => x.lid === lid && (x.ownerEmail === currentAccount.email || isStaffUser),
      )
      if (!ul && !officialProd) {
        toast('You can only edit your own listings.')
        return
      }
      if (ul?.modHold) {
        toast(
          'This listing was removed by staff, so it cannot be edited. Contact the Office of Student Affairs.',
        )
        return
      }
      const p = officialProd || ul!.product
      const svc = isSvc(p)
      const commaIdx = (p.when || '').indexOf(',')
      const place = commaIdx > -1 ? p.when.slice(0, commaIdx) : p.when
      const win = commaIdx > -1 ? p.when.slice(commaIdx + 1).trim() : TIMES[0]
      const parsedWin = parseWindow(win) || { s: 10 * 60 + 30, e: 12 * 60 }
      const nextDraft: ListingDraft = {
        ...blankDraft(),
        type: svc ? 'service' : 'product',
        editLid: officialProd ? officialProd.id : ul!.lid,
        title: p.name,
        desc: p.desc || '',
        price: String(p.price),
        fulfillment: p.fulfillment || 'pickup',
        place: place ? place.trim() : PLACES[0],
        window: winText(parsedWin.s, parsedWin.e),
        tStart: toHM(parsedWin.s),
        tEnd: toHM(parsedWin.e),
        days: cleanDays(p.avail || 'Mon, Tue'),
        images: imgsOf(p),
        agree: false,
      }
      if (svc) {
        nextDraft.svcType = p.svcType || 'Other'
        nextDraft.unit = p.unit || 'per item'
      } else {
        nextDraft.cat = normCat(p)
        nextDraft.sub = subOf(p)
        nextDraft.cond = CONDITIONS.includes(p.cond || '') ? p.cond! : 'Brand new'
        nextDraft.qty = String(p.left)
        if (hasVars(p)) {
          nextDraft.vOn = true
          nextDraft.vAttrs = [0, 1, 2].map((k) => {
            const a = p.vars!.attrs[k]
            return {
              name: a ? a.name : k === 0 ? 'Color' : k === 1 ? 'Size' : 'Style',
              opts: a ? a.opts.slice() : [],
            }
          })
          nextDraft.vRows = p.vars!.rows.map((r) => ({
            id: r.id,
            key: JSON.stringify(r.opts),
            opts: { ...r.opts },
            qty: String(r.qty),
            price: r.price ? String(r.price) : '',
          }))
        }
      }
      setDraft(nextDraft)
      setListStep(1)
      setDraftErrs({})
      navigate('create')
    },
    [currentAccount, isStaffUser, db.official, db.userListings, toast],
  )

  const cancelEditListing = useCallback(() => {
    setDraft(blankDraft(isStaffUser, currentAccount?.windows))
    setListStep(1)
    setDraftErrs({})
    setShopTab('listings')
    navigate('shop')
  }, [])

  const saveListingDraftToAccount = useCallback(() => {
    if (!currentAccount) return
    if (draft.editLid) {
      toast('Changes are saved when you press Save changes on the last step.')
      return
    }
    const serialized = JSON.stringify({ ...draft, editLid: null })
    setDb((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.email === currentAccount.email ? { ...a, draft: serialized } : a,
      ),
    }))
    toast('Draft saved. It will be here next time you sign in.')
  }, [currentAccount, draft, toast])

  const validateDraftStep = useCallback((d: ListingDraft, step: 1 | 2): Record<string, string> => {
    const e: Record<string, string> = {}
    const whole = (v: string, lo: number, hi: number) =>
      /^\d+$/.test(String(v).trim()) && +v >= lo && +v <= hi

    if (step === 1) {
      const svc = d.type === 'service'
      if (d.title.trim().length < 3) {
        e.title = svc ? 'Give your service a name.' : 'Add a clear title (at least 3 letters).'
      } else if (d.title.trim().length > 80) {
        e.title = 'Keep the title under 80 characters.'
      }
      if (d.desc.trim().length < (svc ? 10 : 20)) {
        e.desc = svc
          ? 'Describe what you offer in a sentence or two (at least 10 characters).'
          : 'Describe the item in at least 20 characters.'
      } else if (d.desc.length > 400) {
        e.desc = 'Keep the description to 400 characters or fewer.'
      }
      const pr = Number(d.price)
      if (!(pr > 0) || pr > 1000000) {
        e.price = svc ? 'Enter your rate in pesos.' : 'Enter a price above zero.'
      }
      if (svc) {
        if (!SVC_TYPES[d.svcType]) e.svcType = 'Choose a type of service.'
        if (!SVC_UNITS.includes(d.unit)) e.unit = 'Choose how the service is charged.'
      } else {
        if (!(CATEGORIES as readonly string[]).includes(d.cat)) e.cat = 'Choose a category.'
        if (!CONDITIONS.includes(d.cond)) e.cond = 'Choose the condition.'
        if (!d.images.filter((id) => imgSrc(id)).length) e.photos = 'Add at least one photo.'
        if (!d.vOn) {
          if (!whole(d.qty, 1, VAR_LIMITS.stock)) {
            e.qty = 'Enter how many you have (a whole number from 1).'
          }
        } else {
          const rows = vSyncRows(d)
          if (!rows.length) {
            e.vars = 'Add at least one option, for example a color or a size.'
          } else {
            const bad = rows.find((r) => !whole(r.qty, 0, VAR_LIMITS.stock))
            if (bad) {
              e.vars = 'Enter a whole quantity for every variation (0 if sold out).'
            } else if (rows.some((r) => String(r.price).trim() !== '' && !(Number(r.price) > 0))) {
              e.vars = 'A variation price must be above zero, or left empty to use the main price.'
            } else if (rows.reduce((a, r) => a + +r.qty, 0) < 1) {
              e.vars = 'At least one variation needs stock.'
            }
          }
        }
      }
    } else {
      const fm = d.fulfillment || 'pickup'
      if (fm !== 'pickup' && fm !== 'delivery' && fm !== 'both') {
        e.fulfillment = 'Select which fulfillment methods are available.'
      }
      if (!d.place || !d.place.trim() || d.place.trim() === 'Others') {
        e.place = 'Please choose a campus place or write your specific location.'
      }
      const te = timeError(d)
      if (te) e.window = te
      if (!cleanDays(d.days).length) {
        e.days =
          d.type === 'service'
            ? 'Pick at least one day you are available.'
            : 'Pick at least one selling day.'
      }
    }
    return e
  }, [])

  const validateCurrentListingForSubmit = useCallback((): boolean => {
    if (!currentAccount) return false
    const e1 = validateDraftStep(draft, 1)
    const e2 = validateDraftStep(draft, 2)
    if (Object.keys(e1).length || Object.keys(e2).length) {
      setDraftErrs({ ...e1, ...e2 })
      setListStep(Object.keys(e1).length ? 1 : 2)
      toast('Some details need fixing first.')
      return false
    }
    if (/answer key|exam answer/i.test(draft.title + ' ' + draft.desc)) {
      toast('Exam answers and answer keys cannot be listed.')
      return false
    }
    if (!draft.agree) {
      setDraftErrs({ agree: 'Please confirm the statement to publish.' })
      return false
    }
    if (draft.editLid) {
      const held = db.userListings.find((x) => x.lid === draft.editLid)?.modHold
      if (held) {
        toast(
          'This listing was removed by staff, so it cannot be edited. Contact the Office of Student Affairs.',
        )
        return false
      }
    }
    return true
  }, [currentAccount, draft, validateDraftStep, db.userListings, toast])

  const submitListingStepOrPublish = useCallback(() => {
    if (!currentAccount) return
    if (listStep < 3) {
      const e = validateDraftStep(draft, listStep as 1 | 2)
      setDraftErrs(e)
      if (Object.keys(e).length) return
      setListStep((listStep + 1) as 2 | 3)
      window.scrollTo({ top: 0 })
      return
    }

    const e1 = validateDraftStep(draft, 1)
    const e2 = validateDraftStep(draft, 2)
    if (Object.keys(e1).length || Object.keys(e2).length) {
      setDraftErrs({ ...e1, ...e2 })
      setListStep(Object.keys(e1).length ? 1 : 2)
      toast('Some details need fixing first.')
      return
    }
    if (/answer key|exam answer/i.test(draft.title + ' ' + draft.desc)) {
      toast('Exam answers and answer keys cannot be listed.')
      return
    }
    if (!draft.agree) {
      setDraftErrs({ agree: 'Please confirm the statement to publish.' })
      return
    }

    if (draft.editLid) {
      const held = db.userListings.find((x) => x.lid === draft.editLid)?.modHold
      if (held) {
        toast(
          'This listing was removed by staff, so it cannot be edited. Contact the Office of Student Affairs.',
        )
        return
      }
    }

    const sMin = toMin(draft.tStart) ?? 12 * 60
    const eMin = toMin(draft.tEnd) ?? 13 * 60
    const formattedWin = winText(sMin, eMin)
    const svc = draft.type === 'service'
    const validImages = draft.images.filter((id) => imgSrc(id)).slice(0, IMG_RULES.listing)

    // A new listing belongs to Django, not to this browser's snapshot: POST it,
    // re-read the catalogue, and open the listing that was actually saved.
    // Editing an existing listing and an offline (no token) session stay local.
    if (!draft.editLid && getToken() && !publishingRef.current) {
      publishingRef.current = true
      const publish = async () => {
        try {
          const created = await createListing({
            title: draft.title,
            description: draft.desc,
            categoryName: svc ? SERVICES_CAT : draft.cat,
            listingType: svc ? 'service' : 'product',
            condition: svc
              ? 'na'
              : ['Pre-loved', 'Like new', 'Used'].includes(draft.cond)
                ? 'used'
                : 'new',
            price: Number(draft.price) || 0,
            quantity: svc ? 1 : Math.floor(Number(draft.qty) || 1),
            meetupPlace: draft.place,
            fulfillment:
              draft.fulfillment === 'pickup' ||
              draft.fulfillment === 'delivery' ||
              draft.fulfillment === 'both'
                ? draft.fulfillment
                : 'pickup',
            photos: validImages.map((id) => imgSrc(id)).filter(Boolean),
          })
          await refreshListings()
          await refreshMyListings()
          setDraft(blankDraft(isStaffUser))
          setDraftErrs({})
          setListStep(1)
          toast('Listing saved. It is checked by RTU staff before buyers can see it.')
          openProduct(API_ID_PREFIX + created.slug)
        } catch (err) {
          toast(
            err instanceof ApiRequestError
              ? err.message
              : 'The listing could not be saved. Please try again.',
          )
        } finally {
          publishingRef.current = false
        }
      }
      void publish()
      return
    }

    const buildProduct = (id: string, pub: number): PrototypeProduct => {
      const base: PrototypeProduct = {
        id,
        name: draft.title.trim(),
        price: Number(draft.price),
        cat: svc ? SERVICES_CAT : draft.cat,
        tone: svc ? SVC_TYPES[draft.svcType][0] : CAT_META[draft.cat][0],
        icon: svc ? SVC_TYPES[draft.svcType][1] : CAT_META[draft.cat][1],
        tag: svc ? 'Service' : draft.sub === 'Uniform' ? 'Uniform' : CAT_META[draft.cat][2],
        seller: sellerLabel(currentAccount),
        owner: currentAccount.email,
        when: `${draft.place}, ${formattedWin}`,
        fulfillment: draft.fulfillment || 'pickup',
        avail: cleanDays(draft.days).join(', '),
        desc: draft.desc.trim(),
        imgs: validImages,
        unit: svc ? draft.unit : 'each',
        left: svc ? 9999 : Math.floor(Number(draft.qty) || 1),
        pub,
      }
      if (svc) {
        base.kind = 'service'
        base.svcType = draft.svcType
      } else {
        base.cond = draft.cond
        if (draft.sub && (SUBCATS[draft.cat] || []).includes(draft.sub)) {
          base.sub = draft.sub
        }
        if (draft.vOn) {
          const synced = vSyncRows(draft)
          const attrs = draft.vAttrs
            .filter((a) => a.opts.length && a.name.trim())
            .map((a) => ({ name: a.name.trim(), opts: a.opts.slice() }))
          const rows = synced.map((r) => ({
            id: r.id,
            opts: { ...r.opts },
            qty: Math.max(0, Math.min(VAR_LIMITS.stock, Math.floor(+r.qty))),
            price:
              String(r.price).trim() !== '' && Number(r.price) > 0 ? Number(r.price) : null,
          }))
          base.vars = { attrs, rows }
          base.left = rows.reduce((acc, r) => acc + r.qty, 0)
        }
      }
      return base
    }

    let sentToReview = false
    const editing = !!draft.editLid

    setDb((prev) => {
      const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
      const me = next.accounts.find((a) => a.email === currentAccount.email)
      if (!me) return prev

      if (editing) {
        const offIdx = isStaffUser ? next.official.findIndex((x) => x.id === draft.editLid) : -1
        if (offIdx > -1) {
          const oldP = next.official[offIdx]
          const newP = buildProduct(oldP.id, oldP.pub || Date.now())
          const matchedType = baoMatchItemTypeForListing(next.bao, {
            cat: draft.cat,
            sub: draft.sub,
            tag: draft.sub === 'Uniform' ? 'Uniform' : '',
            name: newP.name,
          })
          newP.cat = 'Official'
          newP.category = draft.cat
          newP.sub = draft.sub || (matchedType?.sub || '')
          newP.tag =
            draft.sub === 'Uniform'
              ? 'Uniform'
              : matchedType
                ? matchedType.name
                : newP.tag
          newP.seller = 'RTU Pasig Campus Store'
          newP.onHand = newP.left
          newP.hidden = oldP.hidden
          newP.inv = {
            type: matchedType ? matchedType.id : 'ty-other',
            low: null,
            win: null,
            limit: 0,
            claimNote: '',
            ...(oldP.inv || {}),
            mig: 1,
          }
          next.official[offIdx] = newP
          const sl = me.sellerList.find((x) => x.lid === oldP.id)
          if (sl) {
            sl.name = newP.name
            sl.price = newP.price
          } else {
            me.sellerList.unshift({
              lid: newP.id,
              name: newP.name,
              status: newP.hidden ? 'Paused' : 'Active',
              views: 0,
              req: 0,
              price: newP.price,
            })
          }
          next.audit.push({
            id: 'au' + uid(),
            ts: new Date().toISOString(),
            by: me.email,
            byName: me.name,
            action: 'edit official product',
            targetType: 'official product',
            targetId: newP.id,
            targetName: newP.name,
            note: '',
          })
          me.draft = null
          return next
        }

        const ul = next.userListings.find(
          (x) => x.lid === draft.editLid && (x.ownerEmail === me.email || isStaffUser),
        )
        if (!ul) return prev
        const oldP = ul.product
        const newP = buildProduct(oldP.id, oldP.pub || 0)
        const needsReview =
          !isStaffUser &&
          ul.state === 'live' &&
          (newP.name !== oldP.name ||
            newP.desc !== oldP.desc ||
            newP.cat !== oldP.cat ||
            (newP.svcType || '') !== (oldP.svcType || '') ||
            JSON.stringify(newP.imgs) !== JSON.stringify(oldP.imgs || []))

        ul.product = newP
        const sl = me.sellerList.find((x) => x.lid === ul.lid)
        if (sl) {
          sl.name = newP.name
          sl.price = newP.price
        }
        if (needsReview) {
          sentToReview = true
          ul.state = 'review'
          if (sl) sl.status = 'Pending approval'
          let fl = next.flags.find((x) => x.lid === ul.lid)
          if (fl) {
            fl.state = 'open'
            fl.title = newP.name
            fl.price = newP.price
            fl.reason = 'Edited by the seller. Please look at it again.'
            delete fl.note
          } else {
            next.flags.unshift({
              id: `MOD-${String(++next.seq.f).padStart(3, '0')}`,
              lid: ul.lid,
              title: newP.name,
              pri: 'Routine',
              risky: false,
              price: newP.price,
              conf: 0,
              state: 'open',
              submitted: new Date().toISOString(),
              reason: 'Edited by the seller. Please look at it again.',
              seller: `${me.name} (${me.email})`,
            })
          }
          next.accounts
            .filter((a) => a.role === 'moderator')
            .forEach((a) => {
              a.notifs.unshift({
                t: `${svc ? 'Service' : 'Listing'} edited and waiting for approval: ${newP.name}.`,
                read: false,
                ts: nowT(),
                at: new Date().toISOString(),
                link: { k: 'approval', id: newP.id },
              })
            })
        }
      } else {
        if (isStaffUser && !svc) {
          const newId = 'u' + Date.now().toString(36)
          const newP = buildProduct(newId, Date.now())
          const matchedType = baoMatchItemTypeForListing(next.bao, {
            cat: draft.cat,
            sub: draft.sub,
            tag: draft.sub === 'Uniform' ? 'Uniform' : '',
            name: newP.name,
          })
          newP.cat = 'Official'
          newP.category = draft.cat
          newP.sub = draft.sub || (matchedType?.sub || '')
          newP.tag =
            draft.sub === 'Uniform'
              ? 'Uniform'
              : matchedType
                ? matchedType.name
                : newP.tag
          newP.seller = 'RTU Pasig Campus Store'
          newP.onHand = newP.left
          newP.inv = {
            type: matchedType ? matchedType.id : 'ty-other',
            low: null,
            win: null,
            limit: 0,
            claimNote: '',
            mig: 1,
          }
          if (hasVars(newP) && newP.vars) {
            newP.vars.rows.forEach((r) => {
              r.onHand = r.qty
            })
          }
          next.official.unshift(newP)
          me.sellerList.unshift({
            lid: newId,
            name: newP.name,
            status: 'Active',
            views: 0,
            req: 0,
            price: newP.price,
          })
          const nowIso = new Date().toISOString()
          if (newP.left > 0) {
            next.bao.seq.led += 1
            next.bao.ledger.push({
              id: 'L-' + String(next.bao.seq.led).padStart(5, '0'),
              ts: nowIso,
              pid: newP.id,
              item: newP.name,
              vid: '',
              label: '',
              type: 'Stock In',
              qty: newP.left,
              ohD: newP.left,
              rsD: 0,
              ticket: '',
              reason: 'Opening stock when the item was added',
              by: me.name,
              byEmail: me.email,
              after: { onHand: newP.left, reserved: 0, available: newP.left },
            })
          }
          next.feed.unshift({
            id: 'f' + ++next.seq.fd,
            kind: 'school',
            title: newP.name,
            body: newP.desc,
            price: newP.price,
            by: newP.seller,
            authorEmail: me.email,
            pid: newP.id,
            tag: newP.tag,
            left: newP.left,
            svc: false,
            ts: nowIso,
            reacts: {},
            comments: [],
          })
          next.accounts
            .filter((a) => a.role !== 'moderator')
            .forEach((a) => {
              a.notifs.unshift({
                t: 'New in the Pasig Campus Store: ' + newP.name,
                read: false,
                ts: nowT(),
                at: nowIso,
                link: { k: 'listing', id: newP.id },
              })
            })
          next.audit.push({
            id: 'au' + uid(),
            ts: nowIso,
            by: me.email,
            byName: me.name,
            action: 'add official product',
            targetType: 'official product',
            targetId: newP.id,
            targetName: newP.name,
            note: '',
          })
          me.draft = null
          return next
        }

        const lid = 'ul' + ++next.seq.l
        const newP = buildProduct(lid, isStaffUser ? Date.now() : 0)
        const risky = /vitamin|gummies|medicine|vape|ticket|exam answer|answer key/i.test(
          newP.name + ' ' + newP.desc,
        )
        const flagId = `MOD-${String(++next.seq.f).padStart(3, '0')}`
        const ul: UserListingRecord = {
          lid,
          ownerEmail: me.email,
          state: isStaffUser ? 'live' : 'review',
          paused: false,
          product: newP,
        }
        next.userListings.push(ul)
        me.sellerList.unshift({
          lid,
          name: newP.name,
          status: isStaffUser ? 'Active' : 'Pending approval',
          views: 0,
          req: 0,
          price: newP.price,
        })
        next.flags.unshift({
          id: flagId,
          lid,
          title: newP.name,
          pri: risky ? 'Medium priority' : 'Routine',
          risky: isStaffUser ? false : risky,
          price: newP.price,
          conf: risky ? 62 : 0,
          state: isStaffUser ? 'approved' : 'open',
          submitted: new Date().toISOString(),
          decidedAt: isStaffUser ? new Date().toISOString() : undefined,
          note: isStaffUser ? 'Posted by staff' : undefined,
          reason: isStaffUser
            ? 'Posted by an RTU staff account. Approved automatically.'
            : risky
              ? 'Automatic screening found a keyword that needs a careful look before this goes live.'
              : `New ${svc ? 'service' : 'listing'}. Automatic screening found nothing risky.`,
          seller: `${me.name} (${me.email})`,
        })
        if (isStaffUser) {
          next.feed.unshift({
            id: 'f' + ++next.seq.fd,
            kind: 'school',
            title: newP.name,
            body: newP.desc,
            price: newP.price,
            by: newP.seller,
            authorEmail: me.email,
            pid: newP.id,
            tag: newP.tag,
            left: newP.left,
            svc,
            ts: new Date().toISOString(),
            reacts: {},
            comments: [],
          })
        } else {
          next.accounts
            .filter((a) => a.role === 'moderator')
            .forEach((a) => {
              a.notifs.unshift({
                t: `New ${svc ? 'service' : 'listing'} waiting for approval: ${newP.name}.`,
                read: false,
                ts: nowT(),
                at: new Date().toISOString(),
                link: { k: 'approval', id: lid },
              })
            })
        }
      }
      me.draft = null
      return next
    })

    setDraft(blankDraft(isStaffUser, currentAccount?.windows))
    setListStep(1)
    setDraftErrs({})
    setShopTab('listings')
    navigate('shop')
    toast(
      editing
        ? sentToReview
          ? 'Saved. Staff will check the changes before it shows again.'
          : 'Changes saved.'
        : isStaffUser
          ? `Published. Staff ${svc ? 'services' : 'listings'} go live right away.`
          : 'Submitted. Staff will check it before it appears on Tindahan.',
    )
  }, [currentAccount, listStep, draft, validateDraftStep, db.userListings, isStaffUser, toast])

  const toggleChecklist = useCallback(
    (key: 'profile' | 'pickup' | 'rules', checked?: boolean) => {
      if (!currentAccount) return
      setDb((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => {
          if (a.email !== currentAccount.email) return a
          const nextVal = checked !== undefined ? checked : !a.checklist[key]
          return {
            ...a,
            checklist: { ...a.checklist, [key]: nextVal },
          }
        }),
      }))
    },
    [currentAccount],
  )

  const continueSellerSetup = useCallback(() => {
    if (!currentAccount) return
    const keys: ('profile' | 'pickup' | 'rules')[] = ['profile', 'pickup', 'rules']
    const nextUnchecked = keys.find((k) => !currentAccount.checklist[k])
    if (!nextUnchecked) {
      navigate('create')
      return
    }
    if (nextUnchecked === 'rules') {
      toggleChecklist('rules', true)
      setActiveModal({ kind: 'rules' })
    } else {
      toggleChecklist(nextUnchecked, true)
      toast('Step done. Nice work.')
    }
  }, [currentAccount, toggleChecklist, toast])

  // Profile & Notifications
  const toggleSellingWindow = useCallback(
    (day: string) => {
      if (!currentAccount) return
      setDb((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => {
          if (a.email !== currentAccount.email) return a
          const has = a.windows.includes(day)
          const nextWin = cleanDays(has ? a.windows.filter((d) => d !== day) : [...a.windows, day])
          return { ...a, windows: nextWin }
        }),
      }))
    },
    [currentAccount],
  )

  const saveProfile = useCallback(
    async (
      name: string,
      prog: string,
      newAvatarId: string | null,
      removeAvatar: boolean,
      yearLevel?: number | null,
      contactNumber?: string,
      profilePhotoFile?: File | null,
    ): Promise<boolean> => {
      if (!currentAccount) return false
      const cleanName = name.trim().replace(/\s+/g, ' ')
      const parts = cleanName.split(' ')
      const first = tc(parts[0] || '')
      const last = tc(parts.slice(1).join(' '))
      const formattedName = `${first} ${last}`.trim()

      // Call real Django backend PATCH /api/v1/auth/me/ if connected with a real token
      const token = getToken()
      if (token && token !== 'demo-token' && token !== 'demo-student-token') {
        try {
          const baseUrl =
            (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
            'http://localhost:8000/api/v1'
          if (profilePhotoFile) {
            const fd = new FormData()
            fd.append('display_name', formattedName)
            fd.append('college', prog)
            if (yearLevel != null) fd.append('year_level', String(yearLevel))
            if (contactNumber !== undefined) fd.append('contact_number', contactNumber.trim())
            fd.append('profile_photo', profilePhotoFile)
            await fetch(`${baseUrl}/auth/me/`, {
              method: 'PATCH',
              headers: {
                Accept: 'application/json',
                Authorization: `Token ${token}`,
              },
              body: fd,
            })
          } else {
            await apiFetch<User>('/auth/me/', {
              method: 'PATCH',
              body: {
                display_name: formattedName,
                college: prog,
                ...(yearLevel !== undefined ? { year_level: yearLevel } : {}),
                ...(contactNumber !== undefined ? { contact_number: contactNumber.trim() } : {}),
                ...(removeAvatar ? { profile_photo: null } : {}),
              },
            })
          }
        } catch {
          // If backend server is unreachable in offline dev, still update local state cleanly
        }
      }

      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const me = next.accounts.find((a) => a.email === currentAccount.email)
        if (!me) return prev
        const oldAv = me.avatar
        me.first = first
        me.last = last
        me.name = formattedName
        me.prog = prog
        if (newAvatarId && imgSrc(newAvatarId)) {
          me.avatar = newAvatarId
          if (oldAv && oldAv !== newAvatarId) removeImg(oldAv)
        } else if (removeAvatar && oldAv) {
          removeImg(oldAv)
          me.avatar = null
        }
        next.userListings
          .filter((l) => l.ownerEmail === me.email)
          .forEach((l) => {
            l.product.seller = sellerLabel(me)
          })
        return next
      })
      bumpImgVersion()
      toast('Profile updated.')
      return true
    },
    [currentAccount, bumpImgVersion, toast],
  )

  const markAllNotifsRead = useCallback(() => {
    if (!currentAccount) return
    setDb((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.email === currentAccount.email
          ? { ...a, notifs: a.notifs.map((n) => ({ ...n, read: true })) }
          : a,
      ),
    }))
    void markAllNotificationsRead()
      .then(() => refreshNotifications())
      .catch(() => {
        /* offline: the local badge is already clear; the next poll corrects it */
      })
  }, [currentAccount, refreshNotifications])

  const openNotification = useCallback(
    (index: number) => {
      if (!currentAccount) return
      const notif = currentAccount.notifs[index]
      if (!notif) return
      setDb((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.email === currentAccount.email
            ? {
                ...a,
                notifs: a.notifs.map((n, i) => (i === index ? { ...n, read: true } : n)),
              }
            : a,
        ),
      }))
      const apiId = apiNotificationId(notif.id)
      if (apiId !== null) {
        void markNotificationsRead([apiId]).catch(() => {
          /* offline: the next poll restores the unread dot */
        })
      }
      const L: NotificationLink | null | undefined = notif.link
      if (!L) return
      switch (L.k) {
        case 'order': {
          const o = currentAccount.orders.find((x) => x.id === L.id)
          if (!o) return toast('That order is no longer available.')
          setOrderTab(isRequestingOrder(o) ? 'Requesting' : isForPickupOrder(o) ? 'For Pickup' : o.tab === 'Active' ? 'Requesting' : o.tab)
          setSelectedOrderId(o.id)
          navigate('orders')
          return
        }
        case 'request': {
          const r = currentAccount.sellerReq.find((x) => x.orderId === L.id)
          if (!r) return toast('That request is no longer available.')
          setShopTab('orders')
          navigate('shop')
          return
        }
        case 'baostock':
          if (!isStaffUser) return toast('That page is for RTU staff accounts only.')
          navigate('baostock')
          return
        case 'shop':
          setShopTab('orders')
          navigate('shop')
          return
        case 'baoorders':
        case 'txn':
          if (!isStaffUser) return toast('That page is for RTU staff accounts only.')
          setBaoSearch(L.id || '')
          setBaoStatusFilter('')
          setBaoTab('list')
          navigate('baoorders')
          return
        case 'listing': {
          const p = byId(L.id)
          if (!p) return toast('This listing is no longer available.')
          if (allOnSale.some((x) => x.id === p.id)) {
            openProduct(p.id)
            return
          }
          if (p.owner === currentAccount.email) {
            setShopTab('listings')
            navigate('shop')
            return
          }
          toast('This listing is not available right now.')
          return
        }
        case 'message': {
          const c = db.conv.find((x) => x.id === L.id || (x.alias || []).includes(L.id || ''))
          if (!c) return toast('That conversation is not available.')
          setSelectedConvId(c.id)
          navigate('messages')
          return
        }
        case 'post': {
          const f = db.feed.find((x) => x.id === L.id)
          if (!f || (f.hidden && !isStaffUser && f.authorEmail !== currentAccount.email)) {
            return toast('That forum post is no longer available.')
          }
          openPost(f.id)
          return
        }
        case 'approval': {
          if (!isStaffUser) return toast('That page is for RTU staff accounts only.')
          const fl = db.flags.find((x) => x.lid === L.id)
          if (fl) {
            setModTab(fl.state === 'open' ? 'open' : 'done')
            setSelectedFlagId(fl.id)
          }
          navigate('moderation')
          return
        }
        case 'freports':
          if (!isStaffUser) return toast('That page is for RTU staff accounts only.')
          navigate('forum-reports')
          return
        case 'reviews':
          setShopTab('reviews')
          navigate('shop')
          return
        case 'forum':
          navigate('forum')
          return
      }
    },
    [currentAccount, isStaffUser, byId, allOnSale, openProduct, db.conv, db.feed, db.flags, openPost, toast],
  )

  // Reviews
  const orderRateable = useCallback(
    (o: OrderRecord): boolean => {
      if (!currentAccount || !o || o.buyerEmail !== currentAccount.email) return false
      if (o.status !== 'Completed' || o.tab !== 'Completed') return false
      if (o.sellerEmail && o.sellerEmail === currentAccount.email) return false
      // A server order's status came from the seller's own transition, so it is
      // already proof of a completed pickup. A prototype-only order still needs
      // its local transaction to say Completed.
      const onServer =
        apiOrders.some((row) => row.reference === o.id) || /^ORD-\d{6}-\d{3}$/.test(o.id)
      if (onServer) return true
      const t = db.txn.find((x) => x.orderId === o.id)
      return !!t && t.status === 'Completed'
    },
    [apiOrders, currentAccount, db.txn],
  )

  const reviewOf = useCallback(
    (kind: 'seller' | 'item', orderId: string, pid = ''): ReviewRecord | undefined => {
      if (!currentAccount) return undefined
      const key = kind === 'seller' ? `seller:${orderId}` : `item:${orderId}:${pid}`
      return db.reviews.find((r) => r.key === key && r.buyerEmail === currentAccount.email)
    },
    [currentAccount, db.reviews],
  )

  const submitReview = useCallback(
    (kind: 'seller' | 'item', orderId: string, pid: string, stars: number, text: string): boolean => {
      if (!currentAccount) return false
      const o = currentAccount.orders.find((x) => x.id === orderId)
      if (!o || !orderRateable(o)) {
        toast('You can rate an order after the pickup is completed.')
        return false
      }
      if (kind === 'item' && !(o.lines || []).some((l) => l.pid === pid)) {
        toast('That item is not part of this order.')
        return false
      }
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
        toast('Tap 1 to 5 stars first.')
        return false
      }
      const key = kind === 'seller' ? `seller:${orderId}` : `item:${orderId}:${pid}`
      const cleanText = String(text || '').trim().slice(0, 500)
      const sellerKey = o.sellerEmail || 'official'
      const previous = db.reviews.find(
        (r) => r.key === key && r.buyerEmail === currentAccount.email,
      )
      const isUpdate = Boolean(previous)

      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const existing = next.reviews.find(
          (r) => r.key === key && r.buyerEmail === currentAccount.email,
        )
        if (existing) {
          existing.stars = stars
          existing.text = cleanText
          existing.edited = Date.now()
        } else {
          next.reviews.push({
            id: 'r' + uid(),
            key,
            kind,
            orderId,
            pid: kind === 'item' ? pid : '',
            sellerKey,
            sellerName: o.seller,
            buyerEmail: currentAccount.email,
            buyerName: shortName(currentAccount.name),
            stars,
            text: cleanText,
            ts: Date.now(),
            edited: null,
          })
          if (o.sellerEmail) {
            const ow = next.accounts.find((a) => a.email === o.sellerEmail)
            if (ow) {
              ow.notifs.unshift({
                t: `${shortName(currentAccount.name)} rated you ${stars} of 5 stars for order ${o.id}.`,
                read: false,
                ts: nowT(),
                at: new Date().toISOString(),
                link: { k: 'reviews' },
              })
            }
          }
        }
        return next
      })
      toast(isUpdate ? 'Rating updated.' : 'Thanks! Your rating was saved.')

      // Server orders have a row to write; a prototype-only order cannot leave
      // the browser, so it keeps its local review.
      const listingId =
        kind === 'item'
          ? (byId(pid)?.apiListingId ??
            o.lines?.find((l) => l.pid === pid)?.apiListingId ??
            null)
          : null
      const onServer =
        apiOrders.some((row) => row.reference === orderId) ||
        /^ORD-\d{6}-\d{3}$/.test(orderId)
      if (onServer && (kind === 'seller' || listingId !== null)) {
        void postReview(orderId, listingId, stars, cleanText)
          .then(() => refreshReviews())
          .catch((err) => {
            // Drop the optimistic row; the next fetch restores whatever the
            // server still has (the previous rating, if this was an edit).
            setDb((prev) => ({
              ...prev,
              reviews: prev.reviews.filter(
                (r) => !(r.key === key && r.buyerEmail === currentAccount.email),
              ),
            }))
            void refreshReviews()
            toast(
              err instanceof ApiRequestError
                ? err.message
                : 'That rating could not be saved.',
            )
          })
      }
      return true
    },
    [apiOrders, byId, currentAccount, db.reviews, orderRateable, refreshReviews, toast],
  )

  const confirmDeleteReview = useCallback(
    (reviewId: string) => {
      if (!currentAccount) return
      const rev = db.reviews.find((r) => r.id === reviewId)
      if (!rev || (rev.buyerEmail !== currentAccount.email && !isStaffUser)) {
        toast('You can only delete your own review.')
        return
      }
      const own = rev.buyerEmail === currentAccount.email
      confirmDlg({
        title: own ? 'Delete your review?' : 'Remove this review?',
        msg: own
          ? 'Your rating and comment for this item will be removed. You can write a new one later.'
          : 'The rating and comment will be removed for everyone. The buyer is told.',
        yes: own ? 'Delete review' : 'Remove review',
        no: 'Keep it',
        danger: true,
        run: () => {
          setDb((prev) => {
            const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
            const idx = next.reviews.findIndex((r) => r.id === reviewId)
            if (idx < 0) return prev
            const target = next.reviews[idx]
            next.reviews.splice(idx, 1)
            if (target.buyerEmail !== currentAccount.email) {
              const buyer = next.accounts.find((a) => a.email === target.buyerEmail)
              if (buyer) {
                buyer.notifs.unshift({
                  t: 'A staff member removed one of your reviews because it did not follow the community guidelines.',
                  read: false,
                  ts: nowT(),
                  at: new Date().toISOString(),
                  link: null,
                })
              }
            }
            return next
          })
          toast('Review removed.')

          // Server rows have numeric ids; a prototype-only review starts 'r'.
          if (/^\d+$/.test(String(rev.id))) {
            void deleteApiReview(Number(rev.id))
              .then(() => refreshReviews())
              .catch((err) => {
                // The removal was optimistic: re-read so a refusal is visible.
                void refreshReviews()
                toast(
                  err instanceof ApiRequestError
                    ? err.message
                    : 'That review could not be removed.',
                )
              })
          }
        },
      })
    },
    [confirmDlg, currentAccount, db.reviews, isStaffUser, refreshReviews, toast],
  )

  // Messages
  const convCan = useCallback(
    (c: Conversation, acct: PrototypeAccount | null): boolean => {
      if (!c || !acct) return false
      if (c.buyer === acct.email || c.seller === acct.email) return true
      return !c.seller && isStaffUser
    },
    [isStaffUser],
  )

  const myConversations = useMemo(() => {
    if (!currentAccount) return []
    return db.conv
      .filter((c) => convCan(c, currentAccount))
      .sort((a, b) => String(b.last).localeCompare(String(a.last)))
  }, [db.conv, currentAccount, convCan])

  const unreadInConv = useCallback(
    (c: Conversation): number => {
      if (!currentAccount) return 0
      const seen = (c.seen && c.seen[currentAccount.email]) || 0
      const pool = !c.seller && isStaffUser
      return c.msgs.filter(
        (m, i) =>
          (i >= seen || (m.un && m.un.includes(currentAccount.email))) &&
          m.from !== currentAccount.email &&
          !(pool && m.staff),
      ).length
    },
    [currentAccount, isStaffUser],
  )

  const unreadMessagesCount = useMemo(() => {
    return myConversations.reduce((sum, c) => sum + unreadInConv(c), 0)
  }, [myConversations, unreadInConv])

  const markConvRead = useCallback(
    (convId: string) => {
      if (!currentAccount) return
      const apiConvId = apiConversationId(convId)
      if (apiConvId !== null) {
        void markConversationRead(apiConvId)
          .then(() => refreshConversations())
          .catch(() => {
            /* offline: the unread badge simply stays */
          })
        return
      }
      setDb((prev) => {
        const c = prev.conv.find((x) => x.id === convId)
        if (!c || unreadInConv(c) === 0) return prev
        return {
          ...prev,
          conv: prev.conv.map((item) => {
            if (item.id !== convId) return item
            return {
              ...item,
              seen: { ...item.seen, [currentAccount.email]: item.msgs.length },
              msgs: item.msgs.map((m) =>
                m.un
                  ? { ...m, un: m.un.filter((e) => e !== currentAccount.email) }
                  : m,
              ),
            }
          }),
        }
      })
    },
    [currentAccount, unreadInConv],
  )

  const startProductConversation = useCallback(
    (productId: string, text: string): boolean => {
      if (!currentAccount) return false
      const cleanText = text.trim()
      if (!cleanText) {
        toast('Write a short message first.')
        return false
      }
      const p = byId(productId)
      if (!p) {
        toast('This listing is no longer available.')
        return false
      }
      if (p.owner && p.owner === currentAccount.email) {
        toast('That is your own listing.')
        return false
      }
      if (isStaffUser && !p.owner) {
        toast('You manage this official product. Reply to buyers from Messages.')
        return false
      }
      // A catalogue seller is a real member: open the server thread so the
      // message actually reaches them.
      const owner = p.owner || ''
      if (owner.includes('@') && p.apiListingId) {
        void (async () => {
          try {
            const conversation = await openConversation({
              sellerEmail: owner,
              listingSlug: p.id.replace(/^api:/, ''),
            })
            if (cleanText) await postChatMessage(conversation.id, cleanText)
            await refreshConversations()
            setSelectedConvId(`api:cv-${conversation.id}`)
            navigate('messages')
          } catch (err) {
            toast(
              err instanceof ApiRequestError
                ? err.message
                : 'That message could not be sent.',
            )
          }
        })()
        return true
      }
      const type: 'product' | 'service' = isSvc(p) ? 'service' : 'product'
      let targetConvId = ''
      const now = new Date().toISOString()

      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const pk = pairKey(currentAccount.email, p.owner || null)
        let c = next.conv.find((x) => pairKey(x.buyer, x.seller) === pk)
        const ref: MessageRef = { type, id: p.id, name: p.name, pid: p.id }
        if (!c) {
          c = {
            id: 'cv' + ++next.seq.cv,
            buyer: currentAccount.email,
            buyerName: currentAccount.name,
            seller: p.owner || null,
            sellerName: p.owner ? p.seller : 'RTU Pasig Campus Store',
            ref,
            msgs: [],
            last: now,
            created: now,
            seen: {},
          }
          next.conv.push(c)
        }
        targetConvId = c.id
        c.msgs.push({
          id: uid(),
          from: currentAccount.email,
          name: currentAccount.name,
          staff: false,
          text: cleanText,
          ts: now,
          ref,
        })
        c.ref = ref
        c.last = now
        c.seen[currentAccount.email] = c.msgs.length

        const recipients = p.owner
          ? next.accounts.filter((a) => a.email === p.owner)
          : next.accounts.filter((a) => a.role === 'moderator')
        recipients.forEach((r) => {
          if (r.email !== currentAccount.email) {
            r.notifs.unshift({
              t: `New message from ${currentAccount.name} about ${p.name}.`,
              read: false,
              ts: nowT(),
              at: now,
              link: { k: 'message', id: c!.id },
            })
          }
        })
        return next
      })

      setTimeout(() => {
        if (targetConvId) {
          setSelectedConvId(targetConvId)
          playMessage()
          navigate('messages')
          toast('Message sent. You can continue the chat in Messages.')
        }
      }, 0)
      return true
    },
    [currentAccount, byId, isStaffUser, toast],
  )

  const sendOrderMessage = useCallback(
    (orderId: string, text: string, navigateToMessages = true): boolean => {
      if (!currentAccount) return false
      const cleanText = text.trim()
      if (!cleanText) return false
      const o = currentAccount.orders.find((x) => x.id === orderId)
      if (!o) return false

      // A request that lives on the server has a server thread. Writing this
      // into the local snapshot instead invented a partner called "RTU Pasig
      // Campus Store" that nobody could answer.
      const remote = apiOrders.find((row) => row.reference === orderId)
      if (remote) {
        const asBuyer = remote.buyer_email === currentAccount.email
        void (async () => {
          try {
            const conversation = await openConversation({
              ...(asBuyer
                ? { sellerEmail: remote.seller_email }
                : { buyerEmail: remote.buyer_email }),
              listingSlug: remote.lines[0]?.listing_slug || null,
            })
            await postChatMessage(conversation.id, cleanText)
            await refreshConversations()
            if (navigateToMessages) {
              setSelectedConvId(`api:cv-${conversation.id}`)
              navigate('messages')
            }
          } catch (err) {
            toast(
              err instanceof ApiRequestError
                ? err.message
                : 'That message could not be sent.',
            )
          }
        })()
        return true
      }

      let targetConvId = ''
      const now = new Date().toISOString()

      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const pk = pairKey(o.buyerEmail, o.sellerEmail || null)
        let c = next.conv.find((x) => pairKey(x.buyer, x.seller) === pk)
        const pid = o.lines && o.lines[0] ? o.lines[0].pid : null
        const ref: MessageRef = { type: 'order', id: o.id, name: o.title, pid }
        if (!c) {
          c = {
            id: 'cv' + ++next.seq.cv,
            buyer: o.buyerEmail,
            buyerName: currentAccount.name,
            seller: o.sellerEmail || null,
            sellerName: o.sellerEmail ? o.seller : 'RTU Pasig Campus Store',
            ref,
            msgs: [],
            last: now,
            created: now,
            seen: {},
          }
          next.conv.push(c)
        }
        targetConvId = c.id
        const staffSend = isStaffUser && currentAccount.email !== c.buyer && !c.seller
        c.msgs.push({
          id: uid(),
          from: currentAccount.email,
          name: staffSend ? 'RTU Pasig Campus Store' : currentAccount.name,
          staff: staffSend,
          text: cleanText,
          ts: now,
          ref,
        })
        c.ref = ref
        c.last = now
        c.seen[currentAccount.email] = c.msgs.length

        const recipients =
          currentAccount.email === c.buyer
            ? c.seller
              ? next.accounts.filter((a) => a.email === c!.seller)
              : next.accounts.filter((a) => a.role === 'moderator')
            : next.accounts.filter((a) => a.email === c!.buyer)

        recipients.forEach((r) => {
          if (r.email !== currentAccount.email) {
            r.notifs.unshift({
              t: `New message from ${staffSend ? 'the Official RTU Store' : currentAccount.name} about ${o.title}.`,
              read: false,
              ts: nowT(),
              at: now,
              link: { k: 'message', id: c!.id },
            })
          }
        })
        return next
      })

      if (navigateToMessages) {
        setTimeout(() => {
          if (targetConvId) {
            setSelectedConvId(targetConvId)
            navigate('messages')
            toast('Message sent.')
          }
        }, 0)
      }
      return true
    },
    [
      currentAccount,
      isStaffUser,
      toast,
      apiOrders,
      refreshConversations,
    ],
  )

  const openSellerRequestChat = useCallback(
    (reqId: string) => {
      if (!currentAccount) return
      const r = currentAccount.sellerReq.find((x) => x.id === reqId)
      if (!r) return
      const buyer = acctByEmail(r.buyerEmail)
      if (!buyer) {
        toast('That buyer account is no longer available.')
        return
      }
      let targetConvId = ''
      const now = new Date().toISOString()

      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const pk = pairKey(r.buyerEmail, currentAccount.email)
        let c = next.conv.find((x) => pairKey(x.buyer, x.seller) === pk)
        if (!c) {
          c = {
            id: 'cv' + ++next.seq.cv,
            buyer: buyer.email,
            buyerName: buyer.name,
            seller: currentAccount.email,
            sellerName: currentAccount.name,
            ref: { type: 'order', id: r.orderId, name: r.what, pid: null },
            msgs: [],
            last: now,
            created: now,
            seen: {},
          }
          next.conv.push(c)
        }
        targetConvId = c.id
        return next
      })

      setTimeout(() => {
        if (targetConvId) {
          setSelectedConvId(targetConvId)
          navigate('messages')
        }
      }, 0)
    },
    [currentAccount, acctByEmail, toast],
  )

  const sendChatMessage = useCallback(
    (convId: string, text: string): boolean => {
      if (!currentAccount) return false
      const cleanText = text.trim()
      if (!cleanText) {
        toast('Write a message first.')
        return false
      }
      const c = db.conv.find((x) => x.id === convId)
      if (!c || !convCan(c, currentAccount)) {
        toast('You can only write in your own conversations.')
        return false
      }
      const apiConvId = apiConversationId(convId)
      if (apiConvId !== null) {
        void postChatMessage(apiConvId, cleanText)
          .then(() => refreshConversations())
          .catch((err: unknown) => {
            toast(
              err instanceof ApiRequestError
                ? err.message
                : 'The message could not be sent.',
            )
          })
        return true
      }
      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const target = next.conv.find((x) => x.id === convId)
        if (!target) return prev
        const staffSend = isStaffUser && currentAccount.email !== target.buyer && !target.seller
        target.msgs.push({
          id: uid(),
          from: currentAccount.email,
          name: staffSend ? 'RTU Pasig Campus Store' : currentAccount.name,
          staff: staffSend,
          text: cleanText,
          ts: now,
          ref: target.ref ? { ...target.ref } : null,
        })
        target.last = now
        target.seen[currentAccount.email] = target.msgs.length

        const recipients =
          currentAccount.email === target.buyer
            ? target.seller
              ? next.accounts.filter((a) => a.email === target.seller)
              : next.accounts.filter((a) => a.role === 'moderator')
            : next.accounts.filter((a) => a.email === target.buyer)

        recipients.forEach((r) => {
          if (r.email !== currentAccount.email) {
            r.notifs.unshift({
              t: `New message from ${staffSend ? 'the Official RTU Store' : currentAccount.name} about ${target.ref.name}.`,
              read: false,
              ts: nowT(),
              at: now,
              link: { k: 'message', id: target.id },
            })
          }
        })
        return next
      })
      return true
    },
    [currentAccount, db.conv, convCan, isStaffUser, toast],
  )

  const reactToChatMessage = useCallback(
    (convId: string, msgIdx: number, emoji: string) => {
      if (!currentAccount) return
      playPop()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const target = next.conv.find((x) => x.id === convId || (x.alias || []).includes(convId))
        if (!target || !target.msgs || !target.msgs[msgIdx]) return prev
        const m = target.msgs[msgIdx]
        if (!m.reacts) m.reacts = {}
        if (m.reacts[currentAccount.email] === emoji) {
          delete m.reacts[currentAccount.email]
        } else {
          m.reacts[currentAccount.email] = emoji
        }
        return next
      })
    },
    [currentAccount],
  )

  const openContextOrder = useCallback(
    (orderId: string, convId: string) => {
      if (!currentAccount) return
      const c = db.conv.find((x) => x.id === convId)
      if (!c || !convCan(c, currentAccount)) {
        toast('You can only open your own conversations.')
        return
      }
      const o = currentAccount.orders.find((x) => x.id === orderId)
      if (o) {
        setOrderTab(isRequestingOrder(o) ? 'Requesting' : isForPickupOrder(o) ? 'For Pickup' : o.tab === 'Active' ? 'Requesting' : o.tab)
        setSelectedOrderId(o.id)
        navigate('orders')
        return
      }
      if (currentAccount.sellerReq.some((r) => r.orderId === orderId)) {
        setShopTab('orders')
        navigate('shop')
        return
      }
      if (isStaffUser && db.txn.some((t) => t.orderId === orderId)) {
        navigate('transactions')
        return
      }
      toast('That order is no longer available.')
    },
    [currentAccount, db.conv, db.txn, convCan, isStaffUser, toast],
  )

  // Forum actions
  const createForumPost = useCallback(
    (
      title: string,
      body: string,
      topic: string,
      asNotice: boolean,
      imgs: string[],
      schedule?: { date: string; start: string; end?: string; place: string },
    ): boolean => {
      if (!currentAccount) return false
      const cleanTitle = title.trim().slice(0, 120)
      const cleanBody = body.trim().slice(0, 2000)
      const validImgs = imgs.filter((id) => imgSrc(id)).slice(0, IMG_RULES.post)
      if (!cleanTitle && !cleanBody && !validImgs.length) {
        toast('Write something or add a photo first.')
        return false
      }
      const kind = isStaffUser && asNotice ? 'notice' : 'post'
      // The composer stores photos as data URLs; the backend turns them into
      // media files. Anything that is not a data URL cannot be uploaded.
      const images = validImgs
        .map((id) => imgSrc(id))
        .filter((src) => src.startsWith('data:image/'))
        .slice(0, 4)

      void createForumPostApi({
        kind,
        topic: topic || 'General',
        title: cleanTitle,
        body: cleanBody,
        images,
        // CF-05: the server refuses a selling schedule without these, so the
        // form sends exactly what it validated.
        ...(schedule
          ? {
              event_date: schedule.date,
              event_start: schedule.start,
              event_end: schedule.end || null,
              event_place: schedule.place,
            }
          : {}),
      })
        .then(async () => {
          await Promise.all([
            refreshForum(),
            kind === 'notice' ? refreshAnnouncements() : Promise.resolve(),
          ])
          toast(
            kind === 'notice'
              ? 'Notice posted. It appears in Announcements and every member was notified.'
              : 'Posted to the forum.',
          )
        })
        .catch((err) =>
          toast(err instanceof ApiRequestError ? err.message : 'That post could not be saved.'),
        )
      return true
    },
    [currentAccount, isStaffUser, refreshForum, toast],
  )

  const editForumPost = useCallback(
    (postId: string, title: string, body: string): boolean => {
      if (!currentAccount) return false
      const f = db.feed.find((x) => x.id === postId)
      if (!f || f.kind !== 'post' || f.authorEmail !== currentAccount.email) {
        toast('You can only edit your own posts.')
        return false
      }
      if (f.hidden) {
        toast('Staff hid this post, so it cannot be edited.')
        return false
      }
      const cleanTitle = title.trim().slice(0, 120)
      const cleanBody = body.trim().slice(0, 2000)
      if (!cleanTitle && !cleanBody && !(f.imgs || []).length) {
        return false
      }
      const apiId = apiForumId(postId)
      if (apiId !== null) {
        void updateForumPostApi(apiId, { title: cleanTitle, body: cleanBody })
          .then(async () => {
            await refreshForum()
            toast('Post updated.')
          })
          .catch((err) =>
            toast(err instanceof ApiRequestError ? err.message : 'That post could not be saved.'),
          )
        return true
      }
      const changed = cleanTitle !== (f.title || '') || cleanBody !== (f.body || '')
      if (changed) {
        setDb((prev) => ({
          ...prev,
          feed: prev.feed.map((p) =>
            p.id === postId
              ? { ...p, title: cleanTitle, body: cleanBody, edited: new Date().toISOString() }
              : p,
          ),
        }))
      }
      toast(changed ? 'Post updated.' : 'No changes to save.')
      return true
    },
    [currentAccount, db.feed, refreshForum, toast],
  )

  const deleteForumPost = useCallback(
    (postId: string) => {
      if (!currentAccount) return
      const f = db.feed.find((x) => x.id === postId)
      if (!f || !(isStaffUser || f.authorEmail === currentAccount.email)) {
        toast('You can only delete your own posts.')
        return
      }
      const liveCm = f.comments.filter((c) => !c.deleted && !c.hidden).length
      const extra = `${liveCm ? ` its ${liveCm} comment${liveCm === 1 ? '' : 's'},` : ''}${(f.imgs || []).length ? ' its photos,' : ''} and its reactions`
      confirmDlg({
        title: 'Delete this post?',
        msg:
          (isStaffUser && f.authorEmail !== currentAccount.email
            ? 'This removes the post,'
            : 'Your post,') +
          extra +
          ' will be deleted for everyone. This cannot be undone.',
        yes: 'Delete post',
        no: 'Keep it',
        danger: true,
        run: () => {
          const apiId = apiForumId(postId)
          if (apiId !== null) {
            void deleteForumPostApi(apiId)
              .then(async () => {
                await refreshForum()
                // The post page has nothing left to render once its row is
                // gone, so leave it even if the page never set selectedPostId.
                navigate('forum')
                toast('Post deleted.')
              })
              .catch((err) => {
                void refreshForum()
                toast(
                  err instanceof ApiRequestError
                    ? err.message
                    : 'That post could not be deleted.',
                )
              })
            return
          }
          const now = new Date().toISOString()
          setDb((prev) => {
            const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
            const target = next.feed.find((x) => x.id === postId)
            if (!target) return prev
            const staffDel = isStaffUser && target.authorEmail !== currentAccount.email
            if (staffDel) {
              next.modlog.unshift({
                id: 'm' + uid(),
                ts: now,
                by: currentAccount.name,
                byEmail: currentAccount.email,
                kind: 'delete',
                type: 'post',
                postId: target.id,
                reportId: null,
                targetName: target.by || 'RTU',
                note: '',
                outcome: 'Post deleted by staff',
              })
              next.audit.push({
                id: 'au' + uid(),
                ts: now,
                by: currentAccount.email,
                byName: currentAccount.name,
                action: 'delete forum post',
                targetType: 'forum post',
                targetId: target.id,
                targetName: target.by || 'RTU',
                note: 'Post deleted by staff',
              })
              next.freports
                .filter((r) => r.status === 'open' && r.postId === target.id)
                .forEach((r) => {
                  r.status = 'actioned'
                  r.action = 'delete'
                  r.handledBy = currentAccount.name
                  r.handledAt = now
                })
              if (target.authorEmail) {
                const author = next.accounts.find((a) => a.email === target.authorEmail)
                if (author) {
                  author.notifs.unshift({
                    t: 'A moderator removed your forum post.',
                    read: false,
                    ts: nowT(),
                    at: now,
                    link: null,
                  })
                }
              }
            }
            next.feed = next.feed.filter((x) => x.id !== postId)
            if (target.aid) {
              next.ann = next.ann.filter((a) => a.id !== target.aid)
            }
            return next
          })
          if (selectedPostId === postId) navigate('forum')
          toast('Post deleted.')
        },
      })
    },
    [currentAccount, db.feed, isStaffUser, confirmDlg, selectedPostId, toast],
  )

  const toggleForumReaction = useCallback(
    (postId: string, react: ReactionKey) => {
      if (!currentAccount) return
      setDb((prev) => ({
        ...prev,
        feed: prev.feed.map((f) => {
          if (f.id !== postId) return f
          const nextReacts = { ...f.reacts }
          if (nextReacts[currentAccount.email] === react) {
            delete nextReacts[currentAccount.email]
          } else {
            nextReacts[currentAccount.email] = react
          }
          return { ...f, reacts: nextReacts }
        }),
      }))
      const apiId = apiForumId(postId)
      if (apiId !== null) {
        void reactForumPost(apiId, react)
          .then(() => refreshForum())
          .catch(() => {
            void refreshForum()
            toast('That reaction could not be saved.')
          })
      }
    },
    [currentAccount, refreshForum, toast],
  )

  const togglePinPost = useCallback(
    (postId: string) => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return
      }
      const f = db.feed.find((x) => x.id === postId)
      if (!f) return
      const nextPinned = !f.pinned
      const apiId = apiForumId(postId)
      if (apiId !== null) {
        void moderateForumPost(apiId, nextPinned ? 'pin' : 'unpin')
          .then(async () => {
            await refreshForum()
            toast(nextPinned ? 'Pinned to the top.' : 'Unpinned.')
          })
          .catch((err) =>
            toast(err instanceof ApiRequestError ? err.message : 'That pin could not be saved.'),
          )
        return
      }
      const now = new Date().toISOString()
      setDb((prev) => ({
        ...prev,
        feed: prev.feed.map((p) => (p.id === postId ? { ...p, pinned: nextPinned } : p)),
        audit: [
          ...prev.audit,
          {
            id: 'au' + uid(),
            ts: now,
            by: currentAccount.email,
            byName: currentAccount.name,
            action: nextPinned ? 'pin forum post' : 'unpin forum post',
            targetType: 'forum post',
            targetId: f.id,
            targetName: f.title || f.body.slice(0, 40) || 'Post',
            note: '',
          },
        ],
      }))
      toast(nextPinned ? 'Pinned to the top.' : 'Unpinned.')
    },
    [currentAccount, db.feed, isStaffUser, refreshForum, toast],
  )

  const applyModTargetInternal = useCallback(
    (
      next: DatabaseSnapshot,
      type: 'post' | 'comment',
      postId: string,
      cid: string | null,
      act: 'hide' | 'restore' | 'delete' | 'warn',
      note: string,
      repId: string | null,
    ): boolean => {
      if (!currentAccount) return false
      const f = next.feed.find((x) => x.id === postId)
      const c = f && cid ? f.comments.find((x) => x.id === cid) : null
      if (!f || (type === 'comment' && !c)) return false

      const tName = type === 'comment' ? c!.by : f.by || 'RTU'
      const tEmail = type === 'comment' ? c!.email : f.authorEmail
      const what = type === 'comment' ? 'comment' : 'post'
      const now = new Date().toISOString()

      if (act === 'hide') {
        if (type === 'comment' && c) c.hidden = { by: currentAccount.name, ts: now }
        else f.hidden = { by: currentAccount.name, ts: now }
      } else if (act === 'restore') {
        if (type === 'comment' && c) delete c.hidden
        else delete f.hidden
      } else if (act === 'delete') {
        if (type === 'comment' && c) {
          if (f.comments.some((x) => x.parent === c.id)) {
            c.deleted = true
            c.text = ''
            delete c.hidden
          } else {
            f.comments = f.comments.filter((x) => x.id !== c.id)
          }
          // Prune orphan deleted comments
          let again = true
          while (again) {
            again = false
            for (let i = f.comments.length - 1; i >= 0; i--) {
              const cm = f.comments[i]
              if (cm.deleted && !f.comments.some((x) => x.parent === cm.id)) {
                f.comments.splice(i, 1)
                again = true
              }
            }
          }
        } else {
          next.feed = next.feed.filter((x) => x.id !== f.id)
          if (f.aid) next.ann = next.ann.filter((a) => a.id !== f.aid)
        }
      }

      if (tEmail) {
        const ta = next.accounts.find((a) => a.email === tEmail)
        if (ta) {
          if (act === 'warn') {
            ta.notifs.unshift({
              t: `A moderator reviewed your forum ${what} and asked you to follow the community guidelines.`,
              read: false,
              ts: nowT(),
              at: now,
              link: { k: 'post', id: f.id },
            })
          } else if (act === 'hide') {
            ta.notifs.unshift({
              t: `A moderator hid your forum ${what}.`,
              read: false,
              ts: nowT(),
              at: now,
              link: { k: 'post', id: f.id },
            })
          } else if (act === 'delete') {
            ta.notifs.unshift({
              t: `A moderator removed your forum ${what}.`,
              read: false,
              ts: nowT(),
              at: now,
              link: null,
            })
          } else if (act === 'restore') {
            ta.notifs.unshift({
              t: `Your forum ${what} was restored.`,
              read: false,
              ts: nowT(),
              at: now,
              link: { k: 'post', id: f.id },
            })
          }
        }
      }

      next.freports
        .filter(
          (r) =>
            r.id === repId ||
            (r.status === 'open' && r.postId === postId && (r.commentId || null) === (cid || null)),
        )
        .forEach((r) => {
          r.status = 'actioned'
          r.action = act
          r.note = note || ''
          r.handledBy = currentAccount.name
          r.handledAt = now
        })

      const outcome = 'Content ' + FR_ACTIONS[act][1]
      next.modlog.unshift({
        id: 'm' + uid(),
        ts: now,
        by: currentAccount.name,
        byEmail: currentAccount.email,
        kind: act,
        type,
        postId,
        commentId: cid || null,
        reportId: repId,
        targetName: tName,
        note: note || '',
        outcome,
      })
      next.audit.push({
        id: 'au' + uid(),
        ts: now,
        by: currentAccount.email,
        byName: currentAccount.name,
        action: `${act} forum ${type}`,
        targetType: `forum ${type}`,
        targetId: cid || postId,
        targetName: tName,
        note: note || outcome,
      })
      return true
    },
    [currentAccount],
  )

  const toggleHidePost = useCallback(
    (postId: string) => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return
      }
      const f = db.feed.find((x) => x.id === postId)
      if (!f) return
      // A post held by screening is released by the same moderation call that
      // restores a hidden one; the server clears both in that path.
      const act = f.hidden || f.held ? 'restore' : 'hide'
      const apiId = apiForumId(postId)
      if (apiId !== null) {
        void moderateForumPost(apiId, act)
          .then(async () => {
            await refreshForum()
            toast(
              act === 'hide'
                ? 'Post hidden from members.'
                : f.held && !f.hidden
                  ? 'Post released to the forum.'
                  : 'Post restored.',
            )
          })
          .catch((err) =>
            toast(err instanceof ApiRequestError ? err.message : 'That decision could not be saved.'),
          )
        return
      }
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        applyModTargetInternal(next, 'post', postId, null, act, '', null)
        return next
      })
      toast(act === 'hide' ? 'Post hidden from members.' : 'Post restored.')
    },
    [currentAccount, db.feed, isStaffUser, applyModTargetInternal, refreshForum, toast],
  )

  const addForumComment = useCallback(
    (postId: string, parentId: string | null, text: string): boolean => {
      if (!currentAccount) return false
      const cleanText = text.trim().slice(0, 500)
      if (!cleanText) {
        toast('Write a comment first.')
        return false
      }
      const apiId = apiForumId(postId)
      if (apiId !== null) {
        void postForumComment(apiId, cleanText, parentId ? apiForumId(parentId) : null)
          .then(() => refreshForum())
          .catch((err) =>
            toast(err instanceof ApiRequestError ? err.message : 'That comment could not be saved.'),
          )
        return true
      }
      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const f = next.feed.find((x) => x.id === postId)
        if (!f) return prev
        if (parentId) {
          const par = f.comments.find((c) => c.id === parentId)
          if (!par || par.deleted || par.hidden) return prev
        }
        const newCm: ForumComment = {
          id: uid(),
          by: currentAccount.name,
          email: currentAccount.email,
          role: currentAccount.role,
          text: cleanText,
          ts: now,
          parent: parentId,
        }
        f.comments.push(newCm)
        const author = f.authorEmail
          ? next.accounts.find((a) => a.email === f.authorEmail)
          : undefined
        if (author && author.email !== currentAccount.email) {
          author.notifs.unshift({
            t: `${currentAccount.name} commented on your forum post.`,
            read: false,
            ts: nowT(),
            at: now,
            link: { k: 'post', id: f.id },
          })
        }
        if (parentId) {
          const par = f.comments.find((c) => c.id === parentId)
          const parAcct = par ? next.accounts.find((a) => a.email === par.email) : undefined
          if (
            parAcct &&
            parAcct.email !== currentAccount.email &&
            (!author || parAcct.email !== author.email)
          ) {
            parAcct.notifs.unshift({
              t: `${currentAccount.name} replied to your comment.`,
              read: false,
              ts: nowT(),
              at: now,
              link: { k: 'post', id: f.id },
            })
          }
        }
        return next
      })
      return true
    },
    [currentAccount, refreshForum, toast],
  )

  const editForumComment = useCallback(
    (postId: string, commentId: string, text: string): boolean => {
      if (!currentAccount) return false
      const cleanText = text.trim().slice(0, 500)
      if (!cleanText) return false
      const apiId = apiForumId(commentId)
      if (apiId !== null) {
        void updateForumCommentApi(apiId, cleanText)
          .then(async () => {
            await refreshForum()
            toast('Comment updated.')
          })
          .catch((err) =>
            toast(err instanceof ApiRequestError ? err.message : 'That comment could not be saved.'),
          )
        return true
      }
      let changed = false
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const f = next.feed.find((x) => x.id === postId)
        const c = f?.comments.find((x) => x.id === commentId)
        if (!c || c.email !== currentAccount.email || c.deleted || c.hidden) return prev
        if (c.text !== cleanText) {
          changed = true
          c.text = cleanText
          c.edited = new Date().toISOString()
        }
        return next
      })
      toast(changed ? 'Comment updated.' : 'No changes to save.')
      return true
    },
    [currentAccount, refreshForum, toast],
  )

  const deleteForumComment = useCallback(
    (postId: string, commentId: string) => {
      if (!currentAccount) return
      const f = db.feed.find((x) => x.id === postId)
      const c = f?.comments.find((x) => x.id === commentId)
      if (!f || !c) return
      if (!(isStaffUser || c.email === currentAccount.email)) {
        toast('You can only delete your own comments.')
        return
      }
      const hasReplies = f.comments.some((x) => x.parent === c.id)
      confirmDlg({
        title: 'Delete this comment?',
        msg: hasReplies
          ? 'The replies under it stay, and this comment will show as deleted.'
          : 'This comment will be removed. This cannot be undone.',
        yes: 'Delete comment',
        no: 'Keep it',
        danger: true,
        run: () => {
          const apiId = apiForumId(commentId)
          if (apiId !== null) {
            void deleteForumCommentApi(apiId)
              .then(async () => {
                await refreshForum()
                toast('Comment deleted.')
              })
              .catch((err) => {
                void refreshForum()
                toast(
                  err instanceof ApiRequestError
                    ? err.message
                    : 'That comment could not be deleted.',
                )
              })
            return
          }
          setDb((prev) => {
            const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
            const tf = next.feed.find((x) => x.id === postId)
            const tc = tf?.comments.find((x) => x.id === commentId)
            if (!tf || !tc) return prev
            if (isStaffUser && tc.email !== currentAccount.email) {
              applyModTargetInternal(next, 'comment', postId, commentId, 'delete', '', null)
            } else {
              if (tf.comments.some((x) => x.parent === commentId)) {
                tc.deleted = true
                tc.text = ''
                delete tc.hidden
              } else {
                tf.comments = tf.comments.filter((x) => x.id !== commentId)
              }
              let again = true
              while (again) {
                again = false
                for (let i = tf.comments.length - 1; i >= 0; i--) {
                  const cm = tf.comments[i]
                  if (cm.deleted && !tf.comments.some((x) => x.parent === cm.id)) {
                    tf.comments.splice(i, 1)
                    again = true
                  }
                }
              }
            }
            return next
          })
          toast('Comment deleted.')
        },
      })
    },
    [currentAccount, db.feed, isStaffUser, confirmDlg, applyModTargetInternal, toast],
  )

  const toggleHideComment = useCallback(
    (postId: string, commentId: string) => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return
      }
      const f = db.feed.find((x) => x.id === postId)
      const c = f?.comments.find((x) => x.id === commentId)
      if (!f || !c) return
      // A held comment is released by the same moderation call that restores
      // a hidden one; the server clears both in that path.
      const act = c.hidden || c.held ? 'restore' : 'hide'
      const apiId = apiForumId(commentId)
      if (apiId !== null) {
        void moderateForumComment(apiId, act)
          .then(async () => {
            await refreshForum()
            toast(
              act === 'hide'
                ? 'Comment hidden from members.'
                : c.held && !c.hidden
                  ? 'Comment released to the thread.'
                  : 'Comment restored.',
            )
          })
          .catch((err) =>
            toast(err instanceof ApiRequestError ? err.message : 'That decision could not be saved.'),
          )
        return
      }
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        applyModTargetInternal(next, 'comment', postId, commentId, act, '', null)
        return next
      })
      toast(act === 'hide' ? 'Comment hidden from members.' : 'Comment restored.')
    },
    [currentAccount, db.feed, isStaffUser, applyModTargetInternal, refreshForum, toast],
  )

  const submitForumReport = useCallback(
    (postId: string, commentId: string | null, reason: string, details: string): boolean => {
      if (!currentAccount) return false
      const f = db.feed.find((x) => x.id === postId)
      const c = f && commentId ? f.comments.find((x) => x.id === commentId) : null
      if (!f || (commentId && (!c || c.deleted))) {
        toast('That content is no longer available.')
        return false
      }
      if ((c ? c.email : f.authorEmail) === currentAccount.email) {
        toast('You cannot report your own content.')
        return false
      }
      if (!FR_REASONS.includes(reason)) {
        toast('Choose a reason.')
        return false
      }
      if (
        db.freports.some(
          (r) =>
            r.reporterEmail === currentAccount.email &&
            r.postId === f.id &&
            (r.commentId || null) === (commentId || null),
        )
      ) {
        toast('You already reported this.')
        return true
      }
      const apiPost = apiForumId(f.id)
      const apiComment = commentId ? apiForumId(commentId) : null
      if (apiPost !== null) {
        void submitForumReportApi({
          type: apiComment !== null ? 'comment' : 'post',
          post: apiPost,
          comment: apiComment,
          reason,
          details: String(details || '').slice(0, 400),
        })
          .then(async () => {
            await refreshForum()
            toast('Thanks. Staff will take a look.')
          })
          .catch((err) =>
            toast(err instanceof ApiRequestError ? err.message : 'That report could not be sent.'),
          )
        return true
      }

      const now = new Date().toISOString()
      const postTitle =
        String(f.title || '').trim() ||
        String(f.body || '').trim().slice(0, 70) ||
        'Untitled post'

      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        next.freports.unshift({
          id: 'r' + uid(),
          type: c ? 'comment' : 'post',
          postId: f.id,
          commentId: c ? c.id : null,
          reason,
          details: String(details || '').slice(0, 300),
          reporterEmail: currentAccount.email,
          reporterName: currentAccount.name,
          targetEmail: c ? c.email : f.authorEmail || null,
          targetName: c ? c.by : f.kind === 'notice' ? 'Office of Student Affairs' : f.by || 'RTU',
          snap: {
            title: postTitle,
            text: String(c ? c.text : f.body || '').slice(0, 300),
            imgs: c ? 0 : (f.imgs || []).length,
          },
          ts: now,
          status: 'open',
        })
        next.accounts
          .filter((a) => a.role === 'moderator')
          .forEach((a) => {
            a.notifs.unshift({
              t: `A forum ${c ? 'comment' : 'post'} by ${c ? c.by : f.by || 'a member'} was reported.`,
              read: false,
              ts: nowT(),
              at: now,
              link: { k: 'freports' },
            })
          })
        return next
      })
      toast('Thanks. Staff will take a look.')
      return true
    },
    [currentAccount, db.feed, db.freports, toast],
  )

  const submitOrderReport = useCallback(
    (
      orderId: string,
      role: 'buyer' | 'seller',
      _targetEmail: string | null,
      _targetName: string,
      _itemTitle: string,
      reason: string,
      details: string,
    ): boolean => {
      if (!currentAccount) return false
      const validReasons =
        role === 'seller' ? ORDER_REPORT_REASONS_SELLER : ORDER_REPORT_REASONS_BUYER
      const cleanReason = reason.trim() || validReasons[0]
      const cleanDetails = details.trim().slice(0, 400)
      if (cleanDetails.length < 5) {
        toast('Please write a short description of what happened (at least 5 characters).')
        return false
      }
      void submitForumReportApi({
        type: 'order',
        order: orderId,
        reason: cleanReason,
        details: cleanDetails,
      })
        .then(async () => {
          await refreshForum()
          toast('Report submitted to RTU administrators. Thank you.')
        })
        .catch((err) =>
          toast(err instanceof ApiRequestError ? err.message : 'That report could not be sent.'),
        )
      return true
    },
    [currentAccount, refreshForum, toast],
  )

  const setForumReportStatus = useCallback(
    (reportId: string, st: 'open' | 'reviewed' | 'dismissed') => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return
      }
      const apiId = apiForumId(reportId)
      if (apiId !== null) {
        void resolveForumReportApi(apiId, { status: st })
          .then(async () => {
            await refreshForum()
            toast('Report ' + (st === 'open' ? 'reopened' : 'marked ' + st) + '.')
          })
          .catch((err) =>
            toast(err instanceof ApiRequestError ? err.message : 'That decision could not be saved.'),
          )
        return
      }
      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const r = next.freports.find((x) => x.id === reportId)
        if (!r) return prev
        r.status = st
        if (st === 'open') {
          delete r.handledBy
          delete r.handledAt
          delete r.action
        } else {
          r.handledBy = currentAccount.name
          r.handledAt = now
        }
        const outcome = `Report ${st === 'open' ? 'reopened' : st}, content unchanged`
        next.modlog.unshift({
          id: 'm' + uid(),
          ts: now,
          by: currentAccount.name,
          byEmail: currentAccount.email,
          kind: st === 'open' ? 'reopened' : st,
          type: r.type,
          postId: r.postId,
          commentId: r.commentId,
          reportId: r.id,
          targetName: r.targetName,
          note: '',
          outcome,
        })
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: `forum report ${st === 'open' ? 'reopened' : st}`,
          targetType: 'forum report',
          targetId: r.id,
          targetName: r.targetName,
          note: outcome,
        })
        if (st !== 'open') {
          const ra = next.accounts.find((a) => a.email === r.reporterEmail)
          if (ra) {
            ra.notifs.unshift({
              t:
                st === 'dismissed'
                  ? 'Staff reviewed your forum report and did not find a problem.'
                  : 'Staff reviewed your forum report. Thank you.',
              read: false,
              ts: nowT(),
              at: now,
              link: null,
            })
          }
        }
        return next
      })
      toast('Report ' + (st === 'open' ? 'reopened' : 'marked ' + st) + '.')
    },
    [currentAccount, isStaffUser, toast],
  )

  const applyForumModerationAction = useCallback(
    (
      reportId: string,
      act: 'hide' | 'restore' | 'delete' | 'warn',
      note: string,
    ): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      const r = db.freports.find((x) => x.id === reportId)
      // A report about an order, a listing or a member is resolved through the
      // server without a post/comment to hide or restore; only posts and
      // comments have those two actions.
      if (!r || r.type === 'order') return false
      const targetKind: 'post' | 'comment' | null =
        r.type === 'post' || r.type === 'comment' ? r.type : null
      const apiId = apiForumId(reportId)
      if (apiId !== null) {
        void resolveForumReportApi(apiId, {
          status: 'actioned',
          action: act,
          note: note.trim().slice(0, 300),
        })
          .then(async () => {
            await refreshForum()
            toast('Done: ' + FR_ACTIONS[act][1] + '.')
          })
          .catch((err) =>
            toast(err instanceof ApiRequestError ? err.message : 'That decision could not be saved.'),
          )
        return true
      }
      if (targetKind === null) {
        // Only the server can act on a listing or a member report; there is no
        // post or comment to hide in the local snapshot.
        toast('Review that report on the server queue.')
        return false
      }
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        applyModTargetInternal(next, targetKind, r.postId, r.commentId, act, note.trim().slice(0, 300), r.id)
        return next
      })
      toast('Done: ' + FR_ACTIONS[act][1] + '.')
      return true
    },
    [currentAccount, isStaffUser, db.freports, applyModTargetInternal, toast],
  )

  // Admin / Staff Actions
  const decideFlag = useCallback(
    (decision: 'approved' | 'removed', note: string) => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return
      }
      const openOrDone = db.flags.filter((f) => (modTab === 'open') === (f.state === 'open'))
      const cur = openOrDone.find((x) => x.id === selectedFlagId) || openOrDone[0]
      if (!cur || cur.state !== 'open') return
      const ul = db.userListings.find((x) => x.lid === cur.lid)
      if (ul && ul.modHold) {
        toast('This listing was removed by staff. Restore it on the Users and audit page first.')
        return
      }

      const now = new Date().toISOString()
      let nextOpenId: string | null = null

      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const f = next.flags.find((x) => x.id === cur.id)
        if (!f) return prev
        f.state = decision
        f.note = note.trim()
        f.decidedAt = now
        const listing = next.userListings.find((x) => x.lid === f.lid)
        if (listing) {
          const owner = next.accounts.find((a) => a.email === listing.ownerEmail)
          const sl = owner?.sellerList.find((x) => x.lid === f.lid)
          const nm = listing.product.name
          if (decision === 'approved') {
            listing.state = 'live'
            if (!listing.product.pub) listing.product.pub = Date.now()
            if (sl) sl.status = listing.paused ? 'Paused' : 'Active'
            if (
              !next.feed.some(
                (fp) => fp.pid === listing.product.id && fp.kind !== 'notice' && fp.kind !== 'post',
              )
            ) {
              next.feed.unshift({
                id: 'f' + ++next.seq.fd,
                kind: owner?.role === 'moderator' ? 'school' : 'student',
                title: listing.product.name,
                body: listing.product.desc,
                price: listing.product.price,
                by: listing.product.seller,
                authorEmail: listing.ownerEmail,
                pid: listing.product.id,
                tag: listing.product.tag,
                left: listing.product.left,
                svc: isSvc(listing.product),
                ts: now,
                reacts: {},
                comments: [],
              })
            }
            if (owner) {
              owner.notifs.unshift({
                t: `Your listing “${nm}” was approved. It is now live on Tindahan.`,
                read: false,
                ts: nowT(),
                at: now,
                link: { k: 'listing', id: listing.lid },
              })
            }
          } else {
            listing.state = 'removed'
            if (sl) sl.status = 'Rejected'
            if (owner) {
              const reasonText =
                f.note || 'Please review the RTU Tindahan guidelines and listing accuracy.'
              const pk = pairKey(owner.email, currentAccount.email)
              let conv = next.conv.find(
                (cv) =>
                  pairKey(cv.buyer, cv.seller) === pk &&
                  cv.ref &&
                  (cv.ref.id === listing.lid || cv.ref.pid === listing.product.id),
              )
              if (!conv) {
                conv = next.conv.find((cv) => pairKey(cv.buyer, cv.seller) === pk)
              }
              const refObj: MessageRef = {
                type: isSvc(listing.product) ? 'service' : 'product',
                id: listing.lid,
                name: nm,
                pid: listing.product.id,
              }
              if (!conv) {
                conv = {
                  id: 'cv' + ++next.seq.cv,
                  buyer: owner.email,
                  buyerName: owner.name,
                  seller: currentAccount.email,
                  sellerName: `${currentAccount.name} (Administrator)`,
                  ref: refObj,
                  msgs: [],
                  last: now,
                  created: now,
                  seen: {},
                }
                next.conv.unshift(conv)
              } else {
                conv.ref = refObj
              }

              const alreadyLogged = conv.msgs.some(
                (m) =>
                  m.adminReview &&
                  m.adminReview.flagId === f.id &&
                  m.adminReview.listingId === listing.lid &&
                  m.adminReview.reason === reasonText,
              )

              if (!alreadyLogged) {
                const reviewBody = [
                  `Your listing '${nm}' was not approved.`,
                  '',
                  'Reason for review:',
                  reasonText,
                  '',
                  "Please review the administrator's feedback and make the necessary changes before submitting your listing again.",
                  '',
                  'You may reply to this conversation if you have questions.',
                ].join('\n')

                conv.msgs.push({
                  id: uid(),
                  from: currentAccount.email,
                  name: `${currentAccount.name} (Administrator)`,
                  staff: true,
                  text: reviewBody,
                  ts: now,
                  ref: refObj,
                  un: [owner.email],
                  adminReview: {
                    listingId: listing.lid,
                    listingTitle: nm,
                    decision: 'Not Approved',
                    reason: reasonText,
                    flagId: f.id,
                  },
                })
                conv.last = now
                conv.seen[currentAccount.email] = conv.msgs.length
              }

              owner.notifs.unshift({
                t: `Your listing “${nm}” was not approved.${
                  f.note ? ' Reason: ' + f.note : ''
                } Open Messages to view feedback and reply to the administrator.`,
                read: false,
                ts: nowT(),
                at: now,
                link: { k: 'message', id: conv.id },
              })
            }
          }
        }
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: decision === 'approved' ? 'approve listing' : 'reject listing',
          targetType: 'listing',
          targetId: f.lid || f.id,
          targetName: f.title,
          note: f.note || '',
        })
        const rem = next.flags.find((x) => x.state === 'open')
        nextOpenId = rem ? rem.id : null
        return next
      })

      setSelectedFlagId(nextOpenId)
      toast(
        decision === 'approved'
          ? 'Approved. The listing is now live.'
          : 'Rejected. The seller was told.',
      )
    },
    [currentAccount, isStaffUser, db.flags, db.userListings, modTab, selectedFlagId, toast],
  )

  const reopenFlag = useCallback(() => {
    if (!currentAccount || !isStaffUser) {
      toast('Only RTU staff can do that.')
      return
    }
    const openOrDone = db.flags.filter((f) => (modTab === 'open') === (f.state === 'open'))
    const cur = openOrDone.find((x) => x.id === selectedFlagId) || openOrDone[0]
    if (!cur) return
    const ul = db.userListings.find((x) => x.lid === cur.lid)
    if (ul && ul.modHold) {
      toast('This listing was removed by staff. Restore it on the Users and audit page first.')
      return
    }
    const now = new Date().toISOString()

    setDb((prev) => {
      const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
      const f = next.flags.find((x) => x.id === cur.id)
      if (!f) return prev
      f.state = 'open'
      delete f.note
      const listing = next.userListings.find((x) => x.lid === f.lid)
      if (listing) {
        listing.state = 'review'
        const owner = next.accounts.find((a) => a.email === listing.ownerEmail)
        const sl = owner?.sellerList.find((x) => x.lid === f.lid)
        if (sl) sl.status = 'Pending approval'
      }
      next.audit.push({
        id: 'au' + uid(),
        ts: now,
        by: currentAccount.email,
        byName: currentAccount.name,
        action: 'reopen listing review',
        targetType: 'listing',
        targetId: f.lid || f.id,
        targetName: f.title,
        note: '',
      })
      return next
    })
    setModTab('open')
    setSelectedFlagId(cur.id)
  }, [currentAccount, isStaffUser, db.flags, db.userListings, modTab, selectedFlagId, toast])

  const adminSetUserStatus = useCallback(
    (email: string, to: 'active' | 'suspended' | 'banned', reason: string): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      const target = acctByEmail(email)
      if (!target) {
        toast('That account no longer exists.')
        return false
      }
      if (target.role === 'moderator' || target.email === currentAccount.email) {
        toast('Staff accounts and your own account cannot be changed here.')
        return false
      }
      const cleanReason = reason.trim().slice(0, 200)
      if (to !== 'active' && cleanReason.length < 5) {
        toast('Please write a short reason first.')
        return false
      }
      const apiId = target.apiUserId
      if (apiId !== undefined) {
        void setUserStatusApi(apiId, to, cleanReason)
          .then(async () => {
            await refreshAdminData()
            toast(
              to === 'active'
                ? `${target.name} can sign in again.`
                : `${target.name} is ${to === 'banned' ? 'banned.' : 'suspended.'}`,
            )
          })
          .catch((err) => {
            void refreshAdminData()
            toast(
              err instanceof ApiRequestError
                ? err.message
                : 'That change could not be saved.',
            )
          })
        return true
      }
      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const t = next.accounts.find((a) => a.email === target.email)
        if (!t) return prev
        t.status = to
        t.statusNote = cleanReason
        t.statusBy = currentAccount.email
        t.statusAt = now
        if (to === 'active') {
          t.notifs.unshift({
            t: 'Your account access was restored. Welcome back.',
            read: false,
            ts: nowT(),
            at: now,
            link: null,
          })
        }
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: to === 'active' ? 'restore user' : to === 'banned' ? 'ban user' : 'suspend user',
          targetType: 'user',
          targetId: t.email,
          targetName: t.name,
          note: cleanReason,
        })
        return next
      })
      toast(
        to === 'active'
          ? `${target.name} can sign in again.`
          : `${target.name} is ${to === 'banned' ? 'banned.' : 'suspended.'}`,
      )
      return true
    },
    [currentAccount, isStaffUser, acctByEmail, refreshAdminData, toast],
  )

  const adminRemoveListing = useCallback(
    (lid: string, reason: string): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      const cleanReason = reason.trim().slice(0, 200)
      if (cleanReason.length < 5) {
        toast('Please write a short reason first.')
        return false
      }
      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const l = next.userListings.find((x) => x.lid === lid)
        if (!l || l.modHold) return prev
        const owner = next.accounts.find((a) => a.email === l.ownerEmail)
        const sl = owner?.sellerList.find((x) => x.lid === lid)
        const nm = l.product.name
        l.modHold = {
          by: currentAccount.email,
          ts: now,
          note: cleanReason,
          prev: l.state,
          prevStatus: sl ? sl.status : undefined,
        }
        l.state = 'removed'
        if (sl) sl.status = 'Removed'
        // Also remove any public forum feed card for this listing
        next.feed = next.feed.filter(
          (f) => !(f.pid === l.product.id && f.kind !== 'notice' && f.kind !== 'post'),
        )
        if (owner) {
          // Create or append to a two-way Inbox conversation between the student seller and administrator
          const pk = pairKey(owner.email, currentAccount.email)
          let conv = next.conv.find(
            (cv) =>
              pairKey(cv.buyer, cv.seller) === pk &&
              cv.ref &&
              (cv.ref.id === l.lid || cv.ref.pid === l.product.id),
          )
          if (!conv) {
            conv = next.conv.find((cv) => pairKey(cv.buyer, cv.seller) === pk)
          }
          const refObj: MessageRef = {
            type: isSvc(l.product) ? 'service' : 'product',
            id: l.lid,
            name: nm,
            pid: l.product.id,
          }
          if (!conv) {
            conv = {
              id: 'cv' + ++next.seq.cv,
              buyer: owner.email,
              buyerName: owner.name,
              seller: currentAccount.email,
              sellerName: `${currentAccount.name} (Administrator)`,
              ref: refObj,
              msgs: [],
              last: now,
              created: now,
              seen: {},
            }
            next.conv.unshift(conv)
          } else {
            conv.ref = refObj
          }

          const reviewBody = [
            `Your published listing '${nm}' was removed by an administrator.`,
            '',
            'Reason for removal:',
            cleanReason,
            '',
            'You may reply to this conversation if you have questions or need clarification from the administrator.',
          ].join('\n')

          conv.msgs.push({
            id: uid(),
            from: currentAccount.email,
            name: `${currentAccount.name} (Administrator)`,
            staff: true,
            text: reviewBody,
            ts: now,
            ref: refObj,
            un: [owner.email],
            adminReview: {
              listingId: l.lid,
              listingTitle: nm,
              decision: 'Not Approved',
              reason: `Removed by staff: ${cleanReason}`,
              flagId: l.lid,
            },
          })
          conv.last = now
          conv.seen[currentAccount.email] = conv.msgs.length

          owner.notifs.unshift({
            t: `Your listing “${nm}” was removed by staff. Reason: ${cleanReason}. Open Messages to view feedback and reply.`,
            read: false,
            ts: nowT(),
            at: now,
            link: { k: 'message', id: conv.id },
          })
        }
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'remove listing',
          targetType: 'listing',
          targetId: l.lid,
          targetName: l.product.name,
          note: cleanReason,
        })
        return next
      })
      toast('Listing removed. The student seller was notified in Notifications and Messages.')
      return true
    },
    [currentAccount, isStaffUser, toast],
  )

  const adminPauseListing = useCallback(
    (lid: string, reason: string): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      const cleanReason =
        reason.trim().slice(0, 200) ||
        'Temporarily paused by administrator for review.'
      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const l = next.userListings.find((x) => x.lid === lid)
        if (!l || l.modHold) return prev
        const owner = next.accounts.find((a) => a.email === l.ownerEmail)
        const sl = owner?.sellerList.find((x) => x.lid === lid)
        const nm = l.product.name
        l.paused = true
        if (sl && sl.status === 'Active') {
          sl.status = 'Paused'
        }
        if (owner) {
          const pk = pairKey(owner.email, currentAccount.email)
          let conv = next.conv.find(
            (cv) =>
              pairKey(cv.buyer, cv.seller) === pk &&
              cv.ref &&
              (cv.ref.id === l.lid || cv.ref.pid === l.product.id),
          )
          if (!conv) {
            conv = next.conv.find((cv) => pairKey(cv.buyer, cv.seller) === pk)
          }
          const refObj: MessageRef = {
            type: isSvc(l.product) ? 'service' : 'product',
            id: l.lid,
            name: nm,
            pid: l.product.id,
          }
          if (!conv) {
            conv = {
              id: 'cv' + ++next.seq.cv,
              buyer: owner.email,
              buyerName: owner.name,
              seller: currentAccount.email,
              sellerName: `${currentAccount.name} (Administrator)`,
              ref: refObj,
              msgs: [],
              last: now,
              created: now,
              seen: {},
            }
            next.conv.unshift(conv)
          } else {
            conv.ref = refObj
          }

          const reviewBody = [
            `Your published listing '${nm}' was paused by an administrator.`,
            '',
            'Reason for pause:',
            cleanReason,
            '',
            'While paused, buyers cannot see this listing on the marketplace. You may reply to this conversation or update your listing in My Shop.',
          ].join('\n')

          conv.msgs.push({
            id: uid(),
            from: currentAccount.email,
            name: `${currentAccount.name} (Administrator)`,
            staff: true,
            text: reviewBody,
            ts: now,
            ref: refObj,
            un: [owner.email],
            adminReview: {
              listingId: l.lid,
              listingTitle: nm,
              decision: 'Not Approved',
              reason: `Paused by staff: ${cleanReason}`,
              flagId: l.lid,
            },
          })
          conv.last = now
          conv.seen[currentAccount.email] = conv.msgs.length

          owner.notifs.unshift({
            t: `Your listing “${nm}” was paused by staff. Reason: ${cleanReason}. Open Messages to view details and reply.`,
            read: false,
            ts: nowT(),
            at: now,
            link: { k: 'message', id: conv.id },
          })
        }
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'pause listing',
          targetType: 'listing',
          targetId: l.lid,
          targetName: l.product.name,
          note: cleanReason,
        })
        return next
      })
      toast('Listing paused. The student seller was notified in Notifications and Messages.')
      return true
    },
    [currentAccount, isStaffUser, toast],
  )

  const adminResumeListing = useCallback(
    (lid: string): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const l = next.userListings.find((x) => x.lid === lid)
        if (!l || l.modHold) return prev
        const owner = next.accounts.find((a) => a.email === l.ownerEmail)
        const sl = owner?.sellerList.find((x) => x.lid === lid)
        const nm = l.product.name
        l.paused = false
        if (l.state === 'live' && sl) {
          sl.status = 'Active'
        }
        if (owner) {
          owner.notifs.unshift({
            t: `Your listing “${nm}” was unpaused by staff and is now active again.`,
            read: false,
            ts: nowT(),
            at: now,
            link: { k: 'listing', id: l.lid },
          })
        }
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'resume listing',
          targetType: 'listing',
          targetId: l.lid,
          targetName: l.product.name,
          note: '',
        })
        return next
      })
      toast('Listing resumed and active again.')
      return true
    },
    [currentAccount, isStaffUser, toast],
  )

  const adminRestoreListing = useCallback(
    (lid: string): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const l = next.userListings.find((x) => x.lid === lid)
        if (!l || !l.modHold) return prev
        const h = l.modHold
        const owner = next.accounts.find((a) => a.email === l.ownerEmail)
        const sl = owner?.sellerList.find((x) => x.lid === lid)
        l.state = h.prev && h.prev !== 'removed' ? h.prev : 'review'
        if (sl) {
          sl.status =
            h.prevStatus && h.prevStatus !== 'Removed'
              ? (h.prevStatus as typeof sl.status)
              : l.paused
                ? 'Paused'
                : 'Active'
        }
        delete l.modHold
        if (owner) {
          owner.notifs.unshift({
            t: `Your listing “${l.product.name}” was restored by staff.`,
            read: false,
            ts: nowT(),
            at: now,
            link: { k: 'listing', id: l.lid },
          })
        }
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'restore listing',
          targetType: 'listing',
          targetId: l.lid,
          targetName: l.product.name,
          note: '',
        })
        return next
      })
      toast('Listing restored.')
      return true
    },
    [currentAccount, isStaffUser, toast],
  )

  const adminActTransaction = useCallback(
    (txnId: string, to: 'Confirmed' | 'Completed' | 'Cancelled') => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can change this.')
        return
      }
      const t = db.txn.find((x) => x.id === txnId)
      if (!t || t.sellerEmail) {
        toast('A student seller handles this one. Staff can only review it.')
        return
      }
      const runChange = () => {
        const now = new Date().toISOString()
        setDb((prev) => {
          const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
          const findProductInNext = (pid: string): PrototypeProduct | undefined =>
            next.official.find((x) => x.id === pid) ||
            next.userListings.map((l) => l.product).find((x) => x && x.id === pid)

          const tx = next.txn.find((x) => x.id === txnId)
          if (!tx) return prev
          const was = tx.status
          const buyer = next.accounts.find((a) => a.email === tx.buyerEmail)
          const o = buyer?.orders.find((x) => x.id === tx.orderId)
          if (!buyer || !o) return prev

          if (to === 'Confirmed') {
            o.status = 'Meetup set'
            o.stage = 2
            o.tab = 'Active'
          } else if (to === 'Completed') {
            o.status = 'Completed'
            o.stage = 4
            o.tab = 'Completed'
            ;(o.lines || []).forEach((l) => {
              const prod = next.official.find((x) => x.id === l.pid)
              if (!prod) return
              if (l.vid && hasVars(prod)) {
                const vr = findVar(prod, l.vid)
                if (vr && vr.onHand != null) {
                  vr.onHand = Math.max(vr.qty, vr.onHand - l.qty)
                }
              } else if (prod.onHand != null) {
                prod.onHand = Math.max(prod.left, prod.onHand - l.qty)
              }
            })
          } else if (to === 'Cancelled') {
            o.status = 'Cancelled'
            o.tab = 'Cancelled'
            ;(o.lines || []).forEach((l) => {
              const prod = findProductInNext(l.pid)
              if (!prod) return
              if (l.vid && hasVars(prod)) {
                const vr = findVar(prod, l.vid)
                if (vr) {
                  vr.qty = Math.max(0, vr.qty + l.qty)
                  syncLeft(prod)
                }
              } else {
                prod.left = Math.max(0, prod.left + l.qty)
              }
            })
          }

          tx.status = to
          tx.updated = now
          tx.history.push({
            status: to,
            ts: now,
            by: currentAccount.name,
            note: TX_NOTE[to],
          })

          buyer.notifs.unshift({
            t:
              to === 'Confirmed'
                ? `The Official RTU Store confirmed your request ${o.id}. Meetup is set.`
                : to === 'Completed'
                  ? `Pickup recorded for ${o.id}. Thank you.`
                  : `The Official RTU Store could not complete your request ${o.id}. It was cancelled.`,
            read: false,
            ts: nowT(),
            at: now,
            link: { k: 'order', id: o.id },
          })

          next.audit.push({
            id: 'au' + uid(),
            ts: now,
            by: currentAccount.email,
            byName: currentAccount.name,
            action: 'request ' + to.toLowerCase(),
            targetType: 'transaction',
            targetId: tx.id,
            targetName: tx.summary,
            note: 'from ' + was,
          })
          return next
        })
        toast('Marked ' + to.toLowerCase() + '.')
      }

      if (to === 'Cancelled') {
        confirmDlg({
          title: 'Cancel this request?',
          msg: 'The buyer is told, the stock is put back, and the record stays in the history as Cancelled.',
          yes: 'Cancel request',
          no: 'Keep request',
          danger: true,
          run: runChange,
        })
      } else {
        runChange()
      }
    },
    [currentAccount, isStaffUser, db.txn, confirmDlg, toast],
  )

  const exportTransactionsCsv = useCallback(
    (rows: TransactionRecord[]) => {
      if (!rows.length) {
        toast('No records match the filters.')
        return
      }
      const q = (v: unknown) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'
      const head = [
        'Transaction ID',
        'Source',
        'Date',
        'Item',
        'Kind',
        'Quantity',
        'Total (PHP)',
        'Buyer',
        'Buyer student no.',
        'Seller',
        'Seller student no.',
        'Status',
        'Order ID',
        'Meetup',
      ]
      const csv = [head.map(q).join(',')]
        .concat(
          rows.map((t) =>
            [
              t.id,
              t.type === 'official' ? 'Official RTU Store' : 'Student to student',
              stamp(t.created),
              t.summary,
              t.kind,
              t.qty,
              t.total,
              t.buyerName,
              t.buyerSid,
              t.sellerName,
              t.sellerSid,
              t.status,
              t.orderId,
              t.meetup,
            ]
              .map(q)
              .join(','),
          ),
        )
        .join('\r\n')
      const u = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = u
      a.download = `rtu-tindahan-transactions-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(u), 1000)
      toast(`${rows.length} record${rows.length === 1 ? '' : 's'} exported.`)
    },
    [toast],
  )

  const saveOfficialProduct = useCallback(
    (input: {
      id: string | null
      name: string
      tag: string
      price: number
      stock: number
      desc: string
    }): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      const n = input.name.trim()
      const pr = Number(input.price)
      const st = Number(input.stock)
      const ty = input.tag || 'Merch'
      const ds = input.desc.trim()
      const k = OTYPE[ty] || OTYPE.Merch
      const now = new Date().toISOString()

      if (input.id) {
        if (n.length < 3 || !(pr > 0)) {
          toast('Enter a name and a price.')
          return false
        }
        setDb((prev) => {
          const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
          const e = next.official.find((p) => p.id === input.id)
          if (!e) return prev
          const matchedType = next.bao.types.find((x) => x.name === ty)
          const prevLeft = e.left
          const prevOnHand = e.onHand
          Object.assign(e, {
            name: n,
            price: pr,
            left: prevLeft,
            ...(prevOnHand != null ? { onHand: prevOnHand } : {}),
            tag: ty,
            tone: matchedType?.tone || k[0],
            icon: matchedType?.icon || k[1],
            category: matchedType?.category || OFFCAT[ty] || 'Other Items',
            sub: matchedType?.sub || OFFSUB[ty] || '',
            desc: ds || e.desc,
          })
          if (hasVars(e)) syncLeft(e)
          if (matchedType) {
            e.inv = {
              type: matchedType.id,
              low: null,
              win: null,
              limit: 0,
              claimNote: '',
              ...(e.inv || {}),
              mig: 1,
            }
            e.inv.type = matchedType.id
          }
          next.audit.push({
            id: 'au' + uid(),
            ts: now,
            by: currentAccount.email,
            byName: currentAccount.name,
            action: 'edit official product',
            targetType: 'official product',
            targetId: e.id,
            targetName: e.name,
            note: '',
          })
          return next
        })
        toast('Product updated.')
        return true
      }

      if (n.length < 3 || !(pr > 0) || !(st >= 1)) {
        toast('Enter a name, a price and how many are in stock.')
        return false
      }
      const newId = 'u' + Date.now().toString(36)
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const matchedType = next.bao.types.find((x) => x.name === ty)
        const newProd: PrototypeProduct = {
          id: newId,
          name: n,
          price: pr,
          cat: 'Official',
          category: matchedType?.category || OFFCAT[ty] || 'Other Items',
          sub: matchedType?.sub || OFFSUB[ty] || '',
          tone: matchedType?.tone || k[0],
          icon: matchedType?.icon || k[1],
          tag: ty,
          seller: 'RTU Pasig Campus Store',
          left: st,
          onHand: st,
          inv: {
            type: matchedType ? matchedType.id : 'ty-other',
            low: null,
            win: null,
            limit: 0,
            claimNote: '',
            mig: 1,
          },
          unit: 'each',
          when: 'Campus store window',
          desc: ds || 'Official item from the Pasig Campus Store.',
          pub: Date.now(),
          imgs: [],
        }
        next.official.unshift(newProd)
        if (st > 0) {
          next.bao.seq.led += 1
          next.bao.ledger.push({
            id: 'L-' + String(next.bao.seq.led).padStart(5, '0'),
            ts: now,
            pid: newProd.id,
            item: newProd.name,
            vid: '',
            label: '',
            type: 'Stock In',
            qty: st,
            ohD: st,
            rsD: 0,
            ticket: '',
            reason: 'Opening stock when the item was added',
            by: currentAccount.name,
            byEmail: currentAccount.email,
            after: { onHand: st, reserved: 0, available: st },
          })
        }
        next.feed.unshift({
          id: 'f' + ++next.seq.fd,
          kind: 'school',
          title: newProd.name,
          body: newProd.desc,
          price: newProd.price,
          by: newProd.seller,
          pid: newProd.id,
          tag: newProd.tag,
          left: newProd.left,
          ts: now,
          reacts: {},
          comments: [],
        })
        next.accounts
          .filter((a) => a.role !== 'moderator')
          .forEach((a) => {
            a.notifs.unshift({
              t: 'New in the Pasig Campus Store: ' + n,
              read: false,
              ts: nowT(),
              at: now,
              link: { k: 'listing', id: newProd.id },
            })
          })
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'add official product',
          targetType: 'official product',
          targetId: newProd.id,
          targetName: newProd.name,
          note: '',
        })
        return next
      })
      toast('Product added to the Pasig Campus Store and announced in the forum.')
      return true
    },
    [currentAccount, isStaffUser, toast],
  )

  const toggleHideOfficialProduct = useCallback(
    (id: string) => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return
      }
      const p = db.official.find((x) => x.id === id)
      if (!p) return
      const runToggle = () => {
        const now = new Date().toISOString()
        const nextHidden = !p.hidden
        setDb((prev) => {
          const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
          const target = next.official.find((x) => x.id === id)
          if (!target) return prev
          target.hidden = nextHidden
          if (nextHidden) {
            next.feed = next.feed.filter(
              (f) => !(f.pid === id && f.kind !== 'notice' && f.kind !== 'post'),
            )
          }
          next.audit.push({
            id: 'au' + uid(),
            ts: now,
            by: currentAccount.email,
            byName: currentAccount.name,
            action: nextHidden ? 'hide official product' : 'publish official product',
            targetType: 'official product',
            targetId: target.id,
            targetName: target.name,
            note: '',
          })
          return next
        })
        toast(
          nextHidden
            ? 'Hidden. It no longer shows in the store or the counts.'
            : 'Published. It now shows in the store and the counts.',
        )
      }

      if (!p.hidden) {
        confirmDlg({
          title: 'Hide this official product?',
          msg: `"${p.name}" will stop showing in the Official RTU Store and the counts. Nothing is deleted, and you can publish it again.`,
          yes: 'Hide product',
          no: 'Cancel',
          run: runToggle,
        })
      } else {
        runToggle()
      }
    },
    [currentAccount, isStaffUser, db.official, confirmDlg, toast],
  )

  const deleteOfficialProduct = useCallback(
    (id: string) => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return
      }
      const p = db.official.find((x) => x.id === id)
      if (!p) return
      const openTickets = db.txn
        .filter(baoIsOfficialTxn)
        .filter(
          (t) =>
            !['Claimed', 'Cancelled'].includes(baoStatusOf(t)) &&
            t.lines.some((l) => l.pid === id),
        )
      if (openTickets.length) {
        toast(
          `This item is on ${openTickets.length} open ticket${openTickets.length === 1 ? '' : 's'}. Finish or cancel them first. You can hide the item instead.`,
        )
        return
      }
      confirmDlg({
        title: 'Remove this official product?',
        msg: `"${p.name}" will be removed from the Official RTU Store and from every cart. Past orders stay in the records. You can hide it instead if you may sell it again.`,
        yes: 'Remove product',
        no: 'Cancel',
        danger: true,
        run: () => {
          const now = new Date().toISOString()
          setDb((prev) => ({
            ...prev,
            official: prev.official.filter((x) => x.id !== id),
            feed: prev.feed.filter(
              (f) => !(f.pid === id && f.kind !== 'notice' && f.kind !== 'post'),
            ),
            accounts: prev.accounts.map((a) => ({
              ...a,
              cart: a.cart.filter((c) => c.id !== id),
            })),
            audit: [
              ...prev.audit,
              {
                id: 'au' + uid(),
                ts: now,
                by: currentAccount.email,
                byName: currentAccount.name,
                action: 'remove official product',
                targetType: 'official product',
                targetId: p.id,
                targetName: p.name,
                note: '',
              },
            ],
          }))
          toast('Product removed.')
        },
      })
    },
    [currentAccount, isStaffUser, db.official, db.txn, confirmDlg, toast],
  )

  const postStaffAnnouncement = useCallback(
    (title: string, body: string): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      const t = title.trim()
      const b = body.trim()
      if (!t || !b) {
        toast('Add a title and a message.')
        return false
      }
      // A staff announcement is a notice post: one model, one moderation
      // path, and every verified member is notified by the server.
      void createForumPostApi({ kind: 'notice', topic: 'General', title: t, body: b })
        .then(async () => {
          await Promise.all([refreshForum(), refreshAnnouncements()])
          toast('Announcement posted. Every member was notified.')
        })
        .catch((err) =>
          toast(
            err instanceof ApiRequestError
              ? err.message
              : 'That announcement could not be posted.',
          ),
        )
      return true
    },
    [currentAccount, isStaffUser, refreshAnnouncements, refreshForum, toast],
  )

  const deleteStaffAnnouncement = useCallback(
    (idx: number) => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return
      }
      const a = db.ann[idx]
      if (!a) return
      confirmDlg({
        title: 'Delete this announcement?',
        msg: `"${a.t}" and its forum notice will be removed.`,
        yes: 'Delete announcement',
        no: 'Cancel',
        danger: true,
        run: () => {
          const apiId = apiForumId(a.id)
          if (apiId !== null) {
            void deleteForumPostApi(apiId)
              .then(async () => {
                await Promise.all([refreshForum(), refreshAnnouncements()])
                toast('Announcement deleted.')
              })
              .catch((err) => {
                void refreshAnnouncements()
                toast(
                  err instanceof ApiRequestError
                    ? err.message
                    : 'That announcement could not be deleted.',
                )
              })
            return
          }
          const now = new Date().toISOString()
          setDb((prev) => ({
            ...prev,
            ann: prev.ann.filter((_, i) => i !== idx),
            feed: prev.feed.filter((f) => f.aid !== a.id),
            audit: [
              ...prev.audit,
              {
                id: 'au' + uid(),
                ts: now,
                by: currentAccount.email,
                byName: currentAccount.name,
                action: 'delete announcement',
                targetType: 'announcement',
                targetId: a.id || '',
                targetName: a.t,
                note: '',
              },
            ],
          }))
          toast('Announcement deleted.')
        },
      })
    },
    [currentAccount, isStaffUser, db.ann, confirmDlg, refreshAnnouncements, refreshForum, toast],
  )

  const exportDatabaseBackup = useCallback(() => {
    if (!isStaffUser) {
      toast('Only RTU staff can do that.')
      return
    }
    // The old "backup" exported this browser's snapshot, which had nothing to
    // do with the server's data. This downloads the database itself.
    void downloadDatabaseBackup()
      .then(({ blob, filename }) => {
        const u = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = u
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.setTimeout(() => URL.revokeObjectURL(u), 1000)
        toast('Database backup downloaded.')
      })
      .catch((err) =>
        toast(
          err instanceof ApiRequestError
            ? err.message
            : 'The backup could not be downloaded.',
        ),
      )
  }, [isStaffUser, toast])

  const baoSaveOrderSettings = useCallback(
    (nextSettings: Partial<BaoSettings>) => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return
      }
      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        next.bao.settings = {
          ...next.bao.settings,
          ...nextSettings,
        }
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'order settings',
          targetType: 'settings',
          targetId: '',
          targetName: 'Store orders',
          note: 'Workflow and queue settings changed',
        })
        return next
      })
      toast('Settings saved.')
    },
    [currentAccount, isStaffUser, toast],
  )

  const baoApplyStockMove = useCallback(
    (
      items: Array<{
        pid: string
        vid?: string
        type: BaoLedgerType
        qty: number
        reason?: string
        ticket?: string
      }>,
    ): { ok: boolean; msg?: string } => {
      if (!currentAccount || !isStaffUser) {
        return { ok: false, msg: 'Only RTU staff can change stock.' }
      }
      let result: { ok: boolean; msg?: string } = { ok: true }
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const r = applyLedgerOnSnapshot(next, items, {
          by: currentAccount.name,
          byEmail: currentAccount.email,
        })
        result = r
        if (!r.ok) return prev
        return next
      })
      // Stock In and Sold are the movements the store API accepts directly;
      // the other kinds are produced by tickets on the server. Variant ids
      // carry the backend's primary key as `v<id>`, so a row without one
      // stays local.
      if (result.ok) {
        items
          .filter(
            (item) =>
              (item.type === 'Stock In' || item.type === 'Sold') &&
              /^v\d+$/.test(item.vid || ''),
          )
          .forEach((item) => {
            const variant = Number((item.vid || '').slice(1))
            const call =
              item.type === 'Sold'
                ? postWalkInSale(variant, Math.abs(item.qty), item.reason)
                : postStockIn(variant, item.qty, item.reason)
            void call
              .then(() => refreshStore())
              .catch((err: unknown) => {
                toast(
                  err instanceof ApiRequestError
                    ? err.message
                    : 'The server did not accept that stock movement.',
                )
                void refreshStore()
              })
          })
      }
      return result
    },
    [currentAccount, isStaffUser, refreshStore, toast],
  )

  const baoSaveItemSettings = useCallback(
    (
      pid: string,
      input: {
        typeId: string
        low: number | null
        limit: number
        claimNote: string
        win: { enabled: boolean; start: string; end: string; message: string }
        varAttrName?: string
        rowLows?: Record<string, number | null>
      },
    ): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      if (input.limit < 0) {
        toast('The limit cannot be negative.')
        return false
      }
      if (input.win.enabled && !input.win.start && !input.win.end) {
        toast('Choose when ordering opens or closes, or switch the window off.')
        return false
      }
      if (
        input.win.enabled &&
        input.win.start &&
        input.win.end &&
        Date.parse(input.win.end) <= Date.parse(input.win.start)
      ) {
        toast('The closing time must be after the opening time.')
        return false
      }

      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const p = next.official.find((x) => x.id === pid)
        if (!p) return prev
        const t = baoTypeById(next.bao, input.typeId)
        p.inv = {
          ...(p.inv || {}),
          type: t ? t.id : p.inv?.type || 'ty-other',
          low: input.low,
          limit: input.limit,
          claimNote: input.claimNote.trim(),
          win: input.win,
          mig: 1,
        }
        if (t) {
          p.tag = t.name
          p.tone = t.tone
          p.icon = t.icon
          p.category = t.category
          p.sub = t.sub || ''
        }
        if (hasVars(p) && p.vars) {
          const vn = (input.varAttrName || 'Size').trim().slice(0, 20) || 'Size'
          const oldName = p.vars.attrs[0].name
          if (vn !== oldName) {
            p.vars.rows.forEach((r) => {
              r.opts = { [vn]: r.opts[oldName] }
            })
            p.vars.attrs[0].name = vn
          }
          if (input.rowLows) {
            p.vars.rows.forEach((r) => {
              if (r.id in input.rowLows!) {
                r.low = input.rowLows![r.id]
              }
            })
          }
        }
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'item settings',
          targetType: 'official product',
          targetId: p.id,
          targetName: p.name,
          note: 'type, low stock, window, limit or claim notes changed',
        })
        return next
      })
      toast('Item settings saved.')
      return true
    },
    [currentAccount, isStaffUser, toast],
  )

  const baoStartItemSizes = useCallback(
    (pid: string, firstLabel: string): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      const label = firstLabel.trim()
      if (!label) {
        toast('Enter the name of the first size or variation.')
        return false
      }
      const existing = db.official.find((x) => x.id === pid)
      if (!existing || hasVars(existing)) return false
      const u = baoUnit(existing, '')
      if (u && baoReserved(u) > 0) {
        toast(
          `This item has ${baoReserved(u)} reserved for open tickets. Finish or cancel them first.`,
        )
        return false
      }

      let ok = true
      const n = u ? u.onHand : 0
      const now = new Date().toISOString()

      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const p = next.official.find((x) => x.id === pid)
        if (!p || hasVars(p)) return prev
        const unit0 = baoUnit(p, '')
        const count = unit0 ? unit0.onHand : 0
        const reason = `Moved to ${label} when sizes were turned on`

        if (count > 0) {
          const r1 = applyLedgerOnSnapshot(
            next,
            [{ pid: p.id, vid: '', type: 'Adjustment', qty: -count, reason }],
            { by: currentAccount.name, byEmail: currentAccount.email },
          )
          if (!r1.ok) {
            ok = false
            return prev
          }
        }

        const rid =
          'v' +
          Date.now().toString(36).slice(-4) +
          Math.random().toString(36).slice(2, 5)
        p.vars = {
          attrs: [{ name: 'Size', opts: [label] }],
          rows: [{ id: rid, opts: { Size: label }, qty: 0, onHand: 0, price: null, low: null }],
        }
        delete p.onHand
        syncLeft(p)

        if (count > 0) {
          applyLedgerOnSnapshot(
            next,
            [{ pid: p.id, vid: rid, type: 'Adjustment', qty: count, reason }],
            { by: currentAccount.name, byEmail: currentAccount.email },
          )
        }

        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'item sizes on',
          targetType: 'official product',
          targetId: p.id,
          targetName: p.name,
          note: label,
        })
        return next
      })

      if (ok) {
        toast(`Sizes are on. ${n} unit${n === 1 ? '' : 's'} moved to ${label}.`)
      }
      return ok
    },
    [currentAccount, isStaffUser, db.official, toast],
  )

  const baoAddItemSizeRow = useCallback(
    (pid: string, label: string, openingQty: number): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      const cleanLabel = label.trim()
      if (!cleanLabel) {
        toast('Enter a name.')
        return false
      }
      if (openingQty < 0) {
        toast('Opening stock cannot be negative.')
        return false
      }
      const existing = db.official.find((x) => x.id === pid)
      if (!existing || !hasVars(existing) || !existing.vars) return false
      const attrName = existing.vars.attrs[0].name
      if (
        existing.vars.rows.some(
          (r) => String(r.opts[attrName]).toLowerCase() === cleanLabel.toLowerCase(),
        )
      ) {
        toast('That one is already in the list.')
        return false
      }

      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const p = next.official.find((x) => x.id === pid)
        if (!p || !hasVars(p) || !p.vars) return prev
        const nm = p.vars.attrs[0].name
        const rid =
          'v' +
          Date.now().toString(36).slice(-4) +
          Math.random().toString(36).slice(2, 5)
        p.vars.rows.push({
          id: rid,
          opts: { [nm]: cleanLabel },
          qty: 0,
          onHand: 0,
          price: null,
          low: null,
        })
        p.vars.attrs[0].opts.push(cleanLabel)
        syncLeft(p)
        if (openingQty > 0) {
          applyLedgerOnSnapshot(
            next,
            [
              {
                pid: p.id,
                vid: rid,
                type: 'Stock In',
                qty: openingQty,
                reason: `Opening stock for the new ${nm.toLowerCase()}`,
              },
            ],
            { by: currentAccount.name, byEmail: currentAccount.email },
          )
        }
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'item size added',
          targetType: 'official product',
          targetId: p.id,
          targetName: p.name,
          note: cleanLabel,
        })
        return next
      })
      toast(`Added ${cleanLabel}.`)
      return true
    },
    [currentAccount, isStaffUser, db.official, toast],
  )

  const baoRemoveItemSizeRow = useCallback(
    (pid: string, rowId: string): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      const existing = db.official.find((x) => x.id === pid)
      if (!existing || !hasVars(existing) || !existing.vars) return false
      const u = baoUnit(existing, rowId)
      if (!u) return false
      if (u.onHand > 0 || baoReserved(u) > 0) {
        toast(
          'Only a size with nothing on hand and nothing reserved can be removed. Adjust the count to 0 first.',
        )
        return false
      }

      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const p = next.official.find((x) => x.id === pid)
        if (!p || !hasVars(p) || !p.vars) return prev
        const row = findVar(p, rowId)
        if (!row) return prev
        const nm = p.vars.attrs[0].name
        const lbl = row.opts[nm]
        p.vars.rows = p.vars.rows.filter((x) => x.id !== rowId)
        p.vars.attrs[0].opts = p.vars.attrs[0].opts.filter((x) => x !== lbl)
        if (!p.vars.rows.length) {
          delete p.vars
          p.left = 0
          p.onHand = 0
        } else {
          syncLeft(p)
        }
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'item size removed',
          targetType: 'official product',
          targetId: p.id,
          targetName: p.name,
          note: lbl,
        })
        return next
      })
      toast('Size removed.')
      return true
    },
    [currentAccount, isStaffUser, db.official, toast],
  )

  const baoSaveItemTypes = useCallback(
    (nextTypes: BaoItemType[]): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      const seen: string[] = []
      for (const t of nextTypes) {
        if (!t.name.trim()) {
          toast('Every type needs a name.')
          return false
        }
        const low = t.name.trim().toLowerCase()
        if (seen.includes(low)) {
          toast(`Two types have the same name: ${t.name}.`)
          return false
        }
        seen.push(low)
      }
      if (!nextTypes.some((t) => t.active)) {
        toast('Keep at least one type active.')
        return false
      }
      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const validSub = (cat: string, s: string) => !s || (SUBCATS[cat] || []).includes(s)
        const cleaned = nextTypes.map((t) => ({
          ...t,
          name: t.name.trim(),
          sub: validSub(t.category, t.sub) ? t.sub : '',
        }))
        next.bao.types = cleaned
        syncBaoTypeMaps(next.bao)
        next.official.forEach((p) => {
          const t = baoItemType(next.bao, p)
          if (t && p.inv && p.inv.type === t.id) {
            p.tag = t.name
            p.tone = t.tone
            p.icon = t.icon
            p.category = t.category
            p.sub = t.sub || ''
          }
        })
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'item types',
          targetType: 'settings',
          targetId: '',
          targetName: 'Item types',
          note: 'Item types changed',
        })
        return next
      })
      toast('Item types saved.')
      return true
    },
    [currentAccount, isStaffUser, toast],
  )

  const baoSaveStoreWindowAndLimit = useCallback(
    (
      win: { enabled: boolean; start: string; end: string; message: string },
      limitPerStudent: number,
    ): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      if (win.enabled && !win.start && !win.end) {
        toast('Choose when ordering opens or closes, or switch the window off.')
        return false
      }
      if (win.enabled && win.start && win.end && Date.parse(win.end) <= Date.parse(win.start)) {
        toast('The closing time must be after the opening time.')
        return false
      }
      if (limitPerStudent < 0) {
        toast('The limit cannot be negative.')
        return false
      }
      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        next.bao.settings.window = {
          enabled: win.enabled,
          start: win.start,
          end: win.end,
          message: win.message.trim(),
        }
        next.bao.settings.limitPerStudent = limitPerStudent
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'order rules',
          targetType: 'settings',
          targetId: '',
          targetName: 'Windows and limits',
          note: 'Store-wide window or limit changed',
        })
        return next
      })
      // The backend enforces the window and the limit when a student orders,
      // so the policy has to live there too, not only in this browser.
      void patchStoreSettings({
        ordering_window_enabled: win.enabled,
        ordering_window_start: win.start ? `${win.start}:00` : null,
        ordering_window_end: win.end ? `${win.end}:00` : null,
        max_quantity_per_student: limitPerStudent,
      })
        .then(() => refreshStore())
        .catch((err: unknown) => {
          toast(
            err instanceof ApiRequestError
              ? err.message
              : 'The server did not accept those rules.',
          )
          void refreshStore()
        })
      toast('Saved.')
      return true
    },
    [currentAccount, isStaffUser, refreshStore, toast],
  )

  const baoCreateFaceToFaceOrder = useCallback(
    async (input: {
      name: string
      sid: string
      email: string
      date: string
      notes: string
      lines: Array<{ pid: string; vid: string; qty: number }>
    }): Promise<{ ok: boolean; msg?: string; txnId?: string; queue?: string | null }> => {
      if (!currentAccount || !isStaffUser) {
        return { ok: false, msg: 'Only RTU staff can do that.' }
      }
      const name = input.name.trim()
      const sid = input.sid.trim()
      const email = input.email.trim().toLowerCase()
      const todayStr = new Date().toLocaleDateString('en-CA')

      if (name.length < 2) return { ok: false, msg: 'Enter the student name.' }
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return { ok: false, msg: 'That email does not look right.' }
      }
      if (!input.lines.length) return { ok: false, msg: 'Add at least one item.' }
      if (!input.date || input.date > todayStr) {
        return { ok: false, msg: 'Choose today or an earlier date.' }
      }

      const acct =
        (email
          ? db.accounts.find((a) => a.role !== 'moderator' && a.email === email)
          : undefined) ||
        (sid
          ? db.accounts.find((a) => a.role !== 'moderator' && String(a.sid || '') === sid)
          : undefined) ||
        null

      const perItem = new Map<string, number>()
      input.lines.forEach((l) => perItem.set(l.pid, (perItem.get(l.pid) || 0) + l.qty))
      for (const [pid, q] of perItem) {
        const p = db.official.find((x) => x.id === pid)
        if (!p || p.hidden) {
          return {
            ok: false,
            msg: 'An item is no longer on sale. Remove it from the list.',
          }
        }
        if (email || sid || acct) {
          const lim = baoLimitFor(db.bao, p)
          if (lim > 0) {
            const had = baoStudentCount(
              db.bao,
              db.txn,
              p,
              acct ? acct.email : email,
              acct ? acct.sid : sid,
            )
            if (had + q > lim) {
              return {
                ok: false,
                msg:
                  `${p.name}: the limit is ${lim} per student.` +
                  (had ? ` This student already has ${had}.` : ''),
              }
            }
          }
        }
      }

      // A walk-in sale is a ticket that is claimed on the spot: create it for
      // the student's account, then claim it, so stock, the sales counter and
      // the office's own history all move the way they do online. Lines that
      // are still prototype-local, or a walk-in with no email, keep the local
      // path below.
      const backendLines = input.lines
        .map((l) => {
          const product = db.official.find((x) => x.id === l.pid)
          return {
            l,
            listing: product?.apiListingId ?? null,
            variant: /^v\d+$/.test(l.vid || '') ? Number(l.vid.slice(1)) : null,
          }
        })
      const postable =
        Boolean(getToken()) &&
        Boolean(email) &&
        backendLines.length > 0 &&
        backendLines.every((x) => x.listing && x.variant)

      let serverRef: string | undefined
      if (postable) {
        try {
          const ticket = await createTicket({
            items: backendLines.map((x) => ({
              listing: x.listing as number,
              variant: x.variant as number,
              quantity: x.l.qty,
            })),
            buyerEmail: email,
            claimNotes: input.notes.trim(),
          })
          // The status graph is strict: requested -> confirmed -> ready ->
          // claimed. Walk it so the sale is recorded the same way an online
          // request would be, instead of jumping straight to claimed.
          await postTicketTransition(ticket.reference, 'Confirmed', 'Walk-in at the counter')
          await postTicketTransition(ticket.reference, 'Ready for Pickup', 'Handed over at the counter')
          await postTicketTransition(ticket.reference, 'Claimed', 'Face to face entry at the counter')
          serverRef = ticket.reference
        } catch (err) {
          return {
            ok: false,
            msg:
              err instanceof ApiRequestError
                ? err.message
                : 'The store could not record that request.',
          }
        }
      }

      let outcome: { ok: boolean; msg?: string; txnId?: string; queue?: string | null } = {
        ok: true,
      }

      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const whenDate =
          input.date === todayStr ? new Date() : new Date(input.date + 'T12:00:00')
        const day = baoDayKey(whenDate)
        const txnId = serverRef
          ? STORE_ID_PREFIX + serverRef
          : `TXN-${day}-${String(next.seq.tx + 1).padStart(3, '0')}`

        const builtLines = input.lines.map((l) => {
          const p = next.official.find((x) => x.id === l.pid)!
          return {
            pid: l.pid,
            vid: l.vid || '',
            name: vLineName(p, l.vid),
            qty: l.qty,
            price: unitPrice(p, l.vid),
            kind: 'product' as const,
          }
        })

        // 1. Deduct stock via Sold ledger lines
        const st = applyLedgerOnSnapshot(
          next,
          builtLines.map((l) => ({
            pid: l.pid,
            vid: l.vid,
            type: 'Sold' as const,
            qty: l.qty,
            ticket: txnId,
            reason: 'Face to face sale',
          })),
          { by: currentAccount.name, byEmail: currentAccount.email },
        )
        if (!st.ok) {
          outcome = st
          return prev
        }

        next.seq.tx += 1
        const oid = serverRef || `FTF-${day}-${String(next.seq.o++).padStart(3, '0')}`
        const firstProd = next.official.find((x) => x.id === builtLines[0].pid)!
        const total = builtLines.reduce((a, l) => a + l.price * l.qty, 0)

        let queueVal: string | null = null
        const qCfg = next.bao.settings.queue
        if (qCfg && qCfg.enabled) {
          const qDay = baoDayKey(whenDate)
          if (qCfg.dailyReset && next.bao.queue.day !== qDay) {
            next.bao.queue = { day: qDay, n: 0 }
          }
          next.bao.queue.day = qDay
          next.bao.queue.n += 1
          queueVal =
            String(qCfg.prefix || '') +
            String(next.bao.queue.n).padStart(Math.max(1, Number(qCfg.pad) || 1), '0')
        }

        const o: OrderRecord = {
          id: oid,
          title:
            builtLines.length === 1
              ? (builtLines[0].qty > 1 ? `${builtLines[0].qty} × ` : '') +
                builtLines[0].name
              : `${builtLines.reduce((a, l) => a + l.qty, 0)} items from RTU Pasig Campus Store`,
          total,
          status: 'Completed',
          tab: 'Completed',
          seller: 'RTU Pasig Campus Store',
          when: `Face to face, ${baoDate(input.date)}`,
          stage: 4,
          tone: firstProd.tone,
          icon: firstProd.icon,
          buyerEmail: acct ? acct.email : email,
          sellerEmail: null,
          lines: builtLines.map((l) => {
            const prod = next.official.find((x) => x.id === l.pid)
            const vr = l.vid && prod ? findVar(prod, l.vid) : undefined
            return {
              pid: l.pid,
              qty: l.qty,
              vid: l.vid,
              vlabel: vr && prod ? varLabel(prod, vr) : '',
              price: l.price,
            }
          }),
        }

        const newTxn: TransactionRecord = {
          id: txnId,
          orderId: o.id,
          type: 'official',
          kind: 'product',
          lines: builtLines,
          summary: builtLines
            .map((l) => l.name + (l.qty > 1 ? ' × ' + l.qty : ''))
            .join(', '),
          qty: builtLines.reduce((a, l) => a + l.qty, 0),
          total,
          buyerEmail: acct ? acct.email : email,
          buyerName: name,
          buyerSid: acct ? acct.sid : sid,
          sellerEmail: null,
          sellerName: 'RTU Pasig Campus Store',
          sellerSid: '',
          meetup: o.when,
          created: whenDate.toISOString(),
          updated: whenDate.toISOString(),
          status: 'Completed',
          history: [
            {
              status: 'Completed',
              ts: whenDate.toISOString(),
              by: currentAccount.name,
              note: 'Face to face entry',
            },
          ],
          bst: 'Claimed',
          src: 'Face to face',
          queue: queueVal,
          pickup: input.date,
          note: input.notes.trim(),
          staff: currentAccount.name,
          staffEmail: currentAccount.email,
          bhist: [
            {
              from: null,
              to: 'Claimed',
              by: currentAccount.name,
              byEmail: currentAccount.email,
              ts: whenDate.toISOString(),
              note:
                'Face to face entry. Handed over at the counter.' +
                (input.notes.trim() ? ' ' + input.notes.trim() : ''),
            },
          ],
        }

        next.txn.push(newTxn)
        const targetAcct = acct
          ? next.accounts.find((a) => a.email === acct.email)
          : undefined
        if (targetAcct) {
          targetAcct.orders.unshift(o)
          targetAcct.notifs.unshift({
            t: `The BAO recorded a face to face claim for ${o.title}. Ticket ${newTxn.id}.`,
            read: false,
            ts: nowT(),
            at: whenDate.toISOString(),
            link: { k: 'order', id: o.id },
          })
        }

        next.audit.push({
          id: 'au' + uid(),
          ts: whenDate.toISOString(),
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'face to face entry',
          targetType: 'ticket',
          targetId: newTxn.id,
          targetName: newTxn.summary,
          note: `${name}${sid ? ' (' + sid + ')' : ''}`,
        })

        outcome = { ok: true, txnId: newTxn.id, queue: queueVal }
        return next
      })

      return outcome
    },
    [currentAccount, isStaffUser, db.accounts, db.official, db.bao, db.txn],
  )

  const baoSaveDailyReconciliation = useCallback(
    (
      counts: Record<string, string>,
      reasons: Record<string, string>,
    ): { ok: boolean; msg?: string; recId?: string } => {
      if (!currentAccount || !isStaffUser) {
        return { ok: false, msg: 'Only RTU staff can do that.' }
      }
      const allUnits: Array<ReturnType<typeof baoUnits>[0]> = []
      db.official
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((p) => {
          baoUnits(p).forEach((u) => allUnits.push(u))
        })

      const lines: Array<{
        u: (typeof allUnits)[0]
        n: number
        diff: number
        reason: string
      }> = []

      for (const u of allUnits) {
        const k = `${u.p.id}|${u.vid}`
        const cVal = counts[k]
        if (cVal === undefined || cVal === '') continue
        const n = parseInt(cVal, 10)
        if (!Number.isInteger(n) || n < 0) {
          return { ok: false, msg: `${baoUnitName(u)}: the count must be 0 or more.` }
        }
        const diff = n - u.onHand
        const reason = String(reasons[k] || '').trim()
        if (diff !== 0 && !reason) {
          return {
            ok: false,
            msg: `${baoUnitName(u)} is different (${diff > 0 ? '+' : ''}${diff}). Add a reason.`,
          }
        }
        lines.push({ u, n, diff, reason })
      }

      if (!lines.length) {
        return { ok: false, msg: 'Enter at least one count.' }
      }

      let outcome: { ok: boolean; msg?: string; recId?: string } = { ok: true }

      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        const adj = lines.filter((l) => l.diff !== 0)
        next.bao.seq.rec += 1
        const rid = 'R-' + String(next.bao.seq.rec).padStart(4, '0')

        if (adj.length) {
          const r = applyLedgerOnSnapshot(
            next,
            adj.map((l) => ({
              pid: l.u.p.id,
              vid: l.u.vid,
              type: 'Adjustment' as const,
              qty: l.diff,
              reason: `Daily count ${rid}: ${l.reason}`,
            })),
            { by: currentAccount.name, byEmail: currentAccount.email },
          )
          if (!r.ok) {
            next.bao.seq.rec -= 1
            outcome =
              r.msg && /reserved|available/.test(r.msg)
                ? {
                    ok: false,
                    msg: `${r.msg} Put the tickets on hold or cancel them first, then count again.`,
                  }
                : r
            return prev
          }
        }

        const now = new Date().toISOString()
        const rec: BaoReconRecord = {
          id: rid,
          ts: now,
          day: new Date().toLocaleDateString('en-CA'),
          by: currentAccount.name,
          byEmail: currentAccount.email,
          lines: lines.map((l) => ({
            pid: l.u.p.id,
            item: l.u.p.name,
            vid: l.u.vid,
            label: l.u.label,
            expected: l.u.onHand,
            counted: l.n,
            diff: l.diff,
            reason: l.reason,
          })),
        }
        next.bao.recon.push(rec)
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'daily count',
          targetType: 'inventory',
          targetId: rid,
          targetName: 'Daily count',
          note: `${lines.length} counted, ${adj.length} different`,
        })
        outcome = { ok: true, recId: rid }
        return next
      })

      // The server keeps its own count rows and writes the adjustment from
      // them; the local record above is the screen's log. One POST per counted
      // variant, because the API takes one variant at a time.
      if (outcome.ok) {
        lines.forEach((l) => {
          if (!/^v\d+$/.test(l.u.vid)) return
          void recordDailyCount(Number(l.u.vid.slice(1)), l.n, l.reason)
            .then(() => refreshStore())
            .catch((err: unknown) => {
              toast(
                err instanceof ApiRequestError
                  ? err.message
                  : 'The server did not accept that count.',
              )
              void refreshStore()
            })
        })
      }

      return outcome
    },
    [currentAccount, isStaffUser, db.official, refreshStore, toast],
  )

  const baoSaveEmailSettings = useCallback(
    (
      events: Record<string, boolean>,
      lowStock: boolean,
      lowStockToText: string,
    ): boolean => {
      if (!currentAccount || !isStaffUser) {
        toast('Only RTU staff can do that.')
        return false
      }
      const toList = lowStockToText
        .split(/[,;\s]+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
      const badMail = toList.find((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))
      if (badMail) {
        toast(`That email does not look right: ${badMail}`)
        return false
      }
      const now = new Date().toISOString()
      setDb((prev) => {
        const next: DatabaseSnapshot = JSON.parse(JSON.stringify(prev))
        next.bao.email = {
          ...baoDefaultEmailConfig(next.bao.email),
          events: { ...events },
          lowStock,
          lowStockTo: [...new Set(toList)],
          enabled: false,
        }
        next.audit.push({
          id: 'au' + uid(),
          ts: now,
          by: currentAccount.email,
          byName: currentAccount.name,
          action: 'email settings',
          targetType: 'settings',
          targetId: '',
          targetName: 'Email',
          note: 'Prepared messages settings changed',
        })
        return next
      })
      toast('Email settings saved. Nothing is sent.')
      return true
    },
    [currentAccount, isStaffUser, toast],
  )

  const baoExportPreparedEmailsJson = useCallback(() => {
    if (!currentAccount || !isStaffUser) {
      toast('Only RTU staff can do that.')
      return
    }
    const payload = JSON.stringify(
      {
        note: 'Prepared by RTU Tindahan. None of these were sent.',
        messages: db.bao.outbox,
      },
      null,
      2,
    )
    const u = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = u
    a.download = `rtu-prepared-emails-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(u), 500)
  }, [currentAccount, isStaffUser, db.bao.outbox, toast])

  const resetEverything = useCallback(() => {
    if (!isStaffUser) {
      toast('Only RTU staff can do that.')
      return
    }
    clearAllImgs()
    try {
      localStorage.removeItem(DBK)
    } catch {
      /* ignore */
    }
    const fresh = defaultDbState()
    lastSavedRef.current = JSON.stringify(fresh)
    setDb(fresh)
    setActiveModal(null)
    setConfirmDialog(null)
    toast('Everything has been reset to a clean slate.')
  }, [isStaffUser, toast])

  const storageKb = useMemo(() => {
    const raw = JSON.stringify(db)
    return Math.max(1, Math.round(raw.length / 1024))
  }, [db])

    // Open (or find) the server thread with another member and jump to it.
  const openThreadWith = useCallback(
    async (input: {
      sellerEmail?: string
      buyerEmail?: string
      listingSlug?: string | null
    }): Promise<boolean> => {
      try {
        const conversation = await openConversation(input)
        await refreshConversations()
        setSelectedConvId(`api:cv-${conversation.id}`)
        navigate('messages')
        return true
      } catch (err) {
        toast(
          err instanceof ApiRequestError
            ? err.message
            : 'Could not open that conversation.',
        )
        return false
      }
    },
    [refreshConversations, toast],
  )

  // One call for both sides of an order: the seller accepts, declines or
  // completes; the buyer cancels. The server decides which is allowed.
  const actOnOrder = useCallback(
    async (
      reference: string,
      status: 'accepted' | 'declined' | 'completed' | 'cancelled',
    ): Promise<boolean> => {
      try {
        await transitionApiOrder(reference, status)
        await refreshOrders()
        toast(`Order ${reference} is now ${status}.`)
        return true
      } catch (err) {
        toast(
          err instanceof ApiRequestError
            ? err.message
            : 'The server did not accept that change.',
        )
        return false
      }
    },
    [refreshOrders, toast],
  )

const value = useMemo<TindahanContextValue>(
    () => ({
      db,
      currentAccount,
      isStaffUser,
      isAdminUser,
      canModerate,
      storageOk,
      storageKb,
      listingsLoading,
      pendingListings,
      myListings,
      refreshMyListings,
      apiOrders,
      refreshOrders,
      setOrderPaymentMethod,
      actOnOrder,
      openThreadWith,
      moderateListing,
      hasSettledInitialFetch,
      toastMsg,
      toast,
      activeModal,
      openModal,
      closeModal,
      confirmDialog,
      confirmDlg,
      closeConfirmDlg,
      allOnSale,
      allProducts,
      allServices,
      byId,
      sellerKind,
      sellerKeyOf,
      sellerKeyByName,
      sellerNameOf,
      acctByEmail,
      ratingOf,
      salesIndex,
      sortProducts,
      orderRateable,
      reviewOf,
      submitReview,
      confirmDeleteReview,
      browseState,
      setBrowseState,
      browseFor,
      clearBrowseFilters,
      selectedProductId,
      setSelectedProductId,
      openProduct,
      selectedPostId,
      highlightedCommentId,
      openPost,
      toggleFav,
      toggleSellerFav,
      cartCount,
      cartTotal,
      cartStep,
      setCartStep,
      cartMsg,
      setCartMsg,
      cartPayment,
      setCartPayment,
      cartAgree,
      setCartAgree,
      cartErr,
      setCartErr,
      selectedCartItems,
      addToCart,
      reserveNow,
      updateCartQty,
      removeCartLine,
      toggleCartEdit,
      toggleCartSelect,
      toggleCartSelectAll,
      updateCartMeetup,
      sendMeetupRequest,
      lastOrderId,
      lastOrderIds,
      selectedOrderId,
      setSelectedOrderId,
      orderTab,
      setOrderTab,
      proposeOrderMeetup,
      confirmOrderPickup,
      cancelOrderRequest,
      cancelMultipleOrders,
      shopTab,
      setShopTab,
      draft,
      setDraft,
      listStep,
      setListStep,
      draftErrs,
      setDraftErrs,
      startEditListing,
      cancelEditListing,
      saveListingDraftToAccount,
      validateCurrentListingForSubmit,
      submitListingStepOrPublish,
      toggleSellerListingPause,
      deleteSellerListing,
      respondSellerRequest,
      toggleChecklist,
      continueSellerSetup,
      toggleSellingWindow,
      saveProfile,
      markAllNotifsRead,
      openNotification,
      selectedConvId,
      setSelectedConvId,
      myConversations,
      unreadMessagesCount,
      unreadInConv,
      startProductConversation,
      sendOrderMessage,
      openSellerRequestChat,
      sendChatMessage,
      reactToChatMessage,
      markConvRead,
      openContextOrder,
      createForumPost,
      editForumPost,
      deleteForumPost,
      toggleForumReaction,
      togglePinPost,
      toggleHidePost,
      addForumComment,
      editForumComment,
      deleteForumComment,
      toggleHideComment,
      submitForumReport,
      submitOrderReport,
      setForumReportStatus,
      applyForumModerationAction,
      selectedFlagId,
      setSelectedFlagId,
      modTab,
      setModTab,
      decideFlag,
      reopenFlag,
      adminSetUserStatus,
      adminRemoveListing,
      adminRestoreListing,
      adminPauseListing,
      adminResumeListing,
      adminActTransaction,
      exportTransactionsCsv,
      saveOfficialProduct,
      toggleHideOfficialProduct,
      deleteOfficialProduct,
      postStaffAnnouncement,
      deleteStaffAnnouncement,
      exportDatabaseBackup,
      resetEverything,
      imgVersion,
      bumpImgVersion,
      baoTab,
      setBaoTab,
      baoSearch,
      setBaoSearch,
      baoStatusFilter,
      setBaoStatusFilter,
      invTab,
      setInvTab,
      baoOrderProblem,
      baoTransitionTicket,
      baoSaveOrderSettings,
      baoApplyStockMove,
      baoSaveItemSettings,
      baoStartItemSizes,
      baoAddItemSizeRow,
      baoRemoveItemSizeRow,
      baoSaveItemTypes,
      baoSaveStoreWindowAndLimit,
      baoCreateFaceToFaceOrder,
      baoSaveDailyReconciliation,
      baoSaveEmailSettings,
      baoExportPreparedEmailsJson,
    }),
    [
      db,
      pendingListings,
      myListings,
      refreshMyListings,
      apiOrders,
      refreshOrders,
      setOrderPaymentMethod,
      actOnOrder,
      openThreadWith,
      moderateListing,
      currentAccount,
      isStaffUser,
      canModerate,
      storageOk,
      storageKb,
      toastMsg,
      toast,
      activeModal,
      openModal,
      closeModal,
      confirmDialog,
      confirmDlg,
      closeConfirmDlg,
      allOnSale,
      allProducts,
      allServices,
      byId,
      sellerKind,
      sellerKeyOf,
      sellerKeyByName,
      sellerNameOf,
      acctByEmail,
      ratingOf,
      salesIndex,
      sortProducts,
      orderRateable,
      reviewOf,
      submitReview,
      confirmDeleteReview,
      browseState,
      browseFor,
      clearBrowseFilters,
      selectedProductId,
      openProduct,
      selectedPostId,
      highlightedCommentId,
      openPost,
      toggleFav,
      toggleSellerFav,
      cartCount,
      cartTotal,
      cartStep,
      cartMsg,
      cartPayment,
      cartAgree,
      cartErr,
      addToCart,
      reserveNow,
      updateCartQty,
      removeCartLine,
      toggleCartEdit,
      toggleCartSelect,
      toggleCartSelectAll,
      updateCartMeetup,
      sendMeetupRequest,
      lastOrderId,
      lastOrderIds,
      selectedOrderId,
      orderTab,
      proposeOrderMeetup,
      confirmOrderPickup,
      cancelOrderRequest,
      cancelMultipleOrders,
      shopTab,
      draft,
      listStep,
      draftErrs,
      startEditListing,
      cancelEditListing,
      saveListingDraftToAccount,
      validateCurrentListingForSubmit,
      submitListingStepOrPublish,
      toggleSellerListingPause,
      deleteSellerListing,
      respondSellerRequest,
      toggleChecklist,
      continueSellerSetup,
      toggleSellingWindow,
      saveProfile,
      markAllNotifsRead,
      openNotification,
      selectedConvId,
      myConversations,
      unreadMessagesCount,
      unreadInConv,
      startProductConversation,
      sendOrderMessage,
      openSellerRequestChat,
      sendChatMessage,
      reactToChatMessage,
      markConvRead,
      openContextOrder,
      createForumPost,
      editForumPost,
      deleteForumPost,
      toggleForumReaction,
      togglePinPost,
      toggleHidePost,
      addForumComment,
      editForumComment,
      deleteForumComment,
      toggleHideComment,
      submitForumReport,
      submitOrderReport,
      setForumReportStatus,
      applyForumModerationAction,
      selectedFlagId,
      modTab,
      decideFlag,
      reopenFlag,
      adminSetUserStatus,
      adminRemoveListing,
      adminRestoreListing,
      adminPauseListing,
      adminResumeListing,
      adminActTransaction,
      exportTransactionsCsv,
      saveOfficialProduct,
      toggleHideOfficialProduct,
      deleteOfficialProduct,
      postStaffAnnouncement,
      deleteStaffAnnouncement,
      exportDatabaseBackup,
      resetEverything,
      imgVersion,
      bumpImgVersion,
      baoTab,
      baoSearch,
      baoStatusFilter,
      invTab,
      baoOrderProblem,
      baoTransitionTicket,
      baoSaveOrderSettings,
      baoApplyStockMove,
      baoSaveItemSettings,
      baoStartItemSizes,
      baoAddItemSizeRow,
      baoRemoveItemSizeRow,
      baoSaveItemTypes,
      baoSaveStoreWindowAndLimit,
      baoCreateFaceToFaceOrder,
      baoSaveDailyReconciliation,
      baoSaveEmailSettings,
      baoExportPreparedEmailsJson,
    ],
  )

  return <TindahanContext.Provider value={value}>{children}</TindahanContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTindahan(): TindahanContextValue {
  const ctx = useContext(TindahanContext)
  if (!ctx) throw new Error('useTindahan must be used inside <TindahanProvider>')
  return ctx
}
