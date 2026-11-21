import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import type { IconName } from '@/common/components/icons'
import { navigate } from '@/common/router/router'
import { MiniLoader } from '@/common/components/BrandLoader'
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
    listingsLoading,
  } = useTindahan()

  const catRowRef = useRef<HTMLDivElement | null>(null)
  const groupRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const offsetRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const groupWidthRef = useRef(0)
  const isPausedRef = useRef(false)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const startOffsetRef = useRef(0)
  const [isReducedMotion, setIsReducedMotion] = useState(false)

  // Measure group width via ResizeObserver
  useEffect(() => {
    const el = groupRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        groupWidthRef.current = entry.contentRect.width
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Sync reduced-motion preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setIsReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Marquee animation loop (50px/sec, GPU-composited translate3d)
  useEffect(() => {
    if (isReducedMotion) return
    const track = trackRef.current
    if (!track) return

    const SPEED = 50
    let last = performance.now()

    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now

      if (!isPausedRef.current && !isDraggingRef.current) {
        offsetRef.current += SPEED * dt
        const gw = groupWidthRef.current
        if (gw > 0) {
          offsetRef.current = ((offsetRef.current % gw) + gw) % gw
        }
        track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [isReducedMotion])

  // Mouse wheel on catrow container
  useEffect(() => {
    const row = catRowRef.current
    if (!row) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const gw = groupWidthRef.current
      offsetRef.current += (e.deltaY + e.deltaX) * 0.8
      if (gw > 0) {
        offsetRef.current = ((offsetRef.current % gw) + gw) % gw
      }
      const track = trackRef.current
      if (track) track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`
    }
    row.addEventListener('wheel', onWheel, { passive: false })
    return () => row.removeEventListener('wheel', onWheel)
  }, [])

  // Touch drag on catrow container
  useEffect(() => {
    const row = catRowRef.current
    if (!row) return
    const onStart = (e: TouchEvent) => {
      isDraggingRef.current = true
      startXRef.current = e.touches[0].clientX
      startOffsetRef.current = offsetRef.current
    }
    const onMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return
      const dx = e.touches[0].clientX - startXRef.current
      offsetRef.current = startOffsetRef.current - dx
      const gw = groupWidthRef.current
      if (gw > 0) {
        offsetRef.current = ((offsetRef.current % gw) + gw) % gw
      }
      const track = trackRef.current
      if (track) track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`
    }
    const onEnd = () => {
      isDraggingRef.current = false
    }
    row.addEventListener('touchstart', onStart, { passive: false })
    row.addEventListener('touchmove', onMove, { passive: false })
    row.addEventListener('touchend', onEnd)
    row.addEventListener('touchcancel', onEnd)
    return () => {
      row.removeEventListener('touchstart', onStart)
      row.removeEventListener('touchmove', onMove)
      row.removeEventListener('touchend', onEnd)
      row.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  // Smooth arrow-nudge animation (~260px over ~250ms)
  const nudgeOffset = useCallback((delta: number) => {
    const gw = groupWidthRef.current
    if (gw <= 0) return
    const start = offsetRef.current
    const target = start + delta
    const startTime = performance.now()
    const duration = 250

    const animate = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      offsetRef.current = start + (target - start) * ease
      offsetRef.current = ((offsetRef.current % gw) + gw) % gw
      const track = trackRef.current
      if (track) track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
  }, [])

  const scrollCats = (dir: -1 | 1) => {
    nudgeOffset(dir * 260)
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

  return (
    <>
      {listingsLoading && (
        <div style={{ padding: 40, textAlign: 'center', minHeight: 400 }}>
          <MiniLoader variant="section" size="lg" label="Loading campus listings…" />
        </div>
      )}
      {!listingsLoading && (
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

      <div className="catwrap" role="group" aria-label="Product categories">
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
          onMouseEnter={() => {
            isPausedRef.current = true
          }}
          onMouseLeave={() => {
            isPausedRef.current = false
          }}
        >
          <div
            ref={trackRef}
            className="marquee-track"
            style={{ transform: 'translate3d(0, 0, 0)' }}
          >
            {[0, 1, 2].flatMap((copy) => (
              <div
                key={`group-${copy}`}
                className="marquee-group"
                ref={copy === 0 ? groupRef : undefined}
              >
                {allChips.map((c) => {
                  const m = CAT_META[c] || ['t-drink', 'tag', 'Other']
                  return (
                    <button
                      key={`${copy}-${c}`}
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
            ))}
          </div>
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
      </>)}
    </>
  )
}
