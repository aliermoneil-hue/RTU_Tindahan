import { useState } from 'react'
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
  baoStudentCanCancel,
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
    cancelOrderRequest,
    sendOrderMessage,
    orderRateable,
    reviewOf,
    submitReview,
    openModal,
    apiOrders,
    actOnOrder,
    refreshOrders,
    openThreadWith,
  } = useTindahan()

  const [openBox, setOpenBox] = useState<'' | 'msg' | 'edit' | 'cancel'>('')
  const [msgText, setMsgText] = useState('')
  const presetPlaces = PLACES.filter((pl) => pl !== 'Others')
  const [editPlace, setEditPlace] = useState(PLACES[0])
  const [editOthersMode, setEditOthersMode] = useState(false)
  const [editTime, setEditTime] = useState(TIMES[0])

  if (!currentAccount) return null
  const orders = currentAccount.orders || []
  const tabs: ('Active' | 'Completed' | 'Cancelled')[] = ['Active', 'Completed', 'Cancelled']
  const list = orders.filter((o) => o.tab === orderTab)
  const sel = list.find((o) => o.id === selectedOrderId) || list[0]
  const steps = ['Requested', 'Meetup set', 'Meet on campus', 'Completed']

  const renderOrderPill = (o: OrderRecord) => {
    const t = baoTxnFor(o, db.txn)
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

  const selTxn = sel ? baoTxnFor(sel, db.txn) : null
  const selIsOfficial = Boolean(sel && baoIsOfficialOrder(sel, db.txn) && selTxn)
  const selCanCancel = sel ? baoStudentCanCancel(sel, db.txn, db.bao) : false
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
          const count = orders.filter((o) => o.tab === t).length
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
          <b>No {orderTab.toLowerCase()} orders</b>
          <p className="small muted">
            Items you reserve will show up here with their meetup schedule.
          </p>
          <button type="button" className="btn" onClick={() => navigate('browse')}>
            Browse listings
          </button>
        </div>
      ) : (
        <div className="orders-two two">
          {/* Left list of orders */}
          <div className="stack">
            {list.map((o) => (
              <button
                key={o.id}
                type="button"
                className="card row between"
                style={{
                  textAlign: 'left',
                  borderColor: sel && sel.id === o.id ? 'var(--blue)' : undefined,
                }}
                onClick={() => {
                  setSelectedOrderId(o.id)
                  setOpenBox('')
                }}
              >
                <div className="row" style={{ minWidth: 0 }}>
                  {renderOrderThumb(o, 54)}
                  <div style={{ minWidth: 0 }}>
                    <b style={{ overflowWrap: 'anywhere' }}>{o.title}</b>
                    <div className="tiny muted">
                      {o.id} · {o.seller}
                    </div>
                    <div className="row wrap" style={{ gap: 4, marginTop: 2 }}>
                      <span className={`pill ${o.fulfillment === 'delivery' ? 'blue' : 'green'}`}>
                        {o.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}
                      </span>
                    </div>
                    <div className="tiny">{o.when}</div>
                  </div>
                </div>
                <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  {renderOrderPill(o)}
                  <span className="price tnum" style={{ fontSize: 14 }}>
                    {peso(o.total)}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Right selected order detail */}
          {sel && (
            <div className="card stack">
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
                    {steps.map((s, i) => {
                      const done = i < sel.stage
                      const isMeetStep = i === 2
                      return (
                        <div key={s} className="stack" style={{ gap: 6 }}>
                          <div className="row">
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: done ? 'var(--green)' : 'var(--soft)',
                                color: done ? '#fff' : 'var(--muted)',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {done ? '✓' : i + 1}
                            </span>
                            <span
                              className="small"
                              style={{ fontWeight: done ? 600 : 400 }}
                            >
                              {s}
                            </span>
                          </div>

                          {isMeetStep && sel.tab === 'Active' && (
                            <>
                              {sel.proofPhoto && imgSrc(sel.proofPhoto) && (
                                <div
                                  className="card flat stack"
                                  style={{
                                    marginLeft: 30,
                                    background: 'var(--bg)',
                                    padding: 12,
                                    gap: 6,
                                  }}
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
                              {!sel.proofPhoto && (
                                <div
                                  className="card flat stack"
                                  style={{
                                    marginLeft: 30,
                                    background: 'var(--bg)',
                                    padding: 12,
                                    gap: 6,
                                    border: '1px dashed var(--line)',
                                  }}
                                >
                                  <div className="row between wrap">
                                    <b className="small">
                                      Meetup / Pickup Photo Proof
                                    </b>
                                  </div>
                                  <span className="tiny muted">
                                    Seller will upload a meetup handover photo when marking this
                                    order as picked up.
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div
                    className="note"
                    style={{ background: 'var(--red-bg)', borderColor: 'transparent' }}
                  >
                    This request was cancelled. No payment was made.
                  </div>
                ))}

              <div className="card flat stack" style={{ background: 'var(--bg)', gap: 6 }}>
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
                  <b>{sel.when}</b>
                </div>
                <div className="row between small">
                  <span className="muted">Pay on meetup</span>
                  <b className="tnum">{peso(sel.total)}</b>
                </div>
              </div>

              {sel.tab === 'Active' && (
                <>
                  <div className="row wrap">
                    {!selIsOfficial && (
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => confirmOrderPickup(sel.id, sel.proofPhoto || null)}
                      >
                        <Icon name="check" size="sm" />
                        Confirm {sel.fulfillment === 'delivery' ? 'delivery' : 'pickup'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() =>
                        setOpenBox((cur) => (cur === 'msg' ? '' : 'msg'))
                      }
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
                    {selCanCancel && (
                      <button
                        type="button"
                        className="btn danger sm"
                        onClick={() =>
                          setOpenBox((cur) => (cur === 'cancel' ? '' : 'cancel'))
                        }
                      >
                        Cancel request
                      </button>
                    )}
                  </div>

                  {openBox === 'msg' && (
                    <form
                      className="card flat stack"
                      style={{ background: 'var(--bg)' }}
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (sendOrderMessage(sel.id, msgText, true)) {
                          setMsgText('')
                          setOpenBox('')
                        }
                      }}
                    >
                      <b className="small">Message {sel.seller}</b>
                      <textarea
                        className="input"
                        id="omsg-t"
                        placeholder="Write a message about this meetup..."
                        value={msgText}
                        onChange={(e) => setMsgText(e.target.value)}
                      />
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setOpenBox('')}
                        >
                          Close
                        </button>
                        <button type="submit" className="btn sm">
                          Send
                        </button>
                      </div>
                    </form>
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

                  {openBox === 'cancel' && (
                    <div
                      className="card flat stack"
                      style={{ background: 'var(--red-bg)' }}
                    >
                      <b className="small">Cancel request {sel.id}?</b>
                      <p className="tiny">
                        The seller will be notified and the reserved stock will be returned.
                      </p>
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setOpenBox('')}
                        >
                          Keep request
                        </button>
                        <button
                          type="button"
                          className="btn danger sm"
                          onClick={() => {
                            cancelOrderRequest(sel.id)
                            setOpenBox('')
                          }}
                        >
                          Yes, cancel it
                        </button>
                      </div>
                    </div>
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
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [stars, setStars] = useState<number>(0)
  const [text, setText] = useState<string>('')

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
    const isEditing = editingKey === k

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
                  setEditingKey(k)
                  setStars(ex.stars)
                  setText(ex.text || '')
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
          const curStars = isEditing ? stars : stars
          if (submitReview(kind, order.id, pid, curStars, text)) {
            setEditingKey(null)
            setStars(0)
            setText('')
          }
        }}
      >
        <div>
          <b className="small">{title}</b>
          <div className="tiny muted">{sub}</div>
        </div>
        <StarPicker
          value={editingKey === k ? stars : 0}
          label={title}
          onChange={(val) => {
            if (editingKey !== k) {
              setEditingKey(k)
              setText(ex?.text || '')
            }
            setStars(val)
          }}
        />
        <label className="field">
          <span className="tiny muted">Short review (optional, up to 500 characters)</span>
          <textarea
            className="input"
            maxLength={500}
            rows={2}
            placeholder="Was the item as described? How was the campus meetup?"
            value={editingKey === k ? text : ''}
            onChange={(e) => {
              if (editingKey !== k) {
                setEditingKey(k)
              }
              setText(e.target.value)
            }}
          />
        </label>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          {ex && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                setEditingKey(null)
                setStars(0)
                setText('')
              }}
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
