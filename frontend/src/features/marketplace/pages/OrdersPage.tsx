import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/common/components/Icon'
import type { IconName } from '@/common/components/icons'
import { ItemTitleWithVariant } from '@/common/components/ItemTitleWithVariant'
import { navigate } from '@/common/router/router'
import {
  BAO_PILL,
  BAO_STEPS,
  baoClaimNotes,
  baoDate,
  baoIsOfficialOrder,
  baoIsOfficialTxn,
  baoProgress,
  baoStatusOf,
  baoTxnFor,
} from '../baoHelpers'
import {
  PLACES,
  TIMES,
  getSellerTimeWindows,
  peso,
  stamp,
} from '../constants'
import { useTindahan } from '../context/TindahanContext'
import { imgSrc, imgsOf } from '../imageStore'
import type { OrderRecord, TransactionRecord } from '../types'
import { StarPicker, StarsDisplay } from '../components/StarRating'
import './OrdersPage.css'

export function BaoProgressBar({ txn }: { txn: TransactionRecord }) {
  const p = baoProgress(txn)
  return (
    <ol className="bstep" aria-label="Request progress">
      {BAO_STEPS.map((s, i) => {
        let cls = i < p.idx ? 'done' : i === p.idx ? 'cur' : 'todo'
        let mark: React.ReactNode = i < p.idx ? <Icon name="check" size="sm" /> : String(i + 1)
        let label: string = s

        if (i === p.idx && p.cur === 'Claimed') {
          cls = 'done'
          mark = <Icon name="check" size="sm" />
        }
        if (i === p.idx && p.hold) {
          cls = 'hold'
          mark = 'II'
          label = 'On Hold'
        }
        if (i === p.idx && p.cancelled) {
          cls = 'stop'
          mark = 'X'
          label = 'Cancelled'
        }
        return (
          <li key={s} className={cls}>
            <span className="dot">{mark}</span>
            <span className="lbl">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function OrdersPage() {
  const {
    db,
    currentAccount,
    orderTab,
    setOrderTab,
    selectedOrderId,
    setSelectedOrderId,
    byId,
    proposeOrderMeetup,
    confirmOrderPickup,
    confirmDlg,
    cancelOrderRequest,
    cancelMultipleOrders,
    myConversations,
    setSelectedConvId,
    orderRateable,
    reviewOf,
    submitReview,
    openModal,
  } = useTindahan()

  const [openBox, setOpenBox] = useState<'' | 'edit'>('')
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [isMobile, setIsMobile] = useState(window.matchMedia('(max-width: 1000px)').matches)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const ordersTabsRef = useRef<HTMLDivElement>(null)
  const [tabDropdownOpen, setTabDropdownOpen] = useState(false)
  const tabDropdownRef = useRef<HTMLDivElement>(null)
  const presetPlaces = PLACES.filter((pl) => pl !== 'Others')
  const [editPlace, setEditPlace] = useState(PLACES[0])
  const [editOthersMode, setEditOthersMode] = useState(false)
  const [editTime, setEditTime] = useState(TIMES[0])

  const orders = currentAccount?.orders || []
  const tabs: ('Requesting' | 'For Pickup' | 'Completed' | 'Cancelled')[] = ['Requesting', 'For Pickup', 'Completed', 'Cancelled']

  if (!currentAccount) return null

  const isRequestingOrder = (o: OrderRecord): boolean => {
    if (o.tab !== 'Active') return false
    const t = baoTxnFor(o, db.txn ?? [])
    if (baoIsOfficialTxn(t) && t) {
      const st = baoStatusOf(t)
      return st === 'Request Received'
    }
    return o.status === 'Awaiting seller' || o.stage <= 1
  }

  const isForPickupOrder = (o: OrderRecord): boolean => {
    if (o.tab !== 'Active') return false
    const t = baoTxnFor(o, db.txn ?? [])
    if (baoIsOfficialTxn(t) && t) {
      const st = baoStatusOf(t)
      return st === 'Confirmed' || st === 'Ready for Pickup'
    }
    return o.status === 'Meetup set' || o.stage >= 2
  }

  const list = orders.filter((o) => {
    if (orderTab === 'Requesting') return isRequestingOrder(o)
    if (orderTab === 'For Pickup') return isForPickupOrder(o)
    return o.tab === orderTab
  })

  const listIdsKey = list.map((o) => o.id).join(',')

  useEffect(() => {
    if (!list.length) {
      if (selectedOrderId !== null) setSelectedOrderId(null)
      return
    }
    if (!list.some((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(list[0].id)
    }
  }, [orderTab, listIdsKey, selectedOrderId, setSelectedOrderId])

  useEffect(() => {
    setOpenBox('')
  }, [orderTab, selectedOrderId])

  // Scroll active tab into center when orderTab changes
  useEffect(() => {
    const el = ordersTabsRef.current
    if (!el) return
    const active = el.querySelector('.tab.on') as HTMLElement | null
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [orderTab])

  // Track mobile breakpoint; lock body scroll while a mobile sheet is open
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1000px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', handler)

    const shouldLock = isMobile && mobileDetailOpen
    document.documentElement.classList.toggle('orders-sheet-open', shouldLock)
    document.body.classList.toggle('orders-sheet-open', shouldLock)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileDetailOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      mq.removeEventListener('change', handler)
      document.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('orders-sheet-open')
      document.body.classList.remove('orders-sheet-open')
    }
  }, [isMobile, mobileDetailOpen])

  // Track tabs scroll position to show/hide edge fade masks
  useEffect(() => {
    const el = ordersTabsRef.current
    if (!el) return
    const update = () => {
      setAtStart(el.scrollLeft <= 2)
      setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 2)
    }
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  // Close order status dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tabDropdownOpen &&
        tabDropdownRef.current &&
        !tabDropdownRef.current.contains(e.target as Node)
      ) {
        setTabDropdownOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && tabDropdownOpen) {
        setTabDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [tabDropdownOpen])

  const sel = list.find((o) => o.id === selectedOrderId) || list[0]

  const renderOrderPill = (o: OrderRecord) => {
    const t = baoTxnFor(o, db.txn ?? [])
    if (baoIsOfficialTxn(t) && t) {
      const st = baoStatusOf(t)
      return <span className={`pill ${BAO_PILL[st] || ''}`.trim()}>{st}</span>
    }
    return (
      <span
        className={`pill ${
          o.tab === 'Completed' ? 'green' : o.tab === 'Cancelled' ? 'red' : 'yellow'
        }`}
      >
        {o.status}
      </span>
    )
  }

  const renderOrderThumb = (o: OrderRecord, size: number) => {
    const pid = o.lines && o.lines[0] && o.lines[0].pid
    const prod = pid ? byId(pid) : undefined
    const imgs = prod ? imgsOf(prod) : []
    const src = imgs.length ? imgSrc(imgs[0]) : ''
    return (
      <div
        className={`photo ${o.tone || 't-study'} ${src ? 'has-img' : 'nophoto-tile'}`.trim()}
        style={{ width: size, height: size, aspectRatio: '1', flex: 'none' }}
      >
        {src ? <img className="pimg" src={src} alt={o.title} /> : null}
        <Icon name={(o.icon || 'bag') as IconName} />
      </div>
    )
  }

  const sellerAccepted = sel ? sel.status === 'Meetup set' : false

  // Strict cancel check: only while still pending (Requesting).
  // Allowed: Active + status Awaiting seller / Pending / stage <= 1 (student seller),
  //          or BAO status Request Received (Official RTU Store).
  // Blocked: Meetup set, Confirmed, Ready, Completed, Cancelled.
  const canCancelOrder = (o?: OrderRecord): boolean => {
    if (!o || o.tab !== 'Active') return false
    if (o.status === 'Completed' || o.status === 'Cancelled') return false
    const t = baoTxnFor(o, db.txn ?? [])
    if (baoIsOfficialTxn(t) && t) {
      const st = baoStatusOf(t)
      return st === 'Request Received'
    }
    return o.status === 'Awaiting seller' || o.stage <= 1
  }

  const selCanCancel = canCancelOrder(sel)

  const cancellableList = orderTab === 'Requesting' ? list.filter(canCancelOrder) : []

  const allSelected =
    cancellableList.length > 0 &&
    cancellableList.every((o) => selectedOrderIds.has(o.id))

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedOrderIds(new Set())
    } else {
      setSelectedOrderIds(new Set(cancellableList.map((o) => o.id)))
    }
  }

  const cleanWhen = (when?: string) => (when || '').replace(/^(Pickup|Delivery)\s*·\s*/i, '').trim()

  const selFirstProd = sel && sel.lines && sel.lines[0] ? byId(sel.lines[0].pid) : undefined
  const selTimeOptions = selFirstProd ? getSellerTimeWindows(selFirstProd) : TIMES

  const sheetContent = (s: typeof sel) => {
    const sTxn = baoTxnFor(s, db.txn ?? [])
    const sIsOfficial = Boolean(
      s && baoIsOfficialOrder(s, db.txn ?? []) && sTxn,
    )

    return (
    <>
      {/* Official Store BAO Ticket Card (v1.6 baoTicketHtml) */}
      {sIsOfficial && sTxn && (
        <div className="ticket stack" data-ticket={sTxn.id}>
          <div className="row between wrap">
            <div>
              <span className="tiny muted">TICKET REFERENCE</span>
              <div className="tk-id tnum">{sTxn.id}</div>
            </div>
            {sTxn.queue && (
              <div style={{ textAlign: 'right' }}>
                <span className="tiny muted">QUEUE NUMBER</span>
                <div className="tk-id tnum">{sTxn.queue}</div>
              </div>
            )}
          </div>

          <BaoProgressBar txn={sTxn} />

          {baoStatusOf(sTxn) === 'On Hold' && (
            <div className="note" role="status">
              <Icon name="clock" />
              <span>
                <b>On hold.</b>{' '}
                {sTxn.note || 'The BAO will update this request.'}
              </span>
            </div>
          )}

          {baoStatusOf(sTxn) === 'Cancelled' && (
            <div className="note" role="status">
              <Icon name="info" />
              <span>
                <b>Cancelled.</b> {sTxn.note || ''}
              </span>
            </div>
          )}

          <div className="grid2 small">
            <div>
              <span className="tiny muted">REQUESTED</span>
              <br />
              <b>{stamp(sTxn.created)}</b>
            </div>
            <div>
              <span className="tiny muted">PICKUP DATE</span>
              <br />
              <b>
                {sTxn.pickup
                  ? baoDate(sTxn.pickup)
                  : 'Not set yet. The BAO will update it.'}
              </b>
            </div>
          </div>

          <div className="stack" style={{ gap: 4 }}>
            <span className="tiny muted">ITEMS</span>
            {sTxn.lines.map((l, idx) => (
              <div
                key={idx}
                className="small"
                style={{ overflowWrap: 'anywhere' }}
              >
                <ItemTitleWithVariant title={l.name} /> × {l.qty}
              </div>
            ))}
          </div>

          {(() => {
            const notes = baoClaimNotes(db.bao, db.official, sTxn)
            return notes.length ? (
              <div className="note blue">
                <Icon name="info" />
                <span>
                  <b>Claim notes.</b> {notes.join(' ')}
                </span>
              </div>
            ) : null
          })()}

          <div>
            <b className="small">Updates</b>
            <div className="tl" style={{ marginTop: 6 }}>
              {(sTxn.bhist || [])
                .slice()
                .reverse()
                .map((h, idx) => (
                  <div key={idx}>
                    <b className="small">{h.to}</b>{' '}
                    <span className="tiny muted">{stamp(h.ts)}</span>
                    {h.note && <div className="tiny muted">{h.note}</div>}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {!sIsOfficial && (s.lines || []).some((l) => l.vlabel) && (
        <div className="stack" style={{ gap: 4 }}>
          {(s.lines || []).map((l, idx) => {
            const prod = byId(l.pid)
            return (
              <div key={idx} className="small muted">
                {l.qty} × <ItemTitleWithVariant title={prod ? prod.name : s.title} variant={l.vlabel} />
              </div>
            )
          })}
        </div>
      )}

      {!sIsOfficial &&
        (s.tab !== 'Cancelled' ? (
          <div className="stack" style={{ gap: 10 }}>
            <ol className="bstep bstep-3" aria-label="Order progress">
              {[
                { label: 'Requested', stageThreshold: 1 },
                { label: 'Meetup set', stageThreshold: 2 },
                { label: 'Completed', stageThreshold: 4 },
              ].map((step, i) => {
                const currentStep =
                  s.tab === 'Completed' || s.stage >= 4
                    ? 4
                    : s.status === 'Meetup set' || s.stage >= 2
                      ? 2
                      : 1
                const isDone = currentStep > i + 1
                const isCur = currentStep === i + 1
                return (
                  <li
                    key={step.label}
                    className={isDone ? 'done' : isCur ? 'cur' : 'todo'}
                  >
                    <span className="dot">
                      {isDone ? (
                        <Icon name="check" size="sm" />
                      ) : (
                        String(i + 1)
                      )}
                    </span>
                    <span className="lbl">{step.label}</span>
                  </li>
                )
              })}
            </ol>

            {s.tab === 'Active' && s.proofPhoto && imgSrc(s.proofPhoto) && (
              <div
                className="card flat stack"
                style={{ background: 'var(--bg)', padding: 12, gap: 6 }}
              >
                <div className="row between wrap">
                  <b className="small">
                    Meetup / Pickup Photo Proof
                  </b>
                  <span className="pill green">Proof uploaded</span>
                </div>
                <img
                  src={imgSrc(s.proofPhoto)}
                  alt="Meetup proof"
                  style={{
                    width: '100%',
                    maxWidth: 260,
                    maxHeight: 200,
                    objectFit: 'cover',
                    borderRadius: 10,
                    border: '1px solid var(--line)',
                  }}
                />
                <span className="tiny muted">
                  Uploaded by {s.proofBy || 'Seller'}
                  {s.proofAt ? ` · ${stamp(s.proofAt)}` : ''}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div
            className="note"
            style={{ background: 'var(--red-bg)', borderColor: 'transparent' }}
          >
            This request was cancelled. No payment was made.
          </div>
        ))}

      <div
        className="card flat stack orders-detail-meta"
        style={{ background: 'var(--bg)', gap: 6 }}
      >
        <div className="row between small">
          <span className="muted">Seller</span>
          <b>{s.seller}</b>
        </div>
        <div className="row between small">
          <span className="muted">Fulfillment method</span>
          <span className={`pill ${s.fulfillment === 'delivery' ? 'blue' : 'green'}`}>
            {s.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}
          </span>
        </div>
        <div className="row between small">
          <span className="muted">
            {s.fulfillment === 'delivery' ? 'Delivery schedule' : 'Meetup'}
          </span>
          <b>{cleanWhen(s.when)}</b>
        </div>
        <div className="row between small">
          <span className="muted">Pay on meetup</span>
          <b className="tnum">{peso(s.total)}</b>
        </div>
      </div>

      {s.tab === 'Active' && (
        <>
          <div className="order-actions">
            {!sIsOfficial && (
              <>
                <button
                  type="button"
                  className="btn sm"
                  disabled={!sellerAccepted}
                  aria-disabled={!sellerAccepted}
                  onClick={() => {
                    confirmDlg({
                      title:
                        'Confirm ' +
                        (s.fulfillment === 'delivery' ? 'delivery' : 'pickup') +
                        '?',
                      msg: `Only confirm once you have received "${s.title}" from ${s.seller} and paid in person. This marks the order as completed and lets the seller know.`,
                      yes: 'Yes, I received it',
                      no: 'Not yet',
                      danger: false,
                      run: () => {
                        confirmOrderPickup(s.id, s.proofPhoto || null)
                        setMobileDetailOpen(false)
                      },
                    })
                  }}
                >
                  <Icon name="check" size="sm" />
                  Confirm {s.fulfillment === 'delivery' ? 'delivery' : 'pickup'}
                </button>
              </>
            )}
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                const conv = myConversations.find((c) =>
                  s.sellerEmail ? c.seller === s.sellerEmail : !c.seller,
                )
                if (conv) setSelectedConvId(conv.id)
                navigate('messages')
              }}
            >
              <Icon name="msg" size="sm" />
              Message seller
            </button>
            {!sIsOfficial && (
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  const rawPlace = (s.when || '').split(',')[0] || ''
                  const cleanPl = rawPlace
                    .replace(/^(Pickup|Delivery)\s*·\s*/i, '')
                    .trim()
                  if (cleanPl) {
                    setEditPlace(cleanPl)
                    setEditOthersMode(!presetPlaces.includes(cleanPl))
                  }
                  setEditTime(selTimeOptions[0] || TIMES[0])
                  setOpenBox((cur) => (cur === 'edit' ? '' : 'edit'))
                }}
              >
                Reschedule
              </button>
            )}
            {!sIsOfficial && (
              <button
                type="button"
                className="btn ghost sm"
                onClick={() =>
                  openModal({
                    kind: 'order-report',
                    orderId: s.id,
                    role: 'buyer',
                    targetEmail: s.sellerEmail,
                    targetName: s.seller,
                    itemTitle: s.title,
                  })
                }
              >
                <Icon name="flag" size="sm" />
                Report issue
              </button>
            )}
            {selCanCancel ? (
              <button
                type="button"
                className="btn danger sm"
                onClick={() => {
                  cancelOrderRequest(s.id)
                  setMobileDetailOpen(false)
                }}
              >
                Cancel request
              </button>
            ) : null}
          </div>

          {!sellerAccepted && !sIsOfficial && (
            <div className="note blue">
              <Icon name="info" size="sm" />
              <span>
                Confirm {s.fulfillment === 'delivery' ? 'delivery' : 'pickup'} unlocks once the seller accepts your request.
              </span>
            </div>
          )}

          {!sIsOfficial && openBox === 'edit' && (
            <form
              className="card flat stack"
              style={{ background: 'var(--bg)' }}
              onSubmit={(e) => {
                e.preventDefault()
                proposeOrderMeetup(s.id, editPlace, editTime)
                setOpenBox('')
              }}
            >
              <b className="small">Propose a new meetup</b>
              <div className="grid2">
                <div className="field">
                  <label htmlFor="oep">Location</label>
                  <select
                    className="input"
                    id="oep"
                    value={
                      editOthersMode || !presetPlaces.includes(editPlace)
                        ? 'Others'
                        : editPlace
                    }
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === 'Others') {
                        setEditOthersMode(true)
                        if (presetPlaces.includes(editPlace)) setEditPlace('')
                      } else {
                        setEditOthersMode(false)
                        setEditPlace(val)
                      }
                    }}
                  >
                    {PLACES.map((pl) => (
                      <option key={pl} value={pl}>
                        {pl}
                      </option>
                    ))}
                  </select>
                  {(editOthersMode || !presetPlaces.includes(editPlace)) && (
                    <input
                      className="input"
                      style={{ marginTop: 8 }}
                      placeholder="Write your specific campus spot..."
                      value={presetPlaces.includes(editPlace) ? '' : editPlace}
                      onChange={(e) => setEditPlace(e.target.value)}
                    />
                  )}
                </div>
                <div className="field">
                  <label htmlFor="oet">Time window</label>
                  <select
                    className="input"
                    id="oet"
                    value={
                      selTimeOptions.includes(editTime)
                        ? editTime
                        : selTimeOptions[0] || editTime
                    }
                    onChange={(e) => setEditTime(e.target.value)}
                  >
                    {selTimeOptions.map((tm) => (
                      <option key={tm} value={tm}>
                        {tm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setOpenBox('')}
                >
                  Cancel
                </button>
                <button type="submit" className="btn sm">
                  Save new time
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {!sIsOfficial && s.tab !== 'Active' && (
        <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() =>
              openModal({
                kind: 'order-report',
                orderId: s.id,
                role: 'buyer',
                targetEmail: s.sellerEmail,
                targetName: s.seller,
                itemTitle: s.title,
              })
            }
          >
            <Icon name="flag" size="sm" />
            Report issue with seller
          </button>
        </div>
      )}

      {/* Order review section for completed pickups (orderReviewHtml in js/9e-reviews-ranking.js) */}
      {orderRateable(s) && (
        <OrderReviewSection
          key={s.id}
          order={s}
          reviewOf={reviewOf}
          submitReview={submitReview}
          byId={byId}
        />
      )}
    </>
  )
}

  return (
    <>
      <div>
        <span className="eyebrow">MY ORDERS</span>
        <h1>Your requests and campus pickups</h1>
        <p className="muted small">
          Follow each meetup from request to in-person pickup.
        </p>
      </div>

      <div className={`orders-tabs-wrap${atStart ? ' at-start' : ''}${atEnd ? ' at-end' : ''}`}>
        <div className="tabs orders-tabs" role="tablist" ref={ordersTabsRef}>
          {tabs.map((t) => {
            const count = t === 'Requesting'
              ? orders.filter(isRequestingOrder).length
              : t === 'For Pickup'
                ? orders.filter(isForPickupOrder).length
                : orders.filter((o) => o.tab === t).length
            return (
              <button
                key={t}
                type="button"
                className={`tab ${orderTab === t ? 'on' : ''}`.trim()}
                role="tab"
                aria-selected={orderTab === t}
                onClick={(e) => {
                  setOrderTab(t)
                  setOpenBox('')
                  setMobileDetailOpen(false)
                  ;(e.currentTarget as HTMLElement).scrollIntoView({
                    behavior: 'smooth',
                    inline: 'center',
                    block: 'nearest',
                  })
                }}
              >
                {t} <span className="tnum">({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Mobile: custom dropdown for order status tabs */}
      <div className="orders-tab-dropdown" ref={tabDropdownRef}>
        <button
          type="button"
          className="orders-tab-trigger"
          aria-haspopup="listbox"
          aria-expanded={tabDropdownOpen}
          onClick={() => setTabDropdownOpen((prev) => !prev)}
        >
          <span className="orders-tab-label">
            {orderTab}
            <span className="orders-tab-count">
              {orderTab === 'Requesting'
                ? orders.filter(isRequestingOrder).length
                : orderTab === 'For Pickup'
                  ? orders.filter(isForPickupOrder).length
                  : orders.filter((o) => o.tab === orderTab).length}
            </span>
          </span>
          <Icon name="chev" size="sm" className="orders-tab-chevron" />
        </button>
        {tabDropdownOpen && (
          <div
            className="orders-tab-menu"
            role="listbox"
            onClick={(e) => e.stopPropagation()}
          >
            {tabs.map((t) => {
              const count = t === 'Requesting'
                ? orders.filter(isRequestingOrder).length
                : t === 'For Pickup'
                  ? orders.filter(isForPickupOrder).length
                  : orders.filter((o) => o.tab === t).length
              return (
                <button
                  key={t}
                  type="button"
                  className={`orders-tab-option ${orderTab === t ? 'active' : ''}`.trim()}
                  role="option"
                  aria-selected={orderTab === t}
                  onClick={() => {
                    setOrderTab(t)
                    setTabDropdownOpen(false)
                  }}
                >
                  <span className="orders-tab-option-label">{t}</span>
                  <span className="orders-tab-option-count">{count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {!list.length ? (
        <div
          className="card stack"
          style={{ alignItems: 'center', textAlign: 'center', padding: 40 }}
        >
          <span style={{ color: 'var(--blue)' }}>
            <Icon name="bag" />
          </span>
          {orderTab === 'Requesting' ? (
            <>
              <b>No pending requests right now.</b>
              <p className="small muted">
                Your active requests awaiting seller confirmation will show here.
              </p>
            </>
          ) : orderTab === 'For Pickup' ? (
            <>
              <b>No items ready for pickup yet.</b>
              <p className="small muted">
                Accepted requests scheduled for meetup will show here.
              </p>
            </>
          ) : orderTab === 'Completed' ? (
            <>
              <b>No completed pickups.</b>
              <p className="small muted">
                Completed campus pickups will show here.
              </p>
            </>
          ) : (
            <>
              <b>No cancelled requests.</b>
              <p className="small muted">
                Cancelled requests will show here.
              </p>
            </>
          )}
          <button type="button" className="btn" onClick={() => navigate('browse')}>
            Browse listings
          </button>
        </div>
      ) : (
        <div className="orders-two two">
          {/* Left list of orders */}
          <div className="stack">
            {orderTab === 'Requesting' && cancellableList.length > 0 && (
              <div className="orders-select-bar">
                <label className="orders-check">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                  />
                  <b>
                    Select all ({selectedOrderIds.size} of {cancellableList.length})
                  </b>
                </label>
                {selectedOrderIds.size > 0 && (
                  <button
                    type="button"
                    className="btn danger sm"
                    onClick={() =>
                      cancelMultipleOrders(Array.from(selectedOrderIds))
                    }
                  >
                    Cancel selected ({selectedOrderIds.size})
                  </button>
                )}
              </div>
            )}
            {list.map((o) => {
              const isCancellable = orderTab === 'Requesting' && canCancelOrder(o)
              const isSelected = sel && sel.id === o.id
              return (
                <div
                  key={o.id}
                  role="button"
                  tabIndex={0}
                  className={`card row between order-list-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedOrderId(o.id)
                    setOpenBox('')
                    if (isMobile) setMobileDetailOpen(true)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedOrderId(o.id)
                      setOpenBox('')
                      if (isMobile) setMobileDetailOpen(true)
                    }
                  }}
                >
                  <div className="order-list-main">
                    {renderOrderThumb(o, 52)}
                    <div className="order-list-meta" style={{ minWidth: 0 }}>
                      <ItemTitleWithVariant
                        as="b"
                        title={o.title}
                        style={{ overflowWrap: 'anywhere', display: 'block' }}
                      />
                      <div className="tiny muted">
                        {o.id} · {o.seller}
                      </div>
                    </div>
                  </div>
                  <div className="order-list-right">
                    {renderOrderPill(o)}
                    <span className="price tnum" style={{ fontSize: 14 }}>
                      {peso(o.total)}
                    </span>
                  </div>
                  {isCancellable && (
                    <div className="order-list-check-col" onClick={(e) => e.stopPropagation()}>
                      <label className="orders-check">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.has(o.id)}
                          onChange={() => toggleSelectOrder(o.id)}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {isMobile && sel && (
            <div
              className={`order-detail-backdrop${mobileDetailOpen ? ' is-open' : ''}`}
              onClick={() => setMobileDetailOpen(false)}
            />
          )}

          {/* Right selected order detail */}
          {sel && (
            <>
              {/* Desktop: inline sheet */}
              {!isMobile && (
                <div
                  className="card stack orders-detail"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="row between wrap">
                    <div>
                      <span className="tiny muted">ORDER {sel.id}</span>
                      <h3 style={{ overflowWrap: 'anywhere' }}>{sel.title}</h3>
                    </div>
                    {renderOrderPill(sel)}
                  </div>
                  {sheetContent(sel)}
                </div>
              )}

              {/* Mobile: portal to document.body (above SiteFooter / .page-content-shell) */}
              {isMobile && sel && (
                <>
                  {createPortal(
                    <div
                      className={`order-detail-backdrop${mobileDetailOpen ? ' is-open' : ''}`}
                      onClick={() => setMobileDetailOpen(false)}
                      aria-hidden={!mobileDetailOpen}
                    />,
                    document.body
                  )}
                  {createPortal(
                    <div
                      className={`card stack orders-detail mobile-sheet sheet-open${mobileDetailOpen ? ' is-open' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                      aria-hidden={!mobileDetailOpen}
                    >
                      <div className="mobile-sheet-header">
                        <div>
                          <span className="tiny muted">ORDER {sel.id}</span>
                          <h3 style={{ overflowWrap: 'anywhere' }}>{sel.title}</h3>
                        </div>
                        <button
                          type="button"
                          className="sheet-close"
                          onClick={() => setMobileDetailOpen(false)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="mobile-sheet-body">
                        <div className="row between wrap">
                          <span className="status-pill">{renderOrderPill(sel)}</span>
                        </div>
                        {sheetContent(sel)}
                      </div>
                    </div>,
                    document.body
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

function OrderReviewSection({
  order,
  reviewOf,
  submitReview,
  byId,
}: {
  order: OrderRecord
  reviewOf: ReturnType<typeof useTindahan>['reviewOf']
  submitReview: ReturnType<typeof useTindahan>['submitReview']
  byId: ReturnType<typeof useTindahan>['byId']
}) {
  type ReviewDraft = { stars: number; text: string }
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({})

  const patchDraft = (k: string, patch: Partial<ReviewDraft>) =>
    setDrafts((prev) => ({
      ...prev,
      [k]: { stars: prev[k]?.stars ?? 0, text: prev[k]?.text ?? '', ...patch },
    }))

  const clearDraft = (k: string) =>
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[k]
      return next
    })

  const seenPids = new Set<string>()
  const lines = (order.lines || []).filter(
    (l) => l.pid && byId(l.pid) && !seenPids.has(l.pid) && seenPids.add(l.pid),
  )

  const renderBox = (
    kind: 'seller' | 'item',
    pid: string,
    title: string,
    sub: string,
  ) => {
    const k = kind === 'seller' ? `seller:${order.id}` : `item:${order.id}:${pid}`
    const ex = reviewOf(kind, order.id, pid)
    const draft = drafts[k]
    const isEditing = Boolean(ex) && Boolean(draft)

    if (ex && !isEditing) {
      return (
        <div
          key={k}
          className="card flat stack"
          style={{ gap: 6, background: 'var(--bg)' }}
        >
          <div className="row between wrap">
            <div>
              <b className="small">{title}</b>
              <div className="tiny muted">{sub}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <StarsDisplay avg={ex.stars} />
              <b className="small tnum">{ex.stars}.0</b>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  setDrafts((prev) => ({
                    ...prev,
                    [k]: { stars: ex.stars, text: ex.text || '' },
                  }))
                }}
              >
                Edit
              </button>
            </div>
          </div>
          {ex.text ? (
            <p className="small" style={{ overflowWrap: 'anywhere' }}>
              {ex.text}
            </p>
          ) : (
            <p className="tiny muted">No written review.</p>
          )}
        </div>
      )
    }

    return (
      <form
        key={k}
        className="card flat stack"
        style={{ gap: 8, background: 'var(--bg)' }}
        onSubmit={(e) => {
          e.preventDefault()
          if (submitReview(kind, order.id, pid, draft?.stars ?? 0, draft?.text ?? '')) {
            clearDraft(k)
          }
        }}
      >
        <div>
          <b className="small">{title}</b>
          <div className="tiny muted">{sub}</div>
        </div>
        <StarPicker
          value={draft?.stars ?? 0}
          label={title}
          onChange={(val) => patchDraft(k, { stars: val })}
        />
        <label className="field">
          <span className="tiny muted">Short review (optional, up to 500 characters)</span>
          <textarea
            className="input"
            maxLength={500}
            rows={2}
            placeholder="Was the item as described? How was the campus meetup?"
            value={draft?.text ?? ''}
            onChange={(e) => patchDraft(k, { text: e.target.value })}
          />
        </label>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          {ex && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => clearDraft(k)}
            >
              Cancel
            </button>
          )}
          <button type="submit" className="btn sm">
            {ex ? 'Update rating' : 'Submit rating'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div
      className="stack"
      style={{ gap: 10, borderTop: '1px solid var(--line)', paddingTop: 12 }}
    >
      <div>
        <b>Rate this completed pickup</b>
        <p className="tiny muted">
          Your rating helps other RTU students know who and what to trust.
        </p>
      </div>
      {renderBox(
        'seller',
        '',
        `Rate seller: ${order.seller}`,
        'How was the communication and campus meetup?',
      )}
      {lines.map((l) => {
        const p = byId(l.pid)
        if (!p) return null
        return renderBox(
          'item',
          p.id,
          `Rate item: ${p.name}`,
          'Was it in the condition described?',
        )
      })}
    </div>
  )
}
