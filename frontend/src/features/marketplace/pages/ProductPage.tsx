import { ItemTitleWithVariant } from '@/common/components/ItemTitleWithVariant'
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
import { imgsOf, imgSrc } from '../imageStore'
import './ProductPage.css'

export function ProductPage() {
  const { params } = useRoute()
  const {
    db,
    listingsLoading,
    currentAccount,
    isStaffUser,
    selectedProductId,
    setSelectedProductId,
    byId,
    allOnSale,
    allServices,
    sellerKind,
    sellerKeyOf,
    acctByEmail,
    ratingOf,
    browseFor,
    toggleFav,
    toggleSellerFav,
    addToCart,
    reserveNow,
    confirmDeleteReview,
    openModal,
    openSellerConversation,
    toast,
  } = useTindahan()
  const urlId = params.get('id')
  const pid = urlId || selectedProductId
  const p = pid ? byId(pid) : undefined
  const isOwner = Boolean(p && currentAccount && p.owner === currentAccount.email)
  const canView = p ? allOnSale.some((x) => String(x.id) === String(p.id)) || allServices.some((x) => String(x.id) === String(p.id)) || isOwner || isStaffUser : false

  // Keep the internal selection in sync with the URL id (e.g. after login from a guest link).
  useEffect(() => {
    if (urlId && selectedProductId !== urlId) {
      setSelectedProductId(urlId)
    }
  }, [urlId, selectedProductId, setSelectedProductId])
  const [selectedOpts, setSelectedOpts] = useState<Record<string, string>>({})
  const [variationWarned, setVariationWarned] = useState(false)
  const [qty, setQty] = useState(1)
  const [chosenFulfillment, setChosenFulfillment] = useState<ChosenFulfillment>('pickup')
  const [revLimit, setRevLimit] = useState(5)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(0)
  const [particles, setParticles] = useState<
    { x: number; y: number; id: number; r: string; tx: number; ty: number }[]
  >([])
  const [ripple, setRipple] = useState<{ x: number; y: number; active: boolean } | null>(null)

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setLightboxIdx((i) => (i > 0 ? i - 1 : 0))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        const list = imgsOf(p!)
        setLightboxIdx((i) => (i < list.length - 1 ? i + 1 : i))
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [lightboxOpen, p])

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

  // If listings are still loading, don't show "not available" yet — the
  // product may just not have arrived from the backend.
  if (listingsLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', minHeight: 400 }}>
        <MiniLoader variant="section" size="lg" label="Loading listing…" />
      </div>
    )
  }

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
        / <ItemTitleWithVariant title={p.name} />
      </div>

      <div className={`pgrid2 pdp-main-card ${svc ? 'type-service' : sk === 'school' ? 'type-school' : 'type-student'}`}>
        {/* Left column: gallery + about */}
        <div className="stack pgrid2-left">
          <div className="pgrid2-media">
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
              onMainImageClick={(idx) => {
                setLightboxIdx(idx)
                setLightboxOpen(true)
              }}
            />
          </div>

          <div className="card stack pgrid2-about">
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
        <div className="stack pgrid2-right">
          <div className="card stack pdetail-card">
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
            </div>

            <ItemTitleWithVariant
              as="h1"
              title={p.name}
              style={{ fontSize: 22, overflowWrap: 'anywhere', display: 'block' }}
            />

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

            {/* Combined fulfillment info card: Meetup point + Pickup window + Fulfillment method */}
            <div className="card flat stack info-card" style={{ background: 'var(--soft)', gap: 10, padding: '12px 14px' }}>
              <div className="info-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
                <div className="info-col">
                  <div className="row" style={{ alignItems: 'flex-start', gap: 6 }}>
                    <Icon name="pin" size="sm" />
                    <div>
                      <span className="tiny muted" style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>
                        {activeFulfillmentChoice === 'delivery' ? 'DELIVERY HUB' : 'MEETUP POINT'}
                      </span>
                      <br />
                      <b className="small">{place || p.when}</b>
                    </div>
                  </div>
                </div>
                <div className="info-col">
                  <div className="row" style={{ alignItems: 'flex-start', gap: 6 }}>
                    <Icon name="clock" size="sm" />
                    <div>
                      <span className="tiny muted" style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>
                        {activeFulfillmentChoice === 'delivery' ? 'DELIVERY WINDOW' : 'PICKUP WINDOW'}
                      </span>
                      <br />
                      <b className="small">{win || '12:00 to 1:00 PM'}</b>
                    </div>
                  </div>
                </div>
                <div className="info-col">
                  <div className="row" style={{ alignItems: 'flex-start', gap: 6 }}>
                    <div>
                      <span className="tiny muted" style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>
                        FULFILLMENT METHOD
                      </span>
                      <br />
                      <div className="row wrap" role="radiogroup" aria-label="Choose fulfillment method" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
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
                    </div>
                  </div>
                </div>
              </div>
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

            <div className="row wrap" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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

            <div className="cta-row">
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
            <button
              type="button"
              className="seller-card-link"
              aria-label="View seller profile"
              onClick={() => openModal({ kind: 'seller-profile', sellerName: p.seller })}
            >
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
            </button>
            <div className="seller-card-actions">
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
              {!isOwnListing && (
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => {
                    if (isOwnListing) {
                      toast('That is your own listing.')
                      return
                    }
                    openSellerConversation(p.owner ?? null)
                  }}
                >
                  <Icon name="msg" size="sm" />
                  {svc ? 'Contact provider' : 'Message seller'}
                </button>
              )}
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

      {/* Image Lightbox Modal */}
      {lightboxOpen && p && (
        <div
          className="lightbox-backdrop"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          <div
            className="lightbox-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              className="lightbox-close"
              aria-label="Close lightbox"
              onClick={() => setLightboxOpen(false)}
            >
              ×
            </button>

            {/* Left stage: zoomed image */}
            <div className="lightbox-stage">
              <button
                type="button"
                className="lightbox-nav lightbox-nav-prev"
                aria-label="Previous photo"
                disabled={lightboxIdx === 0}
                onClick={(e) => {
                  e.stopPropagation()
                  setLightboxIdx((i) => (i > 0 ? i - 1 : 0))
                }}
              >
                ‹
              </button>
              <img
                className="lightbox-img"
                src={imgsOf(p)[lightboxIdx] ? imgSrc(imgsOf(p)[lightboxIdx]!) : ''}
                alt={p.name}
              />
              <button
                type="button"
                className="lightbox-nav lightbox-nav-next"
                aria-label="Next photo"
                disabled={lightboxIdx >= imgsOf(p).length - 1}
                onClick={(e) => {
                  e.stopPropagation()
                  const list = imgsOf(p)
                  setLightboxIdx((i) => (i < list.length - 1 ? i + 1 : i))
                }}
              >
                ›
              </button>
              <span className="lightbox-counter">
                {lightboxIdx + 1} / {imgsOf(p).length}
              </span>
            </div>

            {/* Right sidebar: title + thumbnails */}
            <div className="lightbox-sidebar">
              <h2 style={{ fontSize: 18, margin: 0, overflowWrap: 'anywhere' }}>
                {p.name}
              </h2>
              <div className="lightbox-thumbs">
                {imgsOf(p).map((id, i) => {
                  const src = imgSrc(id)
                  if (!src) return null
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`lightbox-thumb ${
                        i === lightboxIdx ? 'on' : ''
                      }`.trim()}
                      aria-label={`Show photo ${i + 1}`}
                      aria-pressed={i === lightboxIdx}
                      onClick={() => setLightboxIdx(i)}
                    >
                      <img src={src} alt="" />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </>
  )
}