import { baoLimitFor, baoWindowState, baoWindowText } from '../baoHelpers'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate, useRoute } from '@/common/router/router'
import { MiniLoader } from '@/common/components/BrandLoader'
import {
  catOf,
  hasVars,
  isSvc,
  peso,
  priceLabel,
  subOf,
  varLabel,
} from '../constants'
import { useTindahan } from '../context/TindahanContext'
import type { ChosenFulfillment, FulfillmentMethod, ProductVariationAttr, ProductVariationRow } from '../types'
import { AvatarBadge } from '../components/AvatarBadge'
import { ProductGallery } from '../components/PhotoUploader'
import { RatingText, StarsDisplay } from '../components/StarRating'
import './ProductPage.css'

export function ProductPage() {
  const { params } = useRoute()
  const {
    db,
    listingsLoading,
    currentAccount,
    isStaffUser,
    selectedProductId,
    byId,
    allOnSale,
    sellerKind,
    sellerKeyOf,
    acctByEmail,
    ratingOf,
    browseFor,
    toggleFav,
    toggleSellerFav,
    addToCart,
    reserveNow,
    startProductConversation,
    confirmDeleteReview,
    openModal,
    toast,
  } = useTindahan()
  const pid = params.get('id') || selectedProductId
  const p = pid ? byId(pid) : undefined
  const isOwner = Boolean(p && currentAccount && p.owner === currentAccount.email)
  const canView = allOnSale.some((x) => x.id === p?.id) || isOwner || isStaffUser
  const [selectedOpts, setSelectedOpts] = useState<Record<string, string>>({})
  const [variationWarned, setVariationWarned] = useState(false)
  const [qty, setQty] = useState(1)
  const [chosenFulfillment, setChosenFulfillment] = useState<ChosenFulfillment>('pickup')
  const [showMsgForm, setShowMsgForm] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [revLimit, setRevLimit] = useState(5)
  const [particles, setParticles] = useState<
    { x: number; y: number; id: number; r: string; tx: number; ty: number }[]
  >([])
  const [ripple, setRipple] = useState<{ x: number; y: number; active: boolean } | null>(null)

  const sellerFulfillment: FulfillmentMethod | 'none' = useMemo(() => {
    if (!p) return 'pickup'
    // Official RTU Store items are always campus pickup at the BAO window unless explicitly configured
    if (p.cat === 'Official' && !p.fulfillment) return 'pickup'
    const f = p.fulfillment || 'pickup'
    if (f === 'pickup' || f === 'delivery' || f === 'both') return f
    return 'none'
  }, [p])

  useEffect(() => {
    if (sellerFulfillment === 'delivery') {
      setChosenFulfillment('delivery')
    } else {
      setChosenFulfillment('pickup')
    }
  }, [p?.id, sellerFulfillment])

  const handleHeartClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setRipple({ x, y, active: true })
    setTimeout(() => setRipple(null), 600)

    const newParticles = Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2
      return {
        x,
        y,
        id: i,
        r: `${angle}rad`,
        tx: Math.cos(angle) * (20 + i * 3),
        ty: Math.sin(angle) * (20 + i * 3),
      }
    })
    setParticles(newParticles)
    setTimeout(() => setParticles([]), 500)

    if (p) toggleFav(p.id)
  }

  const reviewsRef = useRef<HTMLElement | null>(null)

  const itemReviews = useMemo(() => {
    if (!p) return []
    return db.reviews
      .filter((r) => r.kind === 'item' && r.pid === p.id)
      .sort((a, b) => b.ts - a.ts)
  }, [db.reviews, p])

  if (!p || !canView) {
    return (
      <div
        className="card stack"
        style={{ alignItems: 'center', textAlign: 'center', padding: 40 }}
      >
        <b>This listing is not available</b>
        <p className="small muted">
          It may have been removed or sold out. Browse the other listings instead.
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => browseFor({ goBrowse: true })}
        >
          Browse listings
        </button>
      </div>
    )
  }

  const svc = isSvc(p)
  const sk = sellerKind(p)
  const skey = sellerKeyOf(p)
  const cat = catOf(p)
  const sub = subOf(p)
  const fav = Boolean(currentAccount?.favs?.includes(p.id))
  const sfav = Boolean(currentAccount?.sfavs?.includes(skey))
  const isOwnListing = Boolean(p.owner && currentAccount && p.owner === currentAccount.email)

  const [place, win] = (p.when || '').split(',').map((s: string) => s.trim())
  const hasVariations = hasVars(p) && p.vars

  // Resolve matching variation row when all attributes are selected (selVar in js/9d-listings.js)
  const chosenVar = useMemo(() => {
    if (!hasVariations || !p.vars) return null
    for (const a of p.vars.attrs) {
      if (!selectedOpts[a.name]) return null
    }
    return (
      p.vars.rows.find((r: ProductVariationRow) =>
        p.vars!.attrs.every((a: ProductVariationAttr) => r.opts[a.name] === selectedOpts[a.name]),
      ) || null
    )
  }, [hasVariations, p.vars, selectedOpts])

  const unitPr =
    chosenVar && chosenVar.price != null ? chosenVar.price : p.price
  const availStock = hasVariations ? (chosenVar ? chosenVar.qty : p.left) : p.left
  const inCartLine = currentAccount?.cart.find(
    (c) => c.id === p.id && (c.vid || '') === (chosenVar ? chosenVar.id : ''),
  )

  const ensureVariationPicked = (): string | null => {
    if (!hasVariations || !p.vars) return ''
    if (chosenVar) return chosenVar.id
    toast(
      'Please choose your ' +
        p.vars.attrs.map((a: ProductVariationAttr) => a.name.toLowerCase()).join(' and ') +
        ' first.',
    )
    return null
  }

  // Option availability helper (matching varPickerHtml in js/9d-listings.js)
  const isOptSoldOut = (attrName: string, optVal: string): boolean => {
    if (!hasVariations || !p.vars) return false
    const matchingRows = p.vars.rows.filter((r: ProductVariationRow) => {
      if (r.opts[attrName] !== optVal) return false
      return p.vars!.attrs.every(
        (other: ProductVariationAttr) =>
          other.name === attrName ||
          !selectedOpts[other.name] ||
          r.opts[other.name] === selectedOpts[other.name],
      )
    })
    return matchingRows.reduce((sum: number, r: ProductVariationRow) => sum + r.qty, 0) < 1
  }

  const itemRating = ratingOf('item', p.id)
  const starBuckets = [5, 4, 3, 2, 1].map((s) => ({
    s,
    c: itemReviews.filter((r) => r.stars === s).length,
  }))

  const sellerAcct = p.owner ? acctByEmail(p.owner) : undefined
  const activeFulfillmentChoice: ChosenFulfillment =
    sellerFulfillment === 'delivery'
      ? 'delivery'
      : sellerFulfillment === 'pickup'
        ? 'pickup'
        : chosenFulfillment

  return (
    <>
      {listingsLoading ? (
        <div style={{ padding: 40, textAlign: 'center', minHeight: 400 }}>
          <MiniLoader variant="section" size="lg" label="Loading campus listings…" />
        </div>
      ) : (
        <>
      <div className="crumbs">
        <button type="button" onClick={() => navigate('marketplace')}>
          Marketplace
        </button>{' '}
        /
        <button type="button" onClick={() => browseFor({ cats: [cat] })}>
          {cat}
        </button>
        {sub && (
          <>
            {' '}
            /{' '}
            <button
              type="button"
              onClick={() => browseFor({ cats: [cat], sub })}
            >
              {sub}
            </button>
          </>
        )}{' '}
        / <span>{p.name}</span>
      </div>

      <div className="pgrid2">
        {/* Left column: gallery + about */}
        <div className="stack">
          <ProductGallery
            product={p}
            favButton={
              <button
                type="button"
                className={`heart ${fav ? 'on' : ''}`.trim()}
                aria-label="Save item"
                aria-pressed={fav}
                style={{ width: 38, height: 38 }}
                onClick={handleHeartClick}
              >
                <Icon name="heart" />
                {ripple && <div className="heart-ripple" style={{ left: '50%', top: '50%' }} />}
                {particles.map((pt) => (
                  <div
                    key={pt.id}
                    className="heart-particle"
                    style={
                      {
                        left: '50%',
                        top: '50%',
                        '--r': pt.r,
                        '--tx': `${pt.tx}px`,
                        '--ty': `${pt.ty}px`,
                      } as CSSProperties
                    }
                  />
                ))}
              </button>
            }
          />

          <div className="card stack">
            <b>{svc ? 'About this service' : 'About this listing'}</b>
            <p className="small muted" style={{ overflowWrap: 'anywhere' }}>
              {p.desc}
            </p>
            <div className="row wrap">
              {p.cond && <span className="pill">Condition: {p.cond}</span>}
              {p.avail && <span className="pill">Available days: {p.avail}</span>}
              <span className="pill">
                {p.cat === 'Official'
                  ? 'Sold by the Pasig Campus Store'
                  : 'Listed by a verified RTU student'}
              </span>
              <span className="pill yellow">
                {sellerFulfillment === 'both'
                  ? 'Campus Pickup or Delivery'
                  : sellerFulfillment === 'delivery'
                    ? 'Campus Delivery only'
                    : 'Campus Pickup only'}
              </span>
            </div>
          </div>
        </div>

        {/* Right column: buy card + seller card */}
        <div className="stack">
          <div className={`card stack pdetail-card ${svc ? 'type-service' : sk === 'school' ? 'type-school' : 'type-student'}`}>
            <div className="row between wrap">
              <span className="row wrap" style={{ gap: 6 }}>
                <span className={`srcpill ${sk}`}>
                  {sk === 'school' ? (
                    <>
                      <Icon name="shield" size="sm" />
                      Official RTU Store
                    </>
                  ) : (
                    'Student seller'
                  )}
                </span>
                {svc ? (
                  <span className="srcpill svc">
                    Service{p.svcType ? ` · ${p.svcType}` : ''}
                  </span>
                ) : sub === 'Uniform' || p.tag === 'Uniform' ? (
                  <span className="pill blue">Uniform</span>
                ) : sub ? (
                  <span className="pill">{sub}</span>
                ) : p.cat === 'Official' && p.tag ? (
                  <span className="pill">{p.tag}</span>
                ) : null}
              </span>
              <span className="pill green">
                {svc
                  ? `Available · ${p.avail || 'By arrangement'}`
                  : hasVariations
                    ? chosenVar
                      ? `${chosenVar.qty} in stock (${varLabel(p, chosenVar)})`
                      : `${p.left} in stock across options`
                    : `${p.left} available`}
              </span>
            </div>

            <h1 style={{ fontSize: 22, overflowWrap: 'anywhere' }}>{p.name}</h1>

            <div className="row">
              <span className="price tnum" style={{ fontSize: 26 }}>
                {hasVariations && !chosenVar ? priceLabel(p) : peso(unitPr)}
              </span>
              <span className="muted small">per {p.unit}</span>
            </div>

            <div className="small">
              <RatingText
                kind="item"
                targetKey={p.id}
                onClick={() => reviewsRef.current?.scrollIntoView({ behavior: 'smooth' })}
              />
            </div>

            <div className="row wrap" style={{ gap: 8 }}>
              <button
                type="button"
                className="link"
                onClick={() => openModal({ kind: 'seller-profile', sellerName: p.seller })}
              >
                {p.seller}
              </button>
              <span className="small muted">
                ·{' '}
                {sk === 'school'
                  ? 'Pasig Campus Store (RTU)'
                  : `Verified RTU student${svc ? '' : ' seller'}`}
              </span>
              <span className="small">
                · <RatingText kind="seller" targetKey={skey} />
              </span>
            </div>

            <div className="card flat grid2" style={{ background: 'var(--bg)' }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <Icon name="pin" />
                <div>
                  <span className="tiny muted">
                    {activeFulfillmentChoice === 'delivery' ? 'DELIVERY HUB' : 'MEETUP POINT'}
                  </span>
                  <br />
                  <b className="small">{place || p.when}</b>
                </div>
              </div>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <Icon name="clock" />
                <div>
                  <span className="tiny muted">
                    {activeFulfillmentChoice === 'delivery' ? 'DELIVERY WINDOW' : 'PICKUP WINDOW'}
                  </span>
                  <br />
                  <b className="small">{win || '12:00 to 1:00 PM'}</b>
                </div>
              </div>
            </div>

            {/* Requirement #1: Buyer Fulfillment Method Selection based on Seller Configuration */}
            <div className="card flat stack" style={{ background: 'var(--bg)', gap: 8 }}>
              <div className="row between wrap">
                <b className="small">Fulfillment method</b>
                <span className="tiny muted">
                  {sellerFulfillment === 'both'
                    ? 'Seller offers both Pickup & Delivery'
                    : sellerFulfillment === 'delivery'
                      ? 'Seller offers Delivery only'
                      : sellerFulfillment === 'pickup'
                        ? 'Seller offers Pickup only'
                        : 'Fulfillment not configured'}
                </span>
              </div>

              {sellerFulfillment === 'none' ? (
                <div className="note" style={{ background: 'var(--red-bg)', borderColor: 'transparent' }}>
                  <Icon name="info" size="sm" />
                  <span className="small">
                    Neither pickup nor delivery is currently configured for this listing. You cannot
                    place an order until the seller configures a fulfillment method.
                  </span>
                </div>
              ) : (
                <div
                  className="row wrap"
                  role="radiogroup"
                  aria-label="Choose fulfillment method"
                  style={{ gap: 8 }}
                >
                  {(sellerFulfillment === 'pickup' || sellerFulfillment === 'both') && (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={activeFulfillmentChoice === 'pickup'}
                      className={`btn sm ${activeFulfillmentChoice === 'pickup' ? '' : 'ghost'}`.trim()}
                      onClick={() => setChosenFulfillment('pickup')}
                    >
                      <Icon name="pin" size="sm" />
                      Pickup
                      {sellerFulfillment === 'pickup' ? ' (Only option)' : ''}
                    </button>
                  )}
                  {(sellerFulfillment === 'delivery' || sellerFulfillment === 'both') && (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={activeFulfillmentChoice === 'delivery'}
                      className={`btn sm ${activeFulfillmentChoice === 'delivery' ? '' : 'ghost'}`.trim()}
                      onClick={() => setChosenFulfillment('delivery')}
                    >
                      <Icon name="bag" size="sm" />
                      Delivery
                      {sellerFulfillment === 'delivery' ? ' (Only option)' : ''}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* BAO v1.6 Official Store ordering window, student limit & claim notes */}
            {db.official.some((x) => x.id === p.id) &&
              (() => {
                const lines: string[] = []
                baoWindowText(db.bao, p).forEach((x) => lines.push(x))
                const lim = baoLimitFor(db.bao, p)
                if (lim) lines.push(`Limit: ${lim} per student.`)
                if (p.inv?.claimNote) lines.push(`Claim notes: ${p.inv.claimNote}`)
                if (db.bao.settings.claimNote) lines.push(`Claim notes: ${db.bao.settings.claimNote}`)
                if (!lines.length) return null
                const w = baoWindowState(db.bao, p)
                return (
                  <div
                    className={`note ${w.open ? 'blue' : ''}`.trim()}
                    role="status"
                    data-bao-notes
                  >
                    <Icon name={w.open ? 'info' : 'clock'} size="sm" />
                    <span className="small">
                      {lines.map((ln, idx) => (
                        <span key={idx} style={{ display: 'block' }}>
                          {ln}
                        </span>
                      ))}
                    </span>
                  </div>
                )
              })()}

            {/* Per-attribute variation picker (varPickerHtml in js/9d-listings.js) */}
            {hasVariations && p.vars && (
              <div className="stack" style={{ gap: 10 }}>
                {p.vars.attrs.map((a: ProductVariationAttr) => (
                  <div key={a.name} className="stack" style={{ gap: 6 }}>
                    <div className="row between">
                      <b className="small">{a.name}</b>
                      <span className="tiny muted">
                        {selectedOpts[a.name] ? `Selected: ${selectedOpts[a.name]}` : 'Choose one'}
                      </span>
                    </div>
                    <div
                      className="row wrap"
                      role="group"
                      aria-label={a.name}
                      style={{ gap: 6 }}
                    >
                      {a.opts.map((v: string) => {
                        const on = selectedOpts[a.name] === v
                        const out = isOptSoldOut(a.name, v)
                        return (
                          <button
                            key={v}
                            type="button"
                            className={`btn sm ${on ? '' : 'ghost'} vopt`.trim()}
                            aria-pressed={on}
                            disabled={out}
                            onClick={() => {
                              setSelectedOpts((prev) => ({
                                ...prev,
                                [a.name]: prev[a.name] === v ? '' : v,
                              }))
                              setQty(1)
                              setVariationWarned(false)
                            }}
                          >
                            {v}
                            {out ? ' (out)' : ''}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <div className="tiny muted" role="status">
                  {chosenVar
                    ? `${chosenVar.qty} in stock for ${varLabel(p, chosenVar)}`
                    : 'Choose an option in each row to see stock and reserve.'}
                </div>
              </div>
            )}

            <div className="row wrap">
              <div className="qty" role="group" aria-label="Quantity">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <span className="tnum" aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => {
                    const max = Math.max(1, availStock)
                    if (qty + 1 > max) {
                      toast(`Only ${max} left.`)
                      return
                    }
                    setQty((q) => q + 1)
                  }}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="btn yellow grow"
                disabled={availStock < 1 || sellerFulfillment === 'none'}
                onClick={() => {
                  if (sellerFulfillment === 'none') {
                    toast('This listing does not have an active fulfillment method.')
                    return
                  }
                  if (hasVariations && !chosenVar) {
                    setVariationWarned(true)
                    return
                  }
                  const vid = ensureVariationPicked()
                  if (vid === null) return
                  reserveNow(p.id, qty, vid, activeFulfillmentChoice)
                }}
              >
                {svc
                  ? `Request service (${activeFulfillmentChoice === 'delivery' ? 'Delivery' : 'Pickup'})`
                  : `Reserve for ${activeFulfillmentChoice === 'delivery' ? 'delivery' : 'pickup'}`}{' '}
                · {peso(unitPr * qty)}
              </button>
            </div>

            {hasVariations && !chosenVar && variationWarned && (
              <div
                className="note"
                style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--red)' }}
              >
                <Icon name="info" size="sm" style={{ marginTop: 2 }} />
                <span className="small">
                  Please choose{' '}
                  {p.vars?.attrs.map((a) => a.name.toLowerCase()).join(' and ')}
                  {' '}
                  to enable Reserve and Add to Cart.
                </span>
              </div>
            )}

            <div className="row">
              <button
                type="button"
                className="btn ghost grow"
                disabled={availStock < 1 || sellerFulfillment === 'none'}
                onClick={() => {
                  if (sellerFulfillment === 'none') {
                    toast('This listing does not have an active fulfillment method.')
                    return
                  }
                  if (hasVariations && !chosenVar) {
                    setVariationWarned(true)
                    return
                  }
                  const vid = ensureVariationPicked()
                  if (vid === null) return
                  if (addToCart(p.id, qty, vid, activeFulfillmentChoice)) {
                    toast(
                      `${qty} added to your request cart (${
                        activeFulfillmentChoice === 'delivery' ? 'Delivery' : 'Pickup'
                      }).`,
                    )
                    setQty(1)
                  }
                }}
              >
                <Icon name="cart" size="sm" />
                {inCartLine ? `In cart (${inCartLine.qty})` : 'Add to request cart'}
              </button>
              <button
                type="button"
                className="btn ghost grow"
                onClick={() => {
                  if (isOwnListing) {
                    toast('That is your own listing.')
                    return
                  }
                  setShowMsgForm((prev) => !prev)
                }}
              >
                <Icon name="msg" size="sm" />
                {svc ? 'Contact provider' : 'Message seller'}
              </button>
            </div>

            {showMsgForm && (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (startProductConversation(p.id, msgText)) {
                    setMsgText('')
                    setShowMsgForm(false)
                  }
                }}
              >
                <textarea
                  className="input"
                  id="smsg"
                  placeholder="Ask about condition, size or another pickup window..."
                  aria-label="Message to the seller"
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                />
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setShowMsgForm(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn sm">
                    Send message
                  </button>
                </div>
              </form>
            )}

            <p className="tiny muted">
              No online payment. You pay the seller in person when you meet on campus.
            </p>

            {isStaffUser && sk === 'student' && (
              <div
                className="card flat row between wrap"
                style={{ background: 'var(--bg)', padding: '10px 12px', gap: 8 }}
              >
                <span className="tiny muted">
                  <b>Admin moderation:</b> Pause or delete this student listing
                </span>
                <button
                  type="button"
                  className="btn danger sm"
                  onClick={() => openModal({ kind: 'admin-remove-listing', lid: p.id })}
                >
                  Pause / Delete listing
                </button>
              </div>
            )}
          </div>

          {/* Seller card */}
          <div className="card row wrap">
            {p.cat === 'Official' ? (
              <span className="avw av-lg">
                <span className="avatar staff">RTU</span>
              </span>
            ) : (
              <AvatarBadge
                account={sellerAcct}
                name={p.seller}
                size="lg"
              />
            )}
            <div className="grow">
              <b>{p.seller}</b>
              <div className="small muted">
                {p.cat === 'Official'
                  ? 'Official Pasig Campus Store'
                  : 'Verified RTU student seller'}
              </div>
              <div className="small">
                <RatingText kind="seller" targetKey={skey} />
              </div>
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              {!isOwnListing && (
                <button
                  type="button"
                  className={`btn ghost sm sfav ${sfav ? 'on' : ''}`.trim()}
                  aria-pressed={sfav}
                  onClick={() => toggleSellerFav(skey)}
                >
                  <Icon name="heart" size="sm" />
                  {sfav ? 'Favorite seller' : 'Add seller to favorites'}
                </button>
              )}
              <button
                type="button"
                className="link"
                onClick={() => openModal({ kind: 'seller-profile', sellerName: p.seller })}
              >
                View seller profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Item ratings and reviews panel (reviewsPanel in js/9e-reviews-ranking.js) */}
      <section
        ref={reviewsRef}
        className="card stack"
        id="item-reviews"
        aria-label="Item ratings and reviews"
      >
        <div className="row between wrap">
          <div>
            <b>Item ratings and reviews</b>
            <p className="small muted">
              Only buyers who completed a campus pickup for this item can leave a rating.
            </p>
          </div>
          <div>
            <RatingText kind="item" targetKey={p.id} />
          </div>
        </div>

        {itemReviews.length ? (
          <>
            <div className="grid2" style={{ alignItems: 'center' }}>
              <div className="stack" style={{ gap: 4 }}>
                <div className="row" style={{ gap: 8 }}>
                  <b className="tnum" style={{ fontSize: 28 }}>
                    {itemRating.avg.toFixed(1)}
                  </b>
                  <div>
                    <StarsDisplay avg={itemRating.avg} />
                    <div className="tiny muted tnum">
                      {itemRating.n} verified {itemRating.n === 1 ? 'review' : 'reviews'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="stack" style={{ gap: 4 }}>
                {starBuckets.map((b) => (
                  <div key={b.s} className="row tiny" style={{ gap: 6 }}>
                    <span className="tnum" style={{ width: 28 }}>
                      {b.s} ★
                    </span>
                    <div className="bar">
                      <div
                        style={{
                          width: `${Math.round((b.c / itemRating.n) * 100)}%`,
                        }}
                      />
                    </div>
                    <span
                      className="tnum muted"
                      style={{ width: 24, textAlign: 'right' }}
                    >
                      {b.c}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="stack" style={{ gap: 10 }}>
              {itemReviews.slice(0, revLimit).map((r) => {
                const canDelete =
                  currentAccount && (r.buyerEmail === currentAccount.email || isStaffUser)
                const reviewerAcct = acctByEmail(r.buyerEmail)
                return (
                  <div
                    key={r.id}
                    className="card flat stack"
                    style={{ gap: 6, background: 'var(--bg)' }}
                  >
                    <div className="row between wrap">
                      <span className="row" style={{ gap: 8 }}>
                        <AvatarBadge
                          account={reviewerAcct}
                          name={r.buyerName}
                          size="sm"
                        />
                        <b>{r.buyerName}</b>
                        <span className="pill green">Verified pickup</span>
                        <StarsDisplay avg={r.stars} />
                      </span>
                      <span className="row" style={{ gap: 8 }}>
                        <span className="tiny muted">
                          {new Date(r.ts).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          {r.edited ? ' · edited' : ''}
                        </span>
                        {canDelete && (
                          <button
                            type="button"
                            className="link"
                            style={{ color: 'var(--red)' }}
                            onClick={() => confirmDeleteReview(r.id)}
                          >
                            {r.buyerEmail === currentAccount?.email ? 'Delete' : 'Remove'}
                          </button>
                        )}
                      </span>
                    </div>
                    {r.text ? (
                      <p className="small" style={{ overflowWrap: 'anywhere' }}>
                        {r.text}
                      </p>
                    ) : (
                      <p className="tiny muted">Rated with stars only.</p>
                    )}
                  </div>
                )
              })}
            </div>

            {itemReviews.length > revLimit && (
              <button
                type="button"
                className="btn ghost sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setRevLimit((n) => n + 5)}
              >
                Show more reviews ({itemReviews.length - revLimit} more)
              </button>
            )}
          </>
        ) : (
          <p className="small muted">
            No ratings yet. After a buyer picks this up on campus, their rating appears here.
          </p>
        )}
      </section>
        </>
      )}
    </>
  )
}
