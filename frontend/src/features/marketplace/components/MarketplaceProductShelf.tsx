import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { ProductCard } from './ProductCard'
import type { PrototypeProduct } from '../types'
import './MarketplaceProductShelf.css'

interface MarketplaceProductShelfProps {
  title: string
  subtitle: string
  items: PrototypeProduct[]
  viewMoreLabel?: string
  onViewMore?: () => void
  onEmptyAction?: () => void
  emptyActionLabel?: string
  emptyTitle?: string
  emptySubtitle?: string
}

/**
 * MARKETPLACE PRODUCT SHELF
 * Reusable 5-on-2 (10 visible) horizontally scrollable showcase grid.
 * Used by Latest Items, Best-Selling Items, and Student Services.
 */
export function MarketplaceProductShelf({
  title,
  subtitle,
  items,
  viewMoreLabel = 'View more',
  onViewMore,
  onEmptyAction,
  emptyActionLabel,
  emptyTitle,
  emptySubtitle,
}: MarketplaceProductShelfProps) {
  const shelfRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Distribute items into two rows for the marquee-style shelf.
  // Row 1 (top): items[0..4], then items[10], items[12], items[14], ...
  // Row 2 (bottom): items[5..9], then items[11], items[13], items[15], ...
  const buildRows = useCallback((list: PrototypeProduct[]) => {
    if (list.length <= 5) {
      return { rows: [list] as PrototypeProduct[][] }
    }
    const top: PrototypeProduct[] = list.slice(0, 5)
    const bottom: PrototypeProduct[] = list.slice(5, 10)
    for (let i = 10; i < list.length; i++) {
      if (i % 2 === 0) top.push(list[i])
      else bottom.push(list[i])
    }
    return { rows: [top, bottom] as PrototypeProduct[][] }
  }, [])

  const { rows } = buildRows(items)

  const scrollStep = useCallback((el: HTMLElement) => Math.round(el.clientWidth * 0.6), [])

  const updateScrollStates = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  const scrollShelf = useCallback((dir: -1 | 1) => {
    const el = viewportRef.current
    if (!el) return
    el.scrollBy({ left: dir * scrollStep(el), behavior: 'smooth' })
  }, [scrollStep])

  // Recalculate on mount, items changes, scroll, and resize (sidebar toggle, etc.)
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onScroll = () => updateScrollStates()
    const onResize = () => updateScrollStates()

    updateScrollStates()
    el.addEventListener('scroll', onScroll)
    window.addEventListener('resize', onResize)

    const ro = new ResizeObserver(() => updateScrollStates())
    ro.observe(el)
    if (shelfRef.current) ro.observe(shelfRef.current)

    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
    }
  }, [items.length, updateScrollStates])

  const hasItems = items.length > 0

  return (
    <div className="shelf-section" style={{ gap: 10, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'visible' }}>
      {/* Header */}
      <div className="shelf-header">
        <div className="shelf-header-left">
          <h2 style={{ fontSize: 18, margin: 0 }}>{title}</h2>
          <span className="small muted">{subtitle}</span>
        </div>
        {hasItems && onViewMore && (
          <button
            type="button"
            className="link shelf-view-more"
            onClick={onViewMore}
          >
            {viewMoreLabel}
          </button>
        )}
      </div>

      {hasItems ? (
        <>
          <div
            className="shelf-viewport"
            ref={viewportRef}
            style={{ overflowX: 'auto', overflowY: 'visible' }}
            aria-label={`${title}. Swipe left or right to browse more items.`}
          >
            <div
              className="shelf-track"
              ref={shelfRef}
            >
              {rows.map((row, rowIdx) => (
                <div
                  key={`shelf-row-${rowIdx}`}
                  className="shelf-row"
              >
                  {row.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Chevrons live OUTSIDE the scrollable track as direct children of shelf-section */}
          {canScrollLeft && (
            <button
              type="button"
              className="shelf-chev shelf-chev-left"
              aria-label={`Scroll ${title} left`}
              onClick={() => scrollShelf(-1)}
            >
              <Icon name="chev" size="sm" />
            </button>
          )}
          {canScrollRight && (
            <button
              type="button"
              className="shelf-chev shelf-chev-right"
              aria-label={`Scroll ${title} right`}
              onClick={() => scrollShelf(1)}
            >
              <Icon name="chev" size="sm" />
            </button>
          )}
        </>
      ) : (
        <div
          className="card stack"
          style={{ alignItems: 'center', textAlign: 'center', padding: 30 }}
        >
          <b>{emptyTitle || 'No items yet'}</b>
          <p className="small muted">{emptySubtitle}</p>
          {onEmptyAction && emptyActionLabel && (
            <button
              type="button"
              className="btn yellow"
              onClick={onEmptyAction}
            >
              {emptyActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
