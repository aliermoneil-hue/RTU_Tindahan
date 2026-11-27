import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/common/components/Icon'
import type { IconName } from '@/common/components/icons'
import { playRemove, playSuccess } from '@/common/sounds'
import { navigate } from '@/common/router/router'
import { ItemTitleWithVariant } from '@/common/components/ItemTitleWithVariant'
import { PLACES, getSellerTimeWindows, isSvc, peso, unitPrice } from '../constants'
import { getPickupDates } from '../dateHelper'
import { useTindahan } from '../context/TindahanContext'
import { imgSrc, imgsOf } from '../imageStore'
import type { ChosenFulfillment, FulfillmentMethod, OrderRecord, PrototypeProduct, CartLine } from '../types'
import { RequestSentView } from './RequestSentView'
import './CartPage.css'

const getFulfillment = (
  p: PrototypeProduct | undefined,
  c: CartLine,
): { avail: FulfillmentMethod | 'none'; chosen: ChosenFulfillment } => {
  const avail: FulfillmentMethod | 'none' =
    p?.cat === 'Official' && !p?.fulfillment
      ? 'pickup'
      : p?.fulfillment === 'pickup' ||
          p?.fulfillment === 'delivery' ||
          p?.fulfillment === 'both'
        ? (p.fulfillment as FulfillmentMethod)
        : 'none'
  const chosen: ChosenFulfillment =
    c.fulfillment || (avail === 'delivery' ? 'delivery' : 'pickup')
  return { avail, chosen }
}

function EditMeetupForm({
  idx,
  c,
  chosenMethod,
  isOfficial,
  sellerTimeSlots,
  dateOpts,
  activeDateLabel,
  activeTime,
  officialPlace,
  othersCartIdx,
  setOthersCartIdx,
  presetPlaces,
  updateCartMeetup,
  svc,
  todayStatus,
  windowEndText,
  pAvail,
  onClose,
}: {
  idx: number
  c: CartLine
  chosenMethod: ChosenFulfillment
  isOfficial: boolean
  sellerTimeSlots: string[]
  dateOpts: { id: string; label: string }[]
  activeDateLabel: string
  activeTime: string
  officialPlace: string
  othersCartIdx: Record<number, boolean>
  setOthersCartIdx: Dispatch<SetStateAction<Record<number, boolean>>>
  presetPlaces: string[]
  updateCartMeetup: (idx: number, field: 'date' | 'time' | 'place' | 'fulfillment' | 'deliverySpot', value: string) => void
  svc: boolean
  todayStatus: string
  windowEndText: string
  pAvail: string | undefined
  onClose: () => void
}) {
  return (
    <div className="stack" style={{ gap: 10, marginTop: 4 }}>
      {chosenMethod === 'delivery' && (
        <div className="field">
          <label htmlFor={`cdspot-${idx}`}>
            Campus delivery drop-off spot (room / building / landmark)
          </label>
          <input
            className="input"
            id={`cdspot-${idx}`}
            placeholder={`e.g. Room 304 or ${c.place}`}
            value={c.deliverySpot || ''}
            onChange={(e) => updateCartMeetup(idx, 'deliverySpot', e.target.value)}
          />
        </div>
      )}

      {isOfficial ? (
        <div className="stack" style={{ gap: 8 }}>
          <div className="field">
            <label htmlFor={`cd-${idx}`}>Pickup date (within store schedule)</label>
            <select
              className="input"
              id={`cd-${idx}`}
              value={activeDateLabel}
              onChange={(e) => updateCartMeetup(idx, 'date', e.target.value)}
            >
              {dateOpts.map((opt) => (
                <option key={opt.id} value={opt.label}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Official Store Location & Time Window (Fixed by Admin)</label>
            <div className="input" style={{ background: 'var(--soft)', color: 'var(--muted)', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
              <span className="tiny" style={{ color: 'var(--yellow)' }}>
                <Icon name="shield" size="sm" /> Location & open hours set by RTU Admin
              </span>
              <span className="small" style={{ marginLeft: 6 }}>
                {officialPlace} · {activeTime}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid2">
            <div className="field">
              <label htmlFor={`cd-${idx}`}>
                {chosenMethod === 'delivery' ? 'Delivery date' : 'Pickup date'}
              </label>
              <select
                className="input"
                id={`cd-${idx}`}
                value={activeDateLabel}
                onChange={(e) => updateCartMeetup(idx, 'date', e.target.value)}
              >
                {dateOpts.map((opt) => (
                  <option key={opt.id} value={opt.label}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`ct-${idx}`}>Seller's available time window</label>
              <select
                className="input"
                id={`ct-${idx}`}
                value={activeTime}
                onChange={(e) => updateCartMeetup(idx, 'time', e.target.value)}
              >
                {sellerTimeSlots.map((tm) => (
                  <option key={tm} value={tm}>
                    {tm}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`cp-${idx}`}>
                {chosenMethod === 'delivery' ? 'Campus building / area' : 'Campus meetup location'}
              </label>
              <select
                className="input"
                id={`cp-${idx}`}
                value={othersCartIdx[idx] || !presetPlaces.includes(c.place) ? 'Others' : c.place}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === 'Others') {
                    setOthersCartIdx((prev) => ({ ...prev, [idx]: true }))
                  } else {
                    setOthersCartIdx((prev) => ({ ...prev, [idx]: false }))
                    updateCartMeetup(idx, 'place', val)
                  }
                }}
              >
                {PLACES.map((pl) => (
                  <option key={pl} value={pl}>{pl}</option>
                ))}
              </select>
              {(othersCartIdx[idx] || !presetPlaces.includes(c.place)) && (
                <input
                  className="input"
                  style={{ marginTop: 8 }}
                  placeholder="Write specific campus place (e.g. Gate 2 bench, Room 402)..."
                  value={presetPlaces.includes(c.place) ? '' : c.place}
                  onChange={(e) => updateCartMeetup(idx, 'place', e.target.value)}
                />
              )}
            </div>
          </div>

          {svc && (
            <div className="tiny muted" style={{ color: 'var(--blue)' }}>
              <Icon name="info" size="sm" /> Services must be scheduled in advance (earliest available date is selected).
            </div>
          )}
          {!svc && todayStatus === 'window_closed' && (
            <div className="tiny muted" style={{ color: 'var(--amber, #c27b00)' }}>
              <Icon name="info" size="sm" /> Today's window ({windowEndText}) has closed. Earliest available date is selected.
            </div>
          )}
          {!svc && todayStatus === 'not_selling_day' && (
            <div className="tiny muted">
              <Icon name="info" size="sm" /> Seller is available on {pAvail || 'weekdays'}.
            </div>
          )}
        </>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn ghost sm" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn sm" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}

export function CartPage() {
  const {
    currentAccount,
    cartStep,
    setCartStep,
    cartMsg,
    setCartMsg,
    cartAgree,
    setCartAgree,
    cartErr,
    setCartErr,
    byId,
    sellerKind,
    updateCartQty,
    removeCartLine,
    toggleCartEdit,
    toggleCartSelect,
    toggleCartSelectAll,
    updateCartMeetup,
    sendMeetupRequest,
    selectedCartItems,
    toast,
    lastOrderId,
    lastOrderIds,
    myConversations,
    setSelectedConvId,
  } = useTindahan()

  const cartStepRef = useRef(cartStep)
  cartStepRef.current = cartStep

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.matchMedia('(max-width: 1000px)').matches)
  const [mobileEditOpen, setMobileEditOpen] = useState(false)
  const [mobileEditIdx, setMobileEditIdx] = useState<number | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)

  // Close the mobile edit sheet, keeping the item mounted during the 320ms slide-down transition
  const closeMobileEdit = useCallback(() => {
    setMobileEditOpen(false)
    setTimeout(() => setMobileEditIdx(null), 320)
  }, [])

  // Track mobile breakpoint; lock body scroll while a mobile sheet is open
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1000px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', handler)

    const shouldLock = isMobile && mobileEditIdx !== null
    document.documentElement.classList.toggle('cart-sheet-open', shouldLock)
    document.body.classList.toggle('cart-sheet-open', shouldLock)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMobileEdit()
        setSummaryOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      mq.removeEventListener('change', handler)
      document.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('cart-sheet-open')
      document.body.classList.remove('cart-sheet-open')
    }
  }, [isMobile, mobileEditIdx, closeMobileEdit])

  const cart = currentAccount?.cart || []
  const selectedCount = selectedCartItems.size

  useEffect(() => {
    if (cartStep === 2 && cart.length > 0 && selectedCount === 0) {
      setCartStep(1)
    }
  }, [cartStep, cart.length, selectedCount, setCartStep])

  useEffect(() => {
    return () => {
      if (cartStepRef.current === 3) {
        setCartStep(1)
      }
    }
  }, [])

  const [othersCartIdx, setOthersCartIdx] = useState<Record<number, boolean>>({})
  const presetPlaces = PLACES.filter((pl) => pl !== 'Others')

  if (!currentAccount) return null

  const orderIdSet = new Set<string>(lastOrderIds)
  if (lastOrderId) orderIdSet.add(lastOrderId)
  const batchOrders: OrderRecord[] = currentAccount.orders.filter((o) => orderIdSet.has(o.id))

  const selectedSellers = new Set(
    cart
      .filter((_, i) => selectedCartItems.has(i))
      .map((c) => byId(c.id)?.seller)
      .filter(Boolean),
  ).size

  const hasInvalidFulfillment = cart.some((c, i) => {
    if (!selectedCartItems.has(i)) return false
    const p = byId(c.id)
    if (!p) return true
    const { avail, chosen } = getFulfillment(p, c)
    if (avail === 'none') return true
    if (avail === 'pickup' && chosen !== 'pickup') return true
    if (avail === 'delivery' && chosen !== 'delivery') return true
    return false
  })

  const selectedCartCount = cart.reduce(
    (acc, c, i) => (selectedCartItems.has(i) ? acc + c.qty : acc),
    0,
  )
  const selectedCartTotal = cart.reduce(
    (acc, c, i) => {
      if (!selectedCartItems.has(i)) return acc
      const p = byId(c.id)
      if (!p) return acc
      return acc + unitPrice(p, c.vid) * c.qty
    },
    0,
  )

  const isStep3 = cartStep === 3
  const submittedTotalUnits = batchOrders.reduce(
    (acc, o) => acc + (o.lines?.reduce((s, l) => s + l.qty, 0) ?? 0),
    0,
  )
  const submittedTotalAcrossBatch = batchOrders.reduce(
    (acc, o) => acc + o.total,
    0,
  )
  const submittedSellersCount = new Set(
    batchOrders.map((o) => o.seller).filter(Boolean),
  ).size

  const handleSend = () => {
    if (hasInvalidFulfillment) {
      toast('Please select a valid fulfillment method enabled by the seller before proceeding.')
      return
    }
    playSuccess()
    sendMeetupRequest()
    setSummaryOpen(true)
  }

  const handleMessageSeller = (order: OrderRecord) => {
    const conv = myConversations.find((c) =>
      order.sellerEmail ? c.seller === order.sellerEmail : !c.seller,
    )
    if (conv) setSelectedConvId(conv.id)
    setCartStep(1)
    navigate('messages')
  }

  return (
    <>
      <div>
        {cartStep === 3 ? (
          <>
            <span className="eyebrow">REQUEST SENT</span>
            <h1>Order request sent</h1>
            <p className="muted small">
              Your seller has been notified. Coordinate your campus pickup or delivery in Messages
              or track updates in My Orders.
            </p>
          </>
        ) : (
          <>
            <span className="eyebrow">PICKUP & DELIVERY REQUEST</span>
            <h1>Review and schedule your order</h1>
            <p className="muted small">
              No online checkout. You are sending a pickup or delivery request to the seller and paying
              in person on campus.
            </p>
          </>
        )}
      </div>

      <ol className="cart-bstep" aria-label="Order request progress">
        {(
          ['Review items & fulfillment', 'Message & confirm', 'Request sent'] as const
        ).map((label, i) => {
          const isDone = cartStep > i + 1
          const isCurrent = cartStep === i + 1
          return (
            <li
              key={label}
              className={isDone ? 'done' : isCurrent ? 'cur' : 'todo'}
              onClick={() =>
                isDone && cartStep < 3 ? setCartStep((i + 1) as 1 | 2 | 3) : undefined
              }
            >
              <span className="dot">
                {isDone ? <Icon name="check" size="sm" /> : String(i + 1)}
              </span>
              <span className="lbl">{label}</span>
            </li>
          )
        })}
      </ol>

      {isStep3 && batchOrders.length > 0 && !isMobile ? (
        <RequestSentView
          batchOrders={batchOrders}
          remainingCartCount={cart.length}
          byId={byId}
          onMessageSeller={handleMessageSeller}
          onTrackOrders={() => {
            setCartStep(1)
            navigate('orders')
          }}
          onBackToMarketplace={() => navigate('marketplace')}
          onBackToCart={() => setCartStep(1)}
        />
      ) : isStep3 ? (
        <div className="cart-two two">
          <div className="stack">
            {isStep3 && isMobile ? (
              <div className="cart-select-bar cart-step-3-bar">
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => navigate('marketplace')}
                >
                  ← Marketplace
                </button>
                <button
                  type="button"
                  className="btn yellow sm"
                  onClick={() => setSummaryOpen(true)}
                >
                  View summary
                </button>
              </div>
            ) : null}
            {batchOrders.map((ord, _oidx) => {
              const product = ord.lines?.[0] ? byId(ord.lines[0].pid) : undefined
              return (
                <div key={ord.id} className="card stack sent-card">
                  <div className="row wrap" style={{ gap: 8, alignItems: 'center', minWidth: 0 }}>
                    <div className="photo cart-photo" style={{ flex: 'none' }}>
                      {product && imgsOf(product).length ? (
                        <img className="pimg" src={imgSrc(imgsOf(product)[0])} alt={product.name} />
                      ) : (
                        <Icon name={(product?.icon || 'tag') as IconName} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <ItemTitleWithVariant
                        as="b"
                        title={ord.title}
                        style={{ overflowWrap: 'anywhere', display: 'block', marginBottom: 2 }}
                      />
                      <div className="row wrap" style={{ gap: 6, marginBottom: 2 }}>
                        <span className="pill">#{ord.id}</span>
                        <span className={`pill ${ord.fulfillment === 'delivery' ? 'blue' : 'green'}`}>
                          {ord.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}
                        </span>
                      </div>
                      <div className="small muted">Seller: {ord.seller}</div>
                      <span className="price tnum">{peso(ord.total)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : !cart.length && !isStep3 ? (
        <div
          className="card stack"
          style={{ alignItems: 'center', textAlign: 'center', padding: 40 }}
        >
          <span style={{ color: 'var(--blue)' }}>
            <Icon name="cart" />
          </span>
          <b>Your request cart is empty</b>
          <p className="small muted">
            Reserve an item from the marketplace to schedule a campus pickup or delivery.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              navigate('browse')
            }}
          >
            Browse listings
          </button>
        </div>
      ) : (
        <div className="cart-two two">
          <div className="stack">
            {isStep3 && isMobile ? (
              <div className="cart-select-bar cart-step-3-bar">
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => navigate('marketplace')}
                >
                  ← Marketplace
                </button>
                <button
                  type="button"
                  className="btn yellow sm"
                  onClick={() => setSummaryOpen(true)}
                >
                  View summary
                </button>
              </div>
            ) : cartStep === 2 && isMobile ? (
              <div className="cart-select-bar cart-step-2-bar">
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setCartStep(1)}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="btn yellow sm"
                  onClick={() => setSummaryOpen(true)}
                >
                  Confirm & send
                </button>
              </div>
            ) : cartStep === 2 ? null : (
              <div className="selection-bar cart-select-bar">
                <label className="cart-check row between">
                  <input
                    type="checkbox"
                    checked={selectedCount > 0 && selectedCount === cart.length}
                    onChange={() => toggleCartSelectAll()}
                  />
                  <span>
                    <b>Select all ({selectedCount} of {cart.length})</b>
                  </span>
                </label>
                {isMobile ? (
                  <button
                    type="button"
                    className={`btn yellow sm cart-summary-trigger ${selectedCount === 0 ? 'is-hidden' : ''}`}
                    onClick={() => setSummaryOpen(true)}
                    disabled={selectedCount === 0}
                  >
                    View summary
                  </button>
                ) : (
                  selectedCount > 0 && (
                    <span className="tiny muted">
                      {selectedCartTotal > 0 ? peso(selectedCartTotal) : ''} ·{' '}
                      {selectedCartCount} item{selectedCartCount === 1 ? '' : 's'}
                    </span>
                  )
                )}
              </div>
            )}

            {isStep3 && isMobile ? batchOrders.map((ord, _oidx) => {
                const product = ord.lines?.[0] ? byId(ord.lines[0].pid) : undefined
                return (
                  <div key={ord.id} className="card stack sent-card">
                    <div className="row wrap" style={{ gap: 8, alignItems: 'center', minWidth: 0 }}>
                      <div className="photo cart-photo" style={{ flex: 'none' }}>
                        {product && imgsOf(product).length ? (
                          <img className="pimg" src={imgSrc(imgsOf(product)[0])} alt={product.name} />
                        ) : (
                          <Icon name={(product?.icon || 'tag') as IconName} />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <ItemTitleWithVariant
                          as="b"
                          title={ord.title}
                          style={{ overflowWrap: 'anywhere', display: 'block', marginBottom: 2 }}
                        />
                        <div className="row wrap" style={{ gap: 6, marginBottom: 2 }}>
                          <span className="pill">#{ord.id}</span>
                          <span className={`pill ${ord.fulfillment === 'delivery' ? 'blue' : 'green'}`}>
                            {ord.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}
                          </span>
                        </div>
                        <div className="small muted">Seller: {ord.seller}</div>
                        <span className="price tnum">{peso(ord.total)}</span>
                      </div>
                    </div>
                  </div>
                )
              }) : null}
            {!isStep3 ? cart.map((c, idx) => {
                const p = byId(c.id)
              if (!p) return null
              if (cartStep === 2 && !selectedCartItems.has(idx)) return null
              const pr = unitPrice(p, c.vid)
              const imgs = imgsOf(p)
              const src = imgs.length ? imgSrc(imgs[0]) : ''
              const svc = isSvc(p)

              const { avail: availMethod, chosen: chosenMethod } = getFulfillment(p, c)

              const isOfficial = p.cat === 'Official' || sellerKind(p) === 'school'
              const sellerTimeSlots = getSellerTimeWindows(p)
              const activeTime = sellerTimeSlots.includes(c.time)
                ? c.time
                : sellerTimeSlots[0] || c.time
              const officialPlace = (p.when.split(',')[0] || 'BAU Office').trim()

              const { options: dateOpts, todayStatus, windowEndText } = getPickupDates(p)
              const activeDateLabel =
                c.date || (dateOpts.length ? dateOpts[0].label : 'Today')

              const isSelected = selectedCartItems.has(idx)

              return (
                <div
                  key={`${c.id}-${c.vid || ''}-${idx}`}
                  className={`card stack cart-item-card ${isSelected ? 'cart-item-selected' : 'cart-item-dimmed'}`}
                >
                  {/* Block 1: top header row */}
                  <div className="cart-item-top">
                    <div className="cart-item-main">
                    <div
                      className={`photo cart-photo ${p.tone || 't-study'} ${
                        src ? 'has-img' : 'nophoto-tile'
                      }`.trim()}
                    >
                      {src ? <img className="pimg" src={src} alt={p.name} /> : null}
                      <Icon name={(p.icon || 'tag') as IconName} />
                    </div>
                    <div className="cart-meta-stack cart-item-meta" style={{ minWidth: 0 }}>
                      <ItemTitleWithVariant
                        as="b"
                        className="cart-item-title"
                        title={p.name}
                        product={p}
                        vid={c.vid}
                        style={{ overflowWrap: 'anywhere', display: 'block' }}
                      />
                      <div className="cart-item-pill-row">
                        <span
                          className={`pill ${chosenMethod === 'delivery' ? 'blue' : 'green'}`}
                        >
                          {chosenMethod === 'delivery' ? 'Delivery' : 'Pickup'}
                        </span>
                        <div className="cart-item-seller-row">
                          <span className="cart-item-seller cart-item-seller-text">
                            Seller: {p.seller}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="cart-item-right">
                    <div className="cart-item-qty-row">
                      <div className="qty" role="group" aria-label={`Quantity for ${p.name}`}>
                        <button
                          type="button"
                          aria-label="Decrease"
                          onClick={() => {
                            updateCartQty(idx, -1)
                          }}
                        >
                          −
                        </button>
                        <span className="tnum">{c.qty}</span>
                        <button
                          type="button"
                          aria-label="Increase"
                          onClick={() => {
                            updateCartQty(idx, 1)
                          }}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="iconbtn"
                        aria-label={`Remove ${p.name}`}
                        onClick={() => {
                          if (cartStep === 2) {
                            toggleCartSelect(idx)
                            toast('Moved back to your cart.')
                          } else {
                            playRemove()
                            removeCartLine(idx)
                          }
                        }}
                      >
                        {cartStep === 2 ? <Icon name="x" /> : <Icon name="trash" />}
                      </button>
                    </div>
                    <span className="cart-item-price tnum">{peso(pr)}</span>
                  </div>
                  <div className="cart-item-check-col">
                    {cartStep === 2 ? null : (
                      <label className="cart-check">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCartSelect(idx)}
                          aria-label={`Select ${p.name}`}
                        />
                      </label>
                    )}
                  </div>
                  </div>
                  {isMobile && mobileEditIdx === idx ? (
                    <>
                      {createPortal(
                        <div
                          className={`cart-detail-backdrop${mobileEditOpen ? ' is-open' : ''}`}
                          onClick={closeMobileEdit}
                        />,
                        document.body
                      )}
                      {createPortal(
                        <div className={`cart-detail mobile-sheet sheet-open${mobileEditOpen ? ' is-open' : ''}`}>
                          <div className="mobile-sheet-header">
                            <div>
                              <span className="tiny muted">Change pickup date & time</span>
                              <h3 style={{ overflowWrap: 'anywhere' }}>
                                <ItemTitleWithVariant
                                  as="span"
                                  title={p.name}
                                  product={p}
                                  vid={c.vid}
                                  style={{ display: 'block' }}
                                />
                              </h3>
                            </div>
                            <button
                              type="button"
                              className="sheet-close"
                              onClick={closeMobileEdit}
                            >
                              ×
                            </button>
                          </div>
                          <div className="mobile-sheet-body">
                            <EditMeetupForm
                              idx={idx}
                              c={c}
                              chosenMethod={chosenMethod}
                              isOfficial={isOfficial}
                              sellerTimeSlots={sellerTimeSlots}
                              dateOpts={dateOpts}
                              activeDateLabel={activeDateLabel}
                              activeTime={activeTime}
                              officialPlace={officialPlace}
                              othersCartIdx={othersCartIdx}
                              setOthersCartIdx={setOthersCartIdx}
                              presetPlaces={presetPlaces}
                              updateCartMeetup={updateCartMeetup}
                              svc={svc}
                              todayStatus={todayStatus}
                              windowEndText={windowEndText}
                              pAvail={p.avail}
                              onClose={closeMobileEdit}
                            />
                          </div>
                        </div>,
                        document.body
                      )}
                    </>
                  ) : null}

                  {/* Horizontal divider */}
                  <hr className="cart-item-divider" />

                  {/* Bottom fulfillment sub-card */}
                  <div className="cart-item-fulfillment">
                    <div className="cart-item-fulfill-top">
                      <div className="cart-item-fulfill-left">
                      <div className="cart-item-fulfill-line">
                        <b>Fulfillment:</b>{' '}
                        {availMethod === 'none'
                          ? 'Not configured'
                          : chosenMethod === 'delivery'
                            ? 'Campus Delivery'
                            : 'Campus Pickup'}
                        <span className="muted">
                          {' · '}
                          {availMethod === 'both'
                            ? 'Seller offers Pickup & Delivery'
                            : availMethod === 'delivery'
                              ? 'Seller offers Delivery only'
                              : availMethod === 'pickup'
                                ? 'Seller offers Pickup only'
                                : 'No method configured'}
                        </span>
                      </div>
                      <div className="cart-item-fulfill-line">
                        <b>
                          {chosenMethod === 'delivery' ? 'Delivery:' : 'Meetup:'}
                        </b>{' '}
                        {isOfficial
                          ? officialPlace
                          : chosenMethod === 'delivery' && c.deliverySpot
                            ? `${c.deliverySpot} (${c.place})`
                            : c.place}{' '}
                        · <b>{activeDateLabel}</b> · {activeTime}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="cart-item-change-link link"
                      onClick={() => {
                        if (isMobile) {
                          setMobileEditOpen(true)
                          setMobileEditIdx(idx)
                        } else {
                          toggleCartEdit(idx)
                        }
                      }}
                    >
                      {c.edit || c.editing
                        ? 'Done'
                        : `Change ${chosenMethod === 'delivery' ? 'delivery' : 'pickup'} date & time`}
                    </button>
                    </div>

                    {availMethod === 'none' && (
                      <div className="note cart-fulfillment-note" style={{ background: 'var(--red-bg)', borderColor: 'transparent', marginTop: 8 }}>
                        <Icon name="info" size="sm" />
                        <span className="small">
                          This listing does not have an enabled fulfillment method. Please remove it
                          or ask the seller to configure Pickup or Delivery.
                        </span>
                      </div>
                    )}

                    {availMethod === 'both' && (
                      <div className="row" role="radiogroup" aria-label="Fulfillment method" style={{ gap: 6, marginTop: 8 }}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={chosenMethod === 'pickup'}
                          className={`btn sm ${chosenMethod === 'pickup' ? '' : 'ghost'}`.trim()}
                          onClick={() => updateCartMeetup(idx, 'fulfillment', 'pickup')}
                        >
                          Pickup
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={chosenMethod === 'delivery'}
                          className={`btn sm ${chosenMethod === 'delivery' ? '' : 'ghost'}`.trim()}
                          onClick={() => updateCartMeetup(idx, 'fulfillment', 'delivery')}
                        >
                          Delivery
                        </button>
                      </div>
                    )}

                    {(!isMobile || !mobileEditOpen || mobileEditIdx !== idx) &&
                      (c.edit || c.editing || chosenMethod === 'delivery') ? (
                      <div className="stack" style={{ gap: 10, marginTop: 4 }}>
                        {chosenMethod === 'delivery' && (
                          <div className="field">
                            <label htmlFor={`cdspot-${idx}`}>
                              Campus delivery drop-off spot (room / building / landmark)
                            </label>
                            <input
                              className="input"
                              id={`cdspot-${idx}`}
                              placeholder={`e.g. Room 304 or ${c.place}`}
                              value={c.deliverySpot || ''}
                              onChange={(e) =>
                                updateCartMeetup(idx, 'deliverySpot', e.target.value)
                              }
                            />
                          </div>
                        )}

                        {(c.edit || c.editing) && (
                          <>
                            {isOfficial ? (
                              <div className="stack" style={{ gap: 8 }}>
                                <div className="field">
                                  <label htmlFor={`cd-${idx}`}>
                                    Pickup date (within store schedule)
                                  </label>
                                  <select
                                    className="input"
                                    id={`cd-${idx}`}
                                    value={activeDateLabel}
                                    onChange={(e) => {
                                      updateCartMeetup(idx, 'date', e.target.value)
                                    }}
                                  >
                                    {dateOpts.map((opt) => (
                                      <option key={opt.id} value={opt.label}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="field">
                                  <label>Official Store Location & Time Window (Fixed by Admin)</label>
                                  <div
                                    className="input"
                                    style={{
                                      background: 'var(--soft)',
                                      color: 'var(--muted)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      fontWeight: 600,
                                    }}
                                  >
                                    <span className="tiny" style={{ color: 'var(--yellow)' }}>
                                      <Icon name="shield" size="sm" />{' '}
                                      Location & open hours set by RTU Admin
                                    </span>
                                    <span className="small" style={{ marginLeft: 6 }}>
                                      {officialPlace} · {activeTime}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                {chosenMethod === 'delivery' ? null : null}
                                <div className="grid2">
                                  <div className="field">
                                    <label htmlFor={`cd-${idx}`}>
                                      {chosenMethod === 'delivery'
                                        ? 'Delivery date'
                                        : 'Pickup date'}
                                    </label>
                                    <select
                                      className="input"
                                      id={`cd-${idx}`}
                                      value={activeDateLabel}
                                      onChange={(e) => {
                                        updateCartMeetup(idx, 'date', e.target.value)
                                      }}
                                    >
                                      {dateOpts.map((opt) => (
                                        <option key={opt.id} value={opt.label}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="field">
                                    <label htmlFor={`ct-${idx}`}>
                                      Seller’s available time window
                                    </label>
                                    <select
                                      className="input"
                                      id={`ct-${idx}`}
                                      value={activeTime}
                                      onChange={(e) => {
                                        updateCartMeetup(idx, 'time', e.target.value)
                                      }}
                                    >
                                      {sellerTimeSlots.map((tm) => (
                                        <option key={tm} value={tm}>
                                          {tm}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="field">
                                    <label htmlFor={`cp-${idx}`}>
                                      {chosenMethod === 'delivery'
                                        ? 'Campus building / area'
                                        : 'Campus meetup location'}
                                    </label>
                                    <select
                                      className="input"
                                      id={`cp-${idx}`}
                                      value={
                                        othersCartIdx[idx] || !presetPlaces.includes(c.place)
                                          ? 'Others'
                                          : c.place
                                      }
                                      onChange={(e) => {
                                        const val = e.target.value
                                        if (val === 'Others') {
                                          setOthersCartIdx((prev) => ({ ...prev, [idx]: true }))
                                        } else {
                                          setOthersCartIdx((prev) => ({ ...prev, [idx]: false }))
                                          updateCartMeetup(idx, 'place', val)
                                        }
                                      }}
                                    >
                                      {PLACES.map((pl) => (
                                        <option key={pl} value={pl}>
                                          {pl}
                                        </option>
                                      ))}
                                    </select>
                                    {(othersCartIdx[idx] || !presetPlaces.includes(c.place)) && (
                                      <input
                                        className="input"
                                        style={{ marginTop: 8 }}
                                        placeholder="Write specific campus place (e.g. Gate 2 bench, Room 402)..."
                                        value={presetPlaces.includes(c.place) ? '' : c.place}
                                        onChange={(e) => {
                                          updateCartMeetup(idx, 'place', e.target.value)
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>

                                {svc && (
                                  <div className="tiny muted" style={{ color: 'var(--blue)' }}>
                                    <Icon name="info" size="sm" /> Services must be scheduled in advance
                                    (earliest available date is selected).
                                  </div>
                                )}
                                {!svc && todayStatus === 'window_closed' && (
                                  <div className="tiny muted" style={{ color: 'var(--amber, #c27b00)' }}>
                                    <Icon name="info" size="sm" /> Today’s window ({windowEndText})
                                    has closed. Earliest available date is selected.
                                  </div>
                                )}
                                {!svc && todayStatus === 'not_selling_day' && (
                                  <div className="tiny muted">
                                    <Icon name="info" size="sm" /> Seller is available on {p.avail || 'weekdays'}.
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            }) : null}
          
          </div>

          {!isMobile ? (
            <div className="card stack cart-summary">
            <b>Request summary</b>
            <div className="row between small">
              <span className="muted">Items ({selectedCartCount})</span>
              <span className="tnum">{peso(selectedCartTotal)}</span>
            </div>
            <div className="row between small">
              <span className="muted">Sellers</span>
              <span className="tnum">
                {selectedSellers} ({selectedSellers > 1 ? 'separate requests' : '1 request'})
              </span>
            </div>
            <div className="stack" style={{ gap: 4 }}>
              <span className="tiny muted">SELECTED FULFILLMENT</span>
              {cart
                .filter((_, i) => selectedCartItems.has(i))
                .map((c, sidx) => {
                  const p = byId(c.id)
                  if (!p) return null
                  const { chosen } = getFulfillment(p, c)
                  return (
                    <div key={sidx} className="row between tiny">
                      <ItemTitleWithVariant
                        as="span"
                        title={p.name}
                        product={p}
                        vid={c.vid}
                        className="fulfill-item-title"
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 165,
                          display: 'block',
                        }}
                      />
                      <span className={`pill ${chosen === 'delivery' ? 'blue' : 'green'}`}>
                        {chosen === 'delivery' ? 'Delivery' : 'Pickup'}
                      </span>
                    </div>
                  )
                })}
            </div>
            <div className="row between small">
              <span className="muted">Platform fee</span>
              <span>₱0 (student service)</span>
            </div>
            <hr style={{ border: 0, borderTop: '1px solid var(--line)' }} />
            <div className="row between">
              <b>Pay in person</b>
              <span className="price tnum" style={{ fontSize: 22 }}>
                {peso(selectedCartTotal)}
              </span>
            </div>
            <div className="note">
              <Icon name="info" />
              <span>
                Bring exact cash or agree on e-wallet in person after inspecting the item.
              </span>
            </div>
            {selectedCount === 0 ? (
              <div className="note blue">
                <Icon name="info" size="sm" />
                <span className="small">
                  Select at least 1 item to continue.
                </span>
              </div>
            ) : cartStep === 1 ? (
              <button
                type="button"
                className="btn yellow block lg"
                disabled={hasInvalidFulfillment}
                onClick={() => {
                  if (hasInvalidFulfillment) {
                    toast('Please fix any invalid fulfillment method before continuing.')
                    return
                  }
                  setCartStep(2)
                }}
              >
                Continue to confirmation
              </button>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="cmsg">Note to seller (optional)</label>
                  <textarea
                    className="input"
                    id="cmsg"
                    value={cartMsg}
                    onChange={(e) => setCartMsg(e.target.value)}
                  />
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    id="cagree"
                    checked={cartAgree}
                    onChange={(e) => {
                      setCartAgree(e.target.checked)
                      setCartErr('')
                    }}
                  />
                  <span>
                    I understand that RTU Tindahan only coordinates the campus pickup or delivery.
                    Payment is settled directly with the seller in person after inspecting the item.
                  </span>
                </label>
                {cartErr && (
                  <span className="err" role="alert">
                    {cartErr}
                  </span>
                )}
                <div className="stack" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="btn yellow block lg"
                    disabled={hasInvalidFulfillment}
                    onClick={handleSend}
                  >
                    Send order request
                  </button>
                  <button
                    type="button"
                    className="btn ghost block sm"
                    onClick={() => {
                      setCartStep(1)
                    }}
                  >
                    Back to items
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
        </div>
      )}
      {isMobile && (
        <>
          {createPortal(
            <div
              className={`cart-summary-backdrop${summaryOpen ? ' is-open' : ''}`}
              onClick={() => setSummaryOpen(false)}
            />,
            document.body
          )}
          {createPortal(
            <div className={`cart-summary-sheet${summaryOpen ? ' is-open' : ''}`}>
              <div className="mobile-sheet-header">
                <div>
                  <h3>{cartStep === 3 ? 'Request sent' : cartStep === 1 ? 'Request summary' : 'Message & confirm'}</h3>
                </div>
                <button
                  type="button"
                  className="sheet-close"
                  onClick={() => setSummaryOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="cart-summary-sheet-body">
                {isStep3 ? (
                  <>
                    <div className="note blue" style={{ marginBottom: 10 }}>
                      <Icon name="check" size="sm" />
                      <div>
                        <b style={{ display: 'block' }}>
                          {batchOrders.length === 1
                            ? 'Request sent'
                            : `${submittedSellersCount} requests sent`}
                        </b>
                        <span className="tiny muted">
                          {batchOrders.length === 1
                            ? 'Your seller has been notified.'
                            : 'Your sellers have been notified.'}
                        </span>
                      </div>
                    </div>
                    <div className="row between small">
                      <span className="muted">Items ({submittedTotalUnits})</span>
                      <span className="tnum">{peso(submittedTotalAcrossBatch)}</span>
                    </div>
                    <div className="row between small">
                      <span className="muted">Sellers</span>
                      <span className="tnum">
                        {submittedSellersCount} (
                        {submittedSellersCount > 1 ? 'separate requests' : '1 request'}
                        )
                      </span>
                    </div>
                    <div className="stack" style={{ gap: 8 }}>
                      <span className="tiny muted">SUBMITTED ORDERS</span>
                      <div className="cart-fulfillment-list">
                        {batchOrders.map((ord, _sidx) => (
                          <div key={ord.id} className="row between tiny">
                            <ItemTitleWithVariant
                              as="span"
                              title={ord.title}
                              className="fulfill-item-title"
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 165,
                                display: 'block',
                              }}
                            />
                            <span className={`pill ${ord.fulfillment === 'delivery' ? 'blue' : 'green'}`}>
                              {ord.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="row between small">
                      <span className="muted">Platform fee</span>
                      <span>₱0 (student service)</span>
                    </div>
                    <hr style={{ border: 0, borderTop: '1px solid var(--line)' }} />
                    <div className="row between">
                      <b>Pay in person</b>
                      <span className="price tnum" style={{ fontSize: 22 }}>
                        {peso(submittedTotalAcrossBatch)}
                      </span>
                    </div>
                    <div className="note blue">
                      <Icon name="info" size="sm" />
                      <span className="small">
                        Meet only at visible campus spots during school hours. Inspect the item before handing over cash.
                      </span>
                    </div>
                    <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn yellow block lg"
                        onClick={() => {
                          setCartStep(1)
                          navigate('orders')
                        }}
                      >
                        Track in My Orders
                      </button>
                      <button
                        type="button"
                        className="btn ghost block sm"
                        onClick={() => {
                          setCartStep(1)
                          navigate('marketplace')
                        }}
                      >
                        Back to marketplace
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="row between small">
                      <span className="muted">Items ({selectedCartCount})</span>
                      <span className="tnum">{peso(selectedCartTotal)}</span>
                    </div>
                    <div className="row between small">
                      <span className="muted">Sellers</span>
                      <span className="tnum">
                        {selectedSellers} ({selectedSellers > 1 ? 'separate requests' : '1 request'})
                      </span>
                    </div>
                    <div className="stack" style={{ gap: 8 }}>
                      <span className="tiny muted">SELECTED FULFILLMENT</span>
                      <div className="cart-fulfillment-list">
                        {cart
                          .filter((_, i) => selectedCartItems.has(i))
                          .map((c, sidx) => {
                            const p = byId(c.id)
                            if (!p) return null
                            const { chosen } = getFulfillment(p, c)
                            return (
                              <div key={sidx} className="row between tiny">
                                <ItemTitleWithVariant
                                  as="span"
                                  title={p.name}
                                  product={p}
                                  vid={c.vid}
                                  className="fulfill-item-title"
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: 165,
                                    display: 'block',
                                  }}
                                />
                                <span className={`pill ${chosen === 'delivery' ? 'blue' : 'green'}`}>
                                  {chosen === 'delivery' ? 'Delivery' : 'Pickup'}
                                </span>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                    <div className="row between small">
                      <span className="muted">Platform fee</span>
                      <span>₱0 (student service)</span>
                    </div>
                    <hr style={{ border: 0, borderTop: '1px solid var(--line)' }} />
                    <div className="row between">
                      <b>Pay in person</b>
                      <span className="price tnum" style={{ fontSize: 22 }}>
                        {peso(selectedCartTotal)}
                      </span>
                    </div>
                    <div className="note">
                      <Icon name="info" />
                      <span>
                        Bring exact cash or agree on e-wallet in person after inspecting the item.
                      </span>
                    </div>
                    {selectedCount === 0 ? (
                      <div className="note blue">
                        <Icon name="info" size="sm" />
                        <span className="small">
                          Select at least 1 item to continue.
                        </span>
                      </div>
                    ) : cartStep === 1 ? (
                      <button
                        type="button"
                        className="btn yellow block lg"
                        disabled={hasInvalidFulfillment}
                        onClick={() => {
                          if (hasInvalidFulfillment) {
                            toast('Please fix any invalid fulfillment method before continuing.')
                            return
                          }
                          setCartStep(2)
                        }}
                      >
                        Continue to confirmation
                      </button>
                    ) : (
                      <>
                        <div className="field">
                          <label htmlFor="cmsg">Note to seller (optional)</label>
                          <textarea
                            className="input"
                            id="cmsg"
                            value={cartMsg}
                            onChange={(e) => setCartMsg(e.target.value)}
                            rows={3}
                          />
                        </div>
                        <label className="check" style={{ marginTop: 10, alignItems: 'flex-start', gap: 10 }}>
                          <input
                            type="checkbox"
                            id="cagree"
                            checked={cartAgree}
                            onChange={(e) => {
                              setCartAgree(e.target.checked)
                              setCartErr('')
                            }}
                          />
                          <span>
                            I understand that RTU Tindahan only coordinates the campus pickup or delivery.
                            Payment is settled directly with the seller in person after inspecting the item.
                          </span>
                        </label>
                        {cartErr && (
                          <span className="err" role="alert">
                            {cartErr}
                          </span>
                        )}
                        <div className="stack" style={{ gap: 8 }}>
                          <button
                            type="button"
                            className="btn yellow block lg"
                            disabled={hasInvalidFulfillment}
                            onClick={handleSend}
                          >
                            Send order request
                          </button>
                          <button
                            type="button"
                            className="btn ghost block sm"
                            onClick={() => {
                              setCartStep(1)
                            }}
                          >
                            Back to items
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </>
  )
}
