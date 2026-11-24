import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import type { IconName } from '@/common/components/icons'
import { playRemove, playSuccess } from '@/common/sounds'
import { navigate } from '@/common/router/router'
import { PLACES, findVar, getSellerTimeWindows, isSvc, peso, unitPrice, varLabel } from '../constants'
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

export function CartPage() {
  const {
    currentAccount,
    cartStep,
    setCartStep,
    cartMsg,
    setCartMsg,
    cartAgree,
    setCartAgree,
    cartPayment,
    setCartPayment,
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

  const handleSend = () => {
    if (hasInvalidFulfillment) {
      toast('Please select a valid fulfillment method enabled by the seller before proceeding.')
      return
    }
    playSuccess()
    sendMeetupRequest()
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

      <div className="steps" role="list">
        {(
          ['1. Review items & fulfillment', '2. Message & confirm', '3. Request sent'] as const
        ).map((s, i) => (
          <div
            key={s}
            role="listitem"
            className={`step ${
              cartStep === i + 1 ? 'on' : cartStep > i + 1 ? 'done' : ''
            }`.trim()}
          >
            {s}
          </div>
        ))}
      </div>

      {cartStep === 3 && batchOrders.length === 0 && lastOrderIds.length > 0 ? (
        // The request was accepted by the server, but the order rows are still
        // being fetched. Showing the empty-cart screen here was the bug: the
        // confirmation must appear at once, with the reference it already has.
        <div className="card stack" style={{ gap: 10, maxWidth: 620 }}>
          <div className="sent-status-banner">
            <Icon name="check" size="sm" />
            <div>
              <b style={{ display: 'block' }}>
                {lastOrderIds.length === 1
                  ? 'Request sent'
                  : `${lastOrderIds.length} requests sent`}
              </b>
              <span className="tiny muted">
                Your seller has been notified. The full receipt is loading below.
              </span>
            </div>
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            {lastOrderIds.map((ref) => (
              <span key={ref} className="pill">
                #{ref}
              </span>
            ))}
          </div>
          <p className="small muted">
            Coordinate the campus meet-up in Messages, or track the request in My Orders. Nothing is
            charged online — you pay in person when you meet.
          </p>
          <div className="row wrap" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn yellow"
              onClick={() => {
                setCartStep(1)
                navigate('orders')
              }}
            >
              Track in My Orders
            </button>
            <button type="button" className="btn ghost" onClick={() => navigate('marketplace')}>
              Back to marketplace
            </button>
          </div>
        </div>
      ) : cartStep === 3 ? (
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
      ) : !cart.length ? (
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
            {cartStep === 2 ? null : (
              <div className="selection-bar">
                <label className="cart-check row between wrap">
                  <input
                    type="checkbox"
                    checked={selectedCount > 0 && selectedCount === cart.length}
                    onChange={() => toggleCartSelectAll()}
                  />
                  <span>
                    <b>Select all</b> ({selectedCount} of {cart.length} selected)
                  </span>
                </label>
                {selectedCount > 0 && (
                  <span className="tiny muted">
                    {selectedCartTotal > 0 ? peso(selectedCartTotal) : ''} ·{' '}
                    {selectedCartCount} item{selectedCartCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            )}

            {cart.map((c, idx) => {
              const p = byId(c.id)
              if (!p) return null
              if (cartStep === 2 && !selectedCartItems.has(idx)) return null
              const vr = c.vid && findVar(p, c.vid)
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
                  className={`card stack ${isSelected ? 'cart-item-selected' : 'cart-item-dimmed'}`}
                >
                  <div className="row between wrap">
                    <div className="row" style={{ minWidth: 0 }}>
                      <div
                        className={`photo cart-photo ${p.tone || 't-study'} ${
                          src ? 'has-img' : 'nophoto-tile'
                        }`.trim()}
                      >
                        {src ? <img className="pimg" src={src} alt={p.name} /> : null}
                        <Icon name={(p.icon || 'tag') as IconName} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <b style={{ overflowWrap: 'anywhere' }}>{p.name}</b>
                        <div className="row wrap" style={{ gap: 6, marginTop: 2 }}>
                          {vr && <span className="pill">{varLabel(p, vr)}</span>}
                          <span
                            className={`pill ${chosenMethod === 'delivery' ? 'blue' : 'green'}`}
                          >
                            {chosenMethod === 'delivery' ? 'Delivery' : 'Pickup'}
                          </span>
                        </div>
                        <div className="small muted">Seller: {p.seller}</div>
                        <span className="price tnum">{peso(pr)}</span>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
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

                  <div
                    className="card flat stack"
                    style={{ background: 'var(--bg)', padding: 12, gap: 10 }}
                  >
                    <div className="row between wrap">
                      <div className="row wrap" style={{ gap: 8 }}>
                        <span className="small">
                          <b>Fulfillment:</b>{' '}
                          {availMethod === 'none'
                            ? 'Not configured'
                            : chosenMethod === 'delivery'
                              ? 'Campus Delivery'
                              : 'Campus Pickup'}
                        </span>
                        <span className="tiny muted">
                          (
                          {availMethod === 'both'
                            ? 'Seller offers Pickup & Delivery'
                            : availMethod === 'delivery'
                              ? 'Seller offers Delivery only'
                              : availMethod === 'pickup'
                                ? 'Seller offers Pickup only'
                                : 'No method configured'}
                          )
                        </span>
                      </div>
                      {availMethod === 'both' && (
                        <div className="row" role="radiogroup" aria-label="Fulfillment method" style={{ gap: 6 }}>
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
                    </div>

                    {availMethod === 'none' && (
                      <div className="note" style={{ background: 'var(--red-bg)', borderColor: 'transparent' }}>
                        <Icon name="info" size="sm" />
                        <span className="small">
                          This listing does not have an enabled fulfillment method. Please remove it
                          or ask the seller to configure Pickup or Delivery.
                        </span>
                      </div>
                    )}

                    <div className="row between wrap">
                      <span className="small">
                        <b>{chosenMethod === 'delivery' ? 'Delivery:' : 'Meetup:'}</b>{' '}
                        {isOfficial
                          ? officialPlace
                          : chosenMethod === 'delivery' && c.deliverySpot
                            ? `${c.deliverySpot} (${c.place})`
                            : c.place}{' '}
                        · <b>{activeDateLabel}</b> · {activeTime}
                      </span>
                      <button
                        type="button"
                        className="link"
                        onClick={() => {
                          toggleCartEdit(idx)
                        }}
                      >
                        {c.edit || c.editing
                          ? 'Done'
                          : `Change ${chosenMethod === 'delivery' ? 'delivery' : 'pickup'} date & time`}
                      </button>
                    </div>

                    {(c.edit || c.editing || chosenMethod === 'delivery') ? (
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
            })}

          </div>

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
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 165,
                        }}
                      >
                        {p.name}
                      </span>
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
                <div className="field">
                  <label>How will you pay?</label>
                  <div className="row wrap" style={{ gap: 10 }}>
                    {(
                      [
                        ['cash', 'Cash at the campus meet-up'],
                        ['p2p', 'Transfer to the seller (GCash / Maya / bank)'],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="check">
                        <input
                          type="radio"
                          name="cpay"
                          value={value}
                          checked={cartPayment === value}
                          onChange={() => setCartPayment(value)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="tiny muted">
                    RTU Tindahan records this choice and nothing else. It never handles your money:
                    cash changes hands at the meet-up, or you transfer to each other directly.
                  </p>
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
        </div>
      )}
    </>
  )
}
