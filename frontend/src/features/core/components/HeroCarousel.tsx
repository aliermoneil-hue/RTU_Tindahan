import { useEffect, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { apiFetch } from '@/common/api/client'
import { peso } from '@/features/marketplace/constants'
import './HeroCarousel.css'

const AUTOPLAY_MS = 6500

interface TopSellingItem {
  id: number
  slug: string
  title: string
  price: string
  image_url: string | null
  seller_name: string
  is_official: boolean
  category_name: string
  sold_count: number
  rating: number | null
}

/** Normalise a response that may be a plain array or a paginated object. */
function normaliseResponse(data: unknown): TopSellingItem[] {
  if (Array.isArray(data)) return data as TopSellingItem[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.results)) return obj.results as TopSellingItem[]
    if (Array.isArray(obj.items)) return obj.items as TopSellingItem[]
  }
  return []
}

/**
 * Live hero carousel: fetches top-selling approved listings from the public
 * `/top-selling/` endpoint (no authentication required) and renders up to 5
 * product slides. Falls back to a loading skeleton and then an empty state.
 * All existing carousel features are preserved: prev/next, dots, pause/play,
 * autoplay, hover/focus pause, reduced-motion, and arrow-key navigation.
 */
export function HeroCarousel() {
  const [items, setItems] = useState<TopSellingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )
  const [hovering, setHovering] = useState(false)
  const count = items.length

  const go = (i: number) => setIndex(((i % count) + count) % count)

  // Fetch top-selling products on mount (unauthenticated / guest-safe).
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const data = await apiFetch<unknown>('/top-selling/')
        if (!cancelled) {
          setItems(normaliseResponse(data))
        }
      } catch (err) {
        console.error('[HeroCarousel] Failed to fetch top-selling products:', err)
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-advance unless paused, hovering, focused, or reduced motion.
  useEffect(() => {
    if (paused || hovering || count === 0) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS)
    return () => window.clearInterval(id)
  }, [paused, hovering, count, index])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(index - 1)
    if (e.key === 'ArrowRight') go(index + 1)
  }

  // Controls are siblings of .car-slide, but stopPropagation anyway so a
  // click on prev / next / dots / pause never triggers slide navigation.
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  const handleSlideClick = (item: TopSellingItem, e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`product?id=api:${encodeURIComponent(item.slug)}`)
  }

  // ---------- Loading skeleton ----------
  if (loading) {
    return (
      <div
        className="car"
        role="region"
        aria-roledescription="carousel"
        aria-label="Marketplace highlights"
      >
        <div className="car-track">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`car-slide car-skeleton ${i === 0 ? 'on' : ''}`}
              role="group"
              aria-hidden="true"
            >
              <div className="car-skeleton-img" />
              <div className="car-skeleton-cap">
                <span className="car-skeleton-pill" />
                <div className="car-skeleton-title" />
                <div className="car-skeleton-sub" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ---------- Empty fallback ----------
  if (count === 0) {
    return (
      <div
        className="car"
        role="region"
        aria-roledescription="carousel"
        aria-label="Marketplace highlights"
      >
        <div
          className="car-slide on"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#fff',
          }}
        >
          <span className="small muted">No featured products yet</span>
        </div>
      </div>
    )
  }

  // ---------- Live slides ----------
  return (
    <div
      className="car"
      role="region"
      aria-roledescription="carousel"
      aria-label="Marketplace highlights"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <div className="car-track">
        {items.map((item, i) => (
          <div
            key={item.slug}
            className={`car-slide ${i === index ? 'on' : ''}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i === index ? undefined : true}
            onClick={(e) => handleSlideClick(item, e)}
            style={{ cursor: 'pointer' }}
          >
            {item.image_url && (
              <img
                className="car-img"
                src={item.image_url}
                alt={item.title}
                loading="lazy"
                decoding="async"
              />
            )}
            <div className="car-cap">
              <div className="car-pill-row">
                <span className="pill yellow">Top Seller</span>
                {item.sold_count > 0 && (
                  <span className="pill">{item.sold_count} sold</span>
                )}
                <span className="pill">
                  {item.is_official ? 'Official RTU Store' : 'Student seller'}
                </span>
              </div>
              <b
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {item.title}
              </b>
              <p className="small muted">
                {peso(item.price)} · {item.seller_name}
              </p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="car-nav prev"
        aria-label="Previous slide"
        onClick={(e) => {
          stop(e)
          go(index - 1)
        }}
      >
        <Icon name="chev" />
      </button>
      <button
        type="button"
        className="car-nav next"
        aria-label="Next slide"
        onClick={(e) => {
          stop(e)
          go(index + 1)
        }}
      >
        <Icon name="chev" />
      </button>

      <div className="car-bar">
        <div className="car-dots" role="group" aria-label="Choose a slide">
          {items.map((item, i) => (
            <button
              key={item.slug}
              type="button"
              className={`car-dot ${i === index ? 'on' : ''}`}
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={(e) => {
                stop(e)
                go(i)
              }}
            />
          ))}
        </div>
        <button
          type="button"
          className="car-pause"
          aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
          onClick={(e) => {
            stop(e)
            setPaused((p) => !p)
          }}
        >
          <svg className="ico sm" viewBox="0 0 24 24" aria-hidden="true">
            {paused ? <path d="m8 5 11 7-11 7z" /> : <path d="M8 5v14M16 5v14" />}
          </svg>
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {`Slide ${index + 1} of ${count}`}
      </p>
    </div>
  )
}
