import { useState, useEffect } from 'react'
import { Icon } from '@/common/components/Icon'
import type { IconName } from '@/common/components/icons'
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
import { PLACES, TIMES, getSellerTimeWindows, peso, stamp } from '../constants'
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
    apiOrders,
    actOnOrder,
    refreshOrders,
    openThreadWith,
  } = useTindahan()

  const [openBox, setOpenBox] = useState<'' | 'edit'>('')
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
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

  const selTxn = sel ? baoTxnFor(sel, db.txn ?? []) : null
  const selIsOfficial = Boolean(sel && baoIsOfficialOrder(sel, db.txn ?? []) && selTxn)
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

  return (
    <>
      <div>
        <span className="eyebrow">MY ORDERS</span>
        <h1>Your requests and campus pickups</h1>
        <p className="muted small">
          Follow each meetup from request to in-person pickup.
        </p>
      </div>

      {(() => {
        // Requests this member sent to another student. They live on the
        // server so the seller receives them; the status here is the seller's
        // answer, not a local guess.
        const sent = apiOrders.filter((o) => o.buyer_email === currentAccount.email)
        if (!sent.length) return null
        return (
          <div className="card stack">
            <div className="row between">
              <b>Requests you sent</b>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => void refreshOrders()}
              >
                Refresh
              </button>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {sent.map((order) => (
                <div key={order.reference} className="row between wrap small" style={{ gap: 8 }}>
                  <span style={{ overflowWrap: 'anywhere', flex: 1 }}>
                    <b>{order.reference}</b> · {order.seller_name} ·{' '}
                    {order.lines.map((l) => `${l.quantity} × ${l.title}`).join(', ')} ·{' '}
                    {peso(Number(order.total_amount))}
                  </span>
                  <span
                    className={`pill ${
                      order.status === 'requested'
                        ? 'yellow'
                        : order.status === 'accepted'
                          ? 'green'
                          : order.status === 'completed'
                            ? 'navy'
                            : 'red'
                    }`}
                  >
                    {order.status_display}
                  </span>
                  {order.seller_contact ? (
                    <a
                      className="pill green"
                      href={`tel:${order.seller_contact}`}
                      title="Shared while the order is accepted"
                    >
                      {order.seller_contact}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() =>
                      void openThreadWith({
                        sellerEmail: order.seller_email,
                        listingSlug: order.lines[0]?.listing_slug || null,
                      })
                    }
                  >
                    Message
                  </button>
                  {order.is_open && (
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => void actOnOrder(order.reference, 'cancelled')}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      <div className="tabs" role="tablist">
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
              onClick={() => {
                setOrderTab(t)
                setOpenBox('')
              }}
            >
              {t} <span className="tnum">({count})</span>
            </button>
          )
        })}
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
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedOrderId(o.id)
                      setOpenBox('')
                    }
                  }}
                >
                  {isCancellable && (
                    <label className="orders-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.has(o.id)}
                        onChange={() => toggleSelectOrder(o.id)}
                      />
                    </label>
                  )}
                  <div className="row" style={{ minWidth: 0 }}>
                    {renderOrderThumb(o, 54)}
                    <div className="order-list-meta" style={{ minWidth: 0 }}>
                      <b style={{ overflowWrap: 'anywhere' }}>{o.title}</b>
                      <div className="tiny muted">
                        {o.id} · {o.seller}
                      </div>
                      <div className="row wrap" style={{ gap: 4, marginTop: 2 }}>
                        <span className={`pill ${o.fulfillment === 'delivery' ? 'blue' : 'green'}`}>
                          {o.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}
                        </span>
                      </div>
                      <div className="tiny">{cleanWhen(o.when)}</div>
                    </div>
                  </div>
                  <div className="order-list-right">
                    {renderOrderPill(o)}
                    <span className="price tnum" style={{ fontSize: 14 }}>
                      {peso(o.total)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right selected order detail */}
          {sel && (
            <div className="card stack orders-detail">
              <div className="row between wrap">
                <div>
                  <span className="tiny muted">ORDER {sel.id}</span>
                  <h3 style={{ overflowWrap: 'anywhere' }}>{sel.title}</h3>
                </div>
                {renderOrderPill(sel)}
              </div>

              {/* Official Store BAO Ticket Card (v1.6 baoTicketHtml) */}
              {selIsOfficial && selTxn && (
                <div className="ticket stack" data-ticket={selTxn.id}>
                  <div className="row between wrap">
                    <div>
                      <span className="tiny muted">TICKET REFERENCE</span>
                      <div className="tk-id tnum">{selTxn.id}</div>
                    </div>
                    {selTxn.queue && (
                      <div style={{ textAlign: 'right' }}>
                        <span className="tiny muted">QUEUE NUMBER</span>
                        <div className="tk-id tnum">{selTxn.queue}</div>
                      </div>
                    )}
                  </div>

                  <BaoProgressBar txn={selTxn} />

                  {baoStatusOf(selTxn) === 'On Hold' && (
                    <div className="note" role="status">
                      <Icon name="clock" />
                      <span>
                        <b>On hold.</b>{' '}
                        {selTxn.note || 'The BAO will update this request.'}
                      </span>
                    </div>
                  )}

                  {baoStatusOf(selTxn) === 'Cancelled' && (
                    <div className="note" role="status">
                      <Icon name="info" />
                      <span>
                        <b>Cancelled.</b> {selTxn.note || ''}
                      </span>
                    </div>
                  )}

                  <div className="grid2 small">
                    <div>
                      <span className="tiny muted">REQUESTED</span>
                      <br />
                      <b>{stamp(selTxn.created)}</b>
                    </div>
                    <div>
                      <span className="tiny muted">PICKUP DATE</span>
                      <br />
                      <b>
                        {selTxn.pickup
                          ? baoDate(selTxn.pickup)
                          : 'Not set yet. The BAO will update it.'}
                      </b>
                    </div>
                  </div>

                  <div className="stack" style={{ gap: 4 }}>
                    <span className="tiny muted">ITEMS</span>
                    {selTxn.lines.map((l, idx) => (
                      <div
                        key={idx}
                        className="small"
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        {l.name} × {l.qty}
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const notes = baoClaimNotes(db.bao, db.official, selTxn)
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
                      {(selTxn.bhist || [])
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

              {!selIsOfficial && (sel.lines || []).some((l) => l.vlabel) && (
                <div className="stack" style={{ gap: 4 }}>
                  {(sel.lines || []).map((l, idx) => {
                    const prod = byId(l.pid)
                    return (
                      <div key={idx} className="small muted">
                        {l.qty} × {prod ? prod.name : sel.title}
                        {l.vlabel ? ` (${l.vlabel})` : ''}
                      </div>
                    )
                  })}
                </div>
              )}

              {!selIsOfficial &&
                (sel.tab !== 'Cancelled' ? (
                  <div className="stack" style={{ gap: 10 }}>
                    <ol className="bstep bstep-3" aria-label="Order progress">
                      {[
                        { label: 'Requested', stageThreshold: 1 },
                        { label: 'Meetup set', stageThreshold: 2 },
                        { label: 'Completed', stageThreshold: 4 },
                      ].map((step, i) => {
                        const done = sel.stage >= step.stageThreshold
                        return (
                          <li key={step.label} className={done ? 'done' : i === sel.stage - 1 ? 'cur' : 'todo'}>
                            <span className="dot">{done ? <Icon name="check" size="sm" /> : String(i + 1)}</span>
                            <span className="lbl">{step.label}</span>
                          </li>
                        )
                      })}
                    </ol>

                    {sel.tab === 'Active' && sel.proofPhoto && imgSrc(sel.proofPhoto) && (
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
                          src={imgSrc(sel.proofPhoto)}
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
                          Uploaded by {sel.proofBy || 'Seller'}
                          {sel.proofAt ? ` · ${stamp(sel.proofAt)}` : ''}
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
                  <b>{sel.seller}</b>
                </div>
                <div className="row between small">
                  <span className="muted">Fulfillment method</span>
                  <span className={`pill ${sel.fulfillment === 'delivery' ? 'blue' : 'green'}`}>
                    {sel.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}
                  </span>
                </div>
                <div className="row between small">
                  <span className="muted">{sel.fulfillment === 'delivery' ? 'Delivery schedule' : 'Meetup'}</span>
                  <b>{cleanWhen(sel.when)}</b>
                </div>
                <div className="row between small">
                  <span className="muted">Pay on meetup</span>
                  <b className="tnum">{peso(sel.total)}</b>
                </div>
              </div>

              {sel.tab === 'Active' && (
                <>
                  <div className="order-actions">
                    {!selIsOfficial && (
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
                                (sel.fulfillment === 'delivery' ? 'delivery' : 'pickup') + '?',
                              msg: `Only confirm once you have received "${sel.title}" from ${sel.seller} and paid in person. This marks the order as completed and lets the seller know.`,
                              yes: 'Yes, I received it',
                              no: 'Not yet',
                              danger: false,
                              run: () => {
                                confirmOrderPickup(sel.id, sel.proofPhoto || null)
                              },
                            })
                          }}
                        >
                          <Icon name="check" size="sm" />
                          Confirm {sel.fulfillment === 'delivery' ? 'delivery' : 'pickup'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => {
                        const conv = myConversations.find((c) =>
                          sel.sellerEmail ? c.seller === sel.sellerEmail : !c.seller,
                        )
                        if (conv) setSelectedConvId(conv.id)
                        navigate('messages')
                      }}
                    >
                      <Icon name="msg" size="sm" />
                      Message seller
                    </button>
                    {!selIsOfficial && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => {
                          const rawPlace = (sel.when || '').split(',')[0] || ''
                          const cleanPl = rawPlace.replace(/^(Pickup|Delivery)\s*·\s*/i, '').trim()
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
                    {!selIsOfficial && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() =>
                          openModal({
                            kind: 'order-report',
                            orderId: sel.id,
                            role: 'buyer',
                            targetEmail: sel.sellerEmail,
                            targetName: sel.seller,
                            itemTitle: sel.title,
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
                        onClick={() => cancelOrderRequest(sel.id)}
                      >
                        Cancel request
                      </button>
                    ) : null}
                  </div>

                  {!sellerAccepted && !selIsOfficial && (
                    <div className="note blue">
                      <Icon name="info" size="sm" />
                      <span>
                        Confirm {sel.fulfillment === 'delivery' ? 'delivery' : 'pickup'} unlocks once the seller accepts your request.
                      </span>
                    </div>
                  )}

                  {!selIsOfficial && openBox === 'edit' && (
                    <form
                      className="card flat stack"
                      style={{ background: 'var(--bg)' }}
                      onSubmit={(e) => {
                        e.preventDefault()
                        proposeOrderMeetup(sel.id, editPlace, editTime)
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
                            value={selTimeOptions.includes(editTime) ? editTime : selTimeOptions[0] || editTime}
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

              {!selIsOfficial && sel.tab !== 'Active' && (
                <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() =>
                      openModal({
                        kind: 'order-report',
                        orderId: sel.id,
                        role: 'buyer',
                        targetEmail: sel.sellerEmail,
                        targetName: sel.seller,
                        itemTitle: sel.title,
                      })
                    }
                  >
                    <Icon name="flag" size="sm" />
                    Report issue with seller
                  </button>
                </div>
              )}

              {/* Order review section for completed pickups (orderReviewHtml in js/9e-reviews-ranking.js) */}
              {orderRateable(sel) && (
                <OrderReviewSection
                  key={sel.id}
                  order={sel}
                  reviewOf={reviewOf}
                  submitReview={submitReview}
                  byId={byId}
                />
              )}
            </div>
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
    (l) => l.pid && !seenPids.has(l.pid) && seenPids.add(l.pid),
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
        return renderBox(
          'item',
          l.pid,
          `Rate item: ${p?.name || l.name || 'this item'}`,
          'Was it in the condition described?',
        )
      })}
    </div>
  )
}
