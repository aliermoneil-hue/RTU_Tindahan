import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { SERVICES_CAT } from '../constants'
import { useTindahan } from '../context/TindahanContext'
import { AvatarBadge } from '../components/AvatarBadge'
import { ProductCard } from '../components/ProductCard'
import { RatingText } from '../components/StarRating'
import './StudentSellersPage.css'

export function StudentSellersPage() {
  const {
    currentAccount,
    allProducts,
    sellerKind,
    sellerKeyByName,
    acctByEmail,
    browseFor,
    toggleSellerFav,
    openModal,
  } = useTindahan()

  const mine = useMemo(
    () => allProducts.filter((p) => sellerKind(p) === 'student'),
    [allProducts, sellerKind],
  )

  const sellerNames = useMemo(() => {
    const map = new Map<string, number>()
    mine.forEach((p) => map.set(p.seller, (map.get(p.seller) || 0) + 1))
    return Array.from(map.entries())
  }, [mine])

  /* ========================================================================
     Marquee strip refs & state (matches MarketplacePage category strip)
     ======================================================================== */
  const sellerRowRef = useRef<HTMLDivElement | null>(null)
  const sellerGroupRef = useRef<HTMLDivElement | null>(null)
  const sellerTrackRef = useRef<HTMLDivElement | null>(null)
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
    const el = sellerGroupRef.current
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
    const track = sellerTrackRef.current
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

  // Mouse wheel on seller row container
  useEffect(() => {
    const row = sellerRowRef.current
    if (!row) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const gw = groupWidthRef.current
      offsetRef.current += (e.deltaY + e.deltaX) * 0.8
      if (gw > 0) {
        offsetRef.current = ((offsetRef.current % gw) + gw) % gw
      }
      const track = sellerTrackRef.current
      if (track) track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`
    }
    row.addEventListener('wheel', onWheel, { passive: false })
    return () => row.removeEventListener('wheel', onWheel)
  }, [])

  // Touch drag on seller row container
  useEffect(() => {
    const row = sellerRowRef.current
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
      const track = sellerTrackRef.current
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

  return (
    <>
      <div className="srchead">
        <div style={{ maxWidth: 'none' }}>
          <span className="eyebrow">STUDENT SELLERS</span>
          <h1>Items sold by students</h1>
          <p className="muted small">
            Listings posted by verified RTU students. Staff checked each one before it went live.
            Official school products are in the{' '}
            <button type="button" className="link" onClick={() => navigate('store')}>
              Official RTU Store
            </button>
            , and student services are in{' '}
            <button
              type="button"
              className="link"
              onClick={() => browseFor({ cats: [SERVICES_CAT] })}
            >
              Browse All, category Services
            </button>
            .
          </p>
        </div>
        <button type="button" className="btn yellow" onClick={() => navigate('create')}>
          <Icon name="plus" size="sm" />
          Sell an item
        </button>
      </div>

      {sellerNames.length > 0 && (
        <div className="card stack">
          <b>Student sellers</b>
          <div className="seller-wrap">
            <div
              ref={sellerRowRef}
              className="seller-row"
              tabIndex={0}
              aria-label="Student sellers, scroll sideways for more"
              onMouseEnter={() => {
                isPausedRef.current = true
              }}
              onMouseLeave={() => {
                isPausedRef.current = false
              }}
              onFocus={() => {
                isPausedRef.current = true
              }}
              onBlur={() => {
                isPausedRef.current = false
              }}
              onTouchStart={() => {
                isPausedRef.current = true
              }}
              onTouchEnd={() => {
                isPausedRef.current = false
              }}
            >
              <div
                ref={sellerTrackRef}
                className="seller-track"
                style={{ transform: 'translate3d(0, 0, 0)' }}
              >
                {[0, 1, 2].flatMap((copy) => (
                  <div
                    key={`seller-group-${copy}`}
                    className="seller-group"
                    ref={copy === 0 ? sellerGroupRef : undefined}
                  >
                    {sellerNames.map(([nm]) => {
                      const skey = sellerKeyByName(nm)
                      const acct = skey && skey !== 'official' ? acctByEmail(skey) : undefined
                      const isOwn = Boolean(currentAccount && skey === currentAccount.email)
                      const sfav = Boolean(skey && currentAccount?.sfavs?.includes(skey))
                      return (
                        <div key={`${nm}-${copy}`} className="seller-chip">
                          <button
                            type="button"
                            className="row"
                            style={{ background: 'none', border: 0, gap: 8, textAlign: 'left' }}
                            onClick={() => openModal({ kind: 'seller-profile', sellerName: nm })}
                          >
                            <AvatarBadge account={acct} name={nm} size="md" noTip />
                            <div>
                              <b style={{ fontSize: 12.5, display: 'block' }}>{nm}</b>
                              <span className="tiny" style={{ display: 'block' }}>
                                <RatingText kind="seller" targetKey={skey || nm} />
                              </span>
                            </div>
                          </button>
                          {currentAccount && skey && !isOwn && (
                            <button
                              type="button"
                              className={`heart sfav-ico ${sfav ? 'on' : ''}`.trim()}
                              aria-pressed={sfav}
                              aria-label={
                                sfav ? 'Remove seller from favorites' : 'Add seller to favorites'
                              }
                              onClick={() => toggleSellerFav(skey)}
                            >
                              <Icon name="heart" size="sm" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {mine.length ? (
        <div className="pgrid student-sellers-grid">
          {mine.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div
          className="card stack"
          style={{ alignItems: 'center', textAlign: 'center', padding: 40 }}
        >
          <span style={{ color: 'var(--blue)' }}>
            <Icon name="user" />
          </span>
          <b>No student listings yet</b>
          <p className="small muted" style={{ maxWidth: '48ch' }}>
            Approved student listings show up here. Be the first to sell something.
          </p>
          <button type="button" className="btn yellow" onClick={() => navigate('create')}>
            Sell an item
          </button>
        </div>
      )}
    </>
  )
}
