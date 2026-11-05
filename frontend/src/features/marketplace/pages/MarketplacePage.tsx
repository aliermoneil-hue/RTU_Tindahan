import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import type { IconName } from '@/common/components/icons'
import { navigate } from '@/common/router/router'
import { CATEGORIES, CAT_META, SERVICES_CAT } from '../constants'
import { useTindahan } from '../context/TindahanContext'
import { ProductCard } from '../components/ProductCard'
import './MarketplacePage.css'

export function MarketplacePage() {
  const {
    currentAccount,
    allOnSale,
    allServices,
    salesIndex,
    sortProducts,
    browseFor,
    setDraft,
    setListStep,
  } = useTindahan()

  const catRowRef = useRef<HTMLDivElement | null>(null)
  const [scrollState, setScrollState] = useState<'start' | 'mid' | 'end' | 'none'>('start')

  const syncScrollState = useCallback(() => {
    const r = catRowRef.current
    if (!r) return
    const max = r.scrollWidth - r.clientWidth
    if (max <= 2) {
      setScrollState('none')
    } else if (r.scrollLeft <= 2) {
      setScrollState('start')
    } else if (r.scrollLeft >= max - 2) {
      setScrollState('end')
    } else {
      setScrollState('mid')
    }
  }, [])

  useEffect(() => {
    syncScrollState()
    window.addEventListener('resize', syncScrollState)
    return () => window.removeEventListener('resize', syncScrollState)
  }, [syncScrollState])

  useEffect(() => {
    const row = catRowRef.current
    if (!row) return
    const onWheel = (e: WheelEvent) => {
      if (row.scrollWidth <= row.clientWidth) return
      e.preventDefault()
      e.stopPropagation()
      row.scrollBy({ left: e.deltaY, behavior: 'smooth' })
    }
    row.addEventListener('wheel', onWheel, { passive: false })
    return () => row.removeEventListener('wheel', onWheel)
  }, [])

  const scrollCats = (dir: -1 | 1) => {
    const r = catRowRef.current
    if (!r) return
    const calm =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    r.scrollBy({
      left: dir * Math.max(160, r.clientWidth * 0.7),
      behavior: calm ? 'auto' : 'smooth',
    })
  }

  const firstName = currentAccount?.first || 'Student'
  const greeting = (() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  })()

  const allChips = [...CATEGORIES, SERVICES_CAT]
  const latest = sortProducts(allOnSale, 'Newest')
  const best = sortProducts(
    allOnSale.filter((p) => (salesIndex.get(p.id)?.units || 0) > 0),
    'Best-Selling',
  )
  const svcs = sortProducts(allServices, 'Newest')

  const wrapCls = [
    'catwrap',
    scrollState === 'start' ? 'at-start' : '',
    scrollState === 'end' ? 'at-end' : '',
    scrollState === 'none' ? 'no-scroll' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div className="row between wrap">
        <div>
          <span className="eyebrow">
            {greeting.toUpperCase()}, {firstName.toUpperCase()}
          </span>
          <h1>What do you need around campus?</h1>
          <p className="muted small">
            Discover verified Pasig campus sellers, official products, and services ready for
            meetup.
          </p>
        </div>
      </div>

      <div
        className="card"
        style={{
          background: 'var(--navy)',
          color: '#fff',
          border: 0,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div className="stack" style={{ gap: 6, maxWidth: 520 }}>
          <span className="pill yellow" style={{ alignSelf: 'flex-start' }}>
            Today at RTU Pasig
          </span>
          <h2 style={{ fontSize: 22 }}>
            Merienda, school supplies, and more, ready for campus meetup.
          </h2>
          <p className="small" style={{ opacity: 0.85 }}>
            Browse listings that students and RTU staff have posted for campus meetup.
          </p>
        </div>
        <button
          type="button"
          className="btn yellow"
          onClick={() => browseFor({ goBrowse: true })}
        >
          Browse listings
          <Icon name="arrow" size="sm" />
        </button>
      </div>

      <div className={wrapCls} role="group" aria-label="Product categories">
        <button
          type="button"
          className="catarrow l"
          aria-label="Scroll categories left"
          onClick={() => scrollCats(-1)}
        >
          <Icon name="chev" size="sm" />
        </button>
        <div
          ref={catRowRef}
          className="catrow"
          tabIndex={0}
          aria-label="Categories, scroll sideways for more"
          onScroll={syncScrollState}
        >
          {allChips.map((c) => {
            const m = CAT_META[c] || ['t-drink', 'tag', 'Other']
            return (
              <button
                key={c}
                type="button"
                className="catchip"
                onClick={() => browseFor({ cats: [c] })}
              >
                <span className="catico">
                  <Icon name={m[1] as IconName} />
                </span>
                <span>{c}</span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className="catarrow r"
          aria-label="Scroll categories right"
          onClick={() => scrollCats(1)}
        >
          <Icon name="chev" size="sm" />
        </button>
      </div>

      {/* Latest Items */}
      <div className="stack" style={{ gap: 10 }}>
        <div className="row between wrap">
          <div>
            <h2 style={{ fontSize: 18 }}>Latest Items</h2>
            <span className="small muted">Newly published listings, newest first.</span>
          </div>
          {latest.length > 4 && (
            <button
              type="button"
              className="link"
              onClick={() => browseFor({ sortBy: 'Newest' })}
            >
              View more
            </button>
          )}
        </div>
        {latest.length ? (
          <div className="pgrid pgrid4">
            {latest.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div
            className="card stack"
            style={{ alignItems: 'center', textAlign: 'center', padding: 30 }}
          >
            <b>No listings yet</b>
            <p className="small muted">Be the first to post something for the Pasig campus.</p>
            <button
              type="button"
              className="btn yellow"
              onClick={() => {
                setDraft((prev) => (prev.editLid ? prev : { ...prev, type: 'product' }))
                setListStep(1)
                navigate('create')
              }}
            >
              Sell an item
            </button>
          </div>
        )}
      </div>

      {/* Best-Selling Items */}
      <div className="stack" style={{ gap: 10 }}>
        <div className="row between wrap">
          <div>
            <h2 style={{ fontSize: 18 }}>Best-Selling Items</h2>
            <span className="small muted">Ranked by completed pickups only.</span>
          </div>
          {best.length > 4 && (
            <button
              type="button"
              className="link"
              onClick={() => browseFor({ sortBy: 'Best-Selling' })}
            >
              View more
            </button>
          )}
        </div>
        {best.length ? (
          <div className="pgrid pgrid4">
            {best.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div
            className="card stack"
            style={{ alignItems: 'center', textAlign: 'center', padding: 30 }}
          >
            <b>No best sellers yet</b>
            <p className="small muted">
              This list fills in after students complete their first pickups. Requests and messages
              do not count.
            </p>
          </div>
        )}
      </div>

      {/* Student Services */}
      <div className="stack" style={{ gap: 10 }}>
        <div className="row between wrap">
          <div>
            <h2 style={{ fontSize: 18 }}>Student Services</h2>
            <span className="small muted">
              Printing, tutoring, rentals and other services offered by students. Open one to see
              details or request a booking.
            </span>
          </div>
          {svcs.length > 4 && (
            <button
              type="button"
              className="link"
              onClick={() => browseFor({ cats: [SERVICES_CAT] })}
            >
              View more
            </button>
          )}
        </div>
        {svcs.length ? (
          <div className="pgrid pgrid4">
            {svcs.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div
            className="card stack"
            style={{ alignItems: 'center', textAlign: 'center', padding: 30 }}
          >
            <b>No services offered yet</b>
            <p className="small muted">
              Students can offer printing, tutoring, rentals and more from Sell an item.
            </p>
            <button
              type="button"
              className="btn yellow"
              onClick={() => {
                setDraft((prev) => (prev.editLid ? prev : { ...prev, type: 'service' }))
                setListStep(1)
                navigate('create')
              }}
            >
              Offer a service
            </button>
          </div>
        )}
      </div>
    </>
  )
}
