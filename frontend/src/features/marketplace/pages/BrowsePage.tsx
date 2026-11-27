import { useMemo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/common/components/Icon'
import { navigate, useRoute } from '@/common/router/router'
import { MiniLoader } from '@/common/components/BrandLoader'
import {
  BROWSE_CATS,
  SERVICES_CAT,
  SORT_MODES,
  SUBCATS,
  catOf,
  subOf,
} from '../constants'
import { useTindahan } from '../context/TindahanContext'
import { ProductCard } from '../components/ProductCard'
import './BrowsePage.css'

export function BrowsePage() {
  const { params } = useRoute()
  const {
    allOnSale,
    browseState,
    setBrowseState,
    clearBrowseFilters,
    sellerKind,
    sortProducts,
    listingsLoading,
  } = useTindahan()

  // Optional URL query sync
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const chipTrackRef = useRef<HTMLDivElement>(null)
  const sortWrapRef = useRef<HTMLDivElement>(null)
  const setWidthRef = useRef<number>(0)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  const urlQ = params.get('q')
  const activeQ = browseState.q || urlQ || ''

  const allCats = BROWSE_CATS
  const singleCat = browseState.cats.length === 1 ? browseState.cats[0] : ''
  const subsForCat = singleCat && SUBCATS[singleCat] ? SUBCATS[singleCat] : []

  const countsBySeller = useMemo(() => {
    return {
      all: allOnSale.length,
      student: allOnSale.filter((p) => sellerKind(p) === 'student').length,
      school: allOnSale.filter((p) => sellerKind(p) === 'school').length,
    }
  }, [allOnSale, sellerKind])

  const filteredList = useMemo(() => {
    const q = activeQ.trim().toLowerCase()
    const base = allOnSale.filter((p) => {
      const sk = sellerKind(p)
      const c = catOf(p)
      if (browseState.cats.length && !browseState.cats.includes(c)) return false
      if (browseState.sub && subOf(p) !== browseState.sub) return false
      if (browseState.tag && p.tag !== browseState.tag) return false
      if (browseState.sellerType.length) {
        const label = sk === 'school' ? 'Official store' : 'Student sellers'
        if (!browseState.sellerType.includes(label)) return false
      }
      if (browseState.maxPrice && p.price > Number(browseState.maxPrice)) return false
      if (browseState.onlyToday && p.left < 1) return false
      if (
        browseState.mapFree &&
        !/^(Main lobby|Library|Canteen|Campus store)/i.test(p.when || '')
      ) {
        return false
      }
      if (
        q &&
        !(
          p.name +
          ' ' +
          p.seller +
          ' ' +
          c +
          ' ' +
          (subOf(p) || '') +
          ' ' +
          p.tag +
          ' ' +
          (p.svcType || '')
        )
          .toLowerCase()
          .includes(q)
      ) {
        return false
      }
      return true
    })
    return sortProducts(base, browseState.sortBy, browseState.rateBasis)
  }, [allOnSale, activeQ, browseState, sellerKind, sortProducts])

  const perPage = isMobile ? 20 : 50
  const pages = Math.max(1, Math.ceil(filteredList.length / perPage))
  const currentPage = Math.min(browseState.page, pages)
  const slice = filteredList.slice((currentPage - 1) * perPage, currentPage * perPage)

  const stOn = browseState.sellerType.includes('Student sellers')
  const scOn = browseState.sellerType.includes('Official store')
  const curSellerTab = stOn && !scOn ? 'student' : scOn && !stOn ? 'school' : 'all'

  const QUICK_CHOICES = [
    {
      label: 'Uniforms',
      icon: 'shirt' as const,
      onClick: () =>
        setBrowseState((prev) => {
          const alreadyActive =
            prev.tag === 'Uniform' &&
            !prev.cats.length &&
            !prev.onlyToday &&
            !prev.maxPrice
          if (alreadyActive) {
            return { ...prev, cats: [], sub: '', tag: '', onlyToday: false, maxPrice: '', page: 1 }
          }
          return {
            ...prev,
            cats: [],
            sub: '',
            tag: 'Uniform',
            onlyToday: false,
            maxPrice: '',
            page: 1,
          }
        }),
      active:
        browseState.tag === 'Uniform' &&
        !browseState.cats.length &&
        !browseState.onlyToday &&
        !browseState.maxPrice,
    },
    {
      label: 'Clothing',
      icon: 'shirt' as const,
      onClick: () =>
        setBrowseState((prev) => {
          const alreadyActive =
            prev.cats.length === 1 &&
            prev.cats[0] === 'Clothing and Accessories' &&
            !prev.tag &&
            !prev.onlyToday &&
            !prev.maxPrice
          if (alreadyActive) {
            return { ...prev, cats: [], sub: '', tag: '', onlyToday: false, maxPrice: '', page: 1 }
          }
          return {
            ...prev,
            cats: ['Clothing and Accessories'],
            sub: '',
            tag: '',
            onlyToday: false,
            maxPrice: '',
            page: 1,
          }
        }),
      active:
        browseState.cats.length === 1 &&
        browseState.cats[0] === 'Clothing and Accessories' &&
        !browseState.tag &&
        !browseState.onlyToday &&
        !browseState.maxPrice,
    },
    {
      label: 'Books',
      icon: 'book' as const,
      onClick: () =>
        setBrowseState((prev) => {
          const alreadyActive =
            prev.cats.length === 1 &&
            prev.cats[0] === 'Books and Academic Materials' &&
            !prev.tag &&
            !prev.onlyToday &&
            !prev.maxPrice
          if (alreadyActive) {
            return { ...prev, cats: [], sub: '', tag: '', onlyToday: false, maxPrice: '', page: 1 }
          }
          return {
            ...prev,
            cats: ['Books and Academic Materials'],
            sub: '',
            tag: '',
            onlyToday: false,
            maxPrice: '',
            page: 1,
          }
        }),
      active:
        browseState.cats.length === 1 &&
        browseState.cats[0] === 'Books and Academic Materials' &&
        !browseState.tag &&
        !browseState.onlyToday &&
        !browseState.maxPrice,
    },
    {
      label: 'School Supplies',
      icon: 'note' as const,
      onClick: () =>
        setBrowseState((prev) => {
          const alreadyActive =
            prev.cats.length === 1 &&
            prev.cats[0] === 'School Supplies' &&
            !prev.tag &&
            !prev.onlyToday &&
            !prev.maxPrice
          if (alreadyActive) {
            return { ...prev, cats: [], sub: '', tag: '', onlyToday: false, maxPrice: '', page: 1 }
          }
          return {
            ...prev,
            cats: ['School Supplies'],
            sub: '',
            tag: '',
            onlyToday: false,
            maxPrice: '',
            page: 1,
          }
        }),
      active:
        browseState.cats.length === 1 &&
        browseState.cats[0] === 'School Supplies' &&
        !browseState.tag &&
        !browseState.onlyToday &&
        !browseState.maxPrice,
    },
    {
      label: 'Food & Snacks',
      icon: 'bowl' as const,
      onClick: () =>
        setBrowseState((prev) => {
          const alreadyActive =
            prev.cats.length === 1 &&
            prev.cats[0] === 'Food and Snacks' &&
            !prev.tag &&
            !prev.onlyToday &&
            !prev.maxPrice
          if (alreadyActive) {
            return { ...prev, cats: [], sub: '', tag: '', onlyToday: false, maxPrice: '', page: 1 }
          }
          return {
            ...prev,
            cats: ['Food and Snacks'],
            sub: '',
            tag: '',
            onlyToday: false,
            maxPrice: '',
            page: 1,
          }
        }),
      active:
        browseState.cats.length === 1 &&
        browseState.cats[0] === 'Food and Snacks' &&
        !browseState.tag &&
        !browseState.onlyToday &&
        !browseState.maxPrice,
    },
    {
      label: 'Electronics',
      icon: 'calc' as const,
      onClick: () =>
        setBrowseState((prev) => {
          const alreadyActive =
            prev.cats.length === 1 &&
            prev.cats[0] === 'Electronics and Gadgets' &&
            !prev.tag &&
            !prev.onlyToday &&
            !prev.maxPrice
          if (alreadyActive) {
            return { ...prev, cats: [], sub: '', tag: '', onlyToday: false, maxPrice: '', page: 1 }
          }
          return {
            ...prev,
            cats: ['Electronics and Gadgets'],
            sub: '',
            tag: '',
            onlyToday: false,
            maxPrice: '',
            page: 1,
          }
        }),
      active:
        browseState.cats.length === 1 &&
        browseState.cats[0] === 'Electronics and Gadgets' &&
        !browseState.tag &&
        !browseState.onlyToday &&
        !browseState.maxPrice,
    },
    {
      label: 'RTU Merch',
      icon: 'store' as const,
      onClick: () =>
        setBrowseState((prev) => {
          const alreadyActive =
            prev.cats.length === 1 &&
            prev.cats[0] === 'RTU Merchandise' &&
            !prev.tag &&
            !prev.onlyToday &&
            !prev.maxPrice
          if (alreadyActive) {
            return { ...prev, cats: [], sub: '', tag: '', onlyToday: false, maxPrice: '', page: 1 }
          }
          return {
            ...prev,
            cats: ['RTU Merchandise'],
            sub: '',
            tag: '',
            onlyToday: false,
            maxPrice: '',
            page: 1,
          }
        }),
      active:
        browseState.cats.length === 1 &&
        browseState.cats[0] === 'RTU Merchandise' &&
        !browseState.tag &&
        !browseState.onlyToday &&
        !browseState.maxPrice,
    },
    {
      label: 'Services',
      icon: 'spark' as const,
      onClick: () =>
        setBrowseState((prev) => {
          const alreadyActive =
            prev.cats.length === 1 &&
            prev.cats[0] === SERVICES_CAT &&
            !prev.tag &&
            !prev.onlyToday &&
            !prev.maxPrice
          if (alreadyActive) {
            return { ...prev, cats: [], sub: '', tag: '', onlyToday: false, maxPrice: '', page: 1 }
          }
          return {
            ...prev,
            cats: [SERVICES_CAT],
            sub: '',
            tag: '',
            onlyToday: false,
            maxPrice: '',
            page: 1,
          }
        }),
      active:
        browseState.cats.length === 1 &&
        browseState.cats[0] === SERVICES_CAT &&
        !browseState.tag &&
        !browseState.onlyToday &&
        !browseState.maxPrice,
    },
    {
      label: 'Ready today',
      icon: 'clock' as const,
      onClick: () =>
        setBrowseState((prev) => {
          const alreadyActive =
            prev.onlyToday &&
            !prev.cats.length &&
            !prev.tag &&
            !prev.maxPrice
          if (alreadyActive) {
            return { ...prev, cats: [], sub: '', tag: '', onlyToday: false, maxPrice: '', page: 1 }
          }
          return {
            ...prev,
            cats: [],
            sub: '',
            tag: '',
            onlyToday: true,
            maxPrice: '',
            page: 1,
          }
        }),
      active:
        browseState.onlyToday &&
        !browseState.cats.length &&
        !browseState.tag &&
        !browseState.maxPrice,
    },
    {
      label: 'Under ₱300',
      icon: 'tag' as const,
      onClick: () =>
        setBrowseState((prev) => {
          const alreadyActive =
            prev.maxPrice === '300' &&
            !prev.cats.length &&
            !prev.tag &&
            !prev.onlyToday
          if (alreadyActive) {
            return { ...prev, cats: [], sub: '', tag: '', onlyToday: false, maxPrice: '', page: 1 }
          }
          return {
            ...prev,
            cats: [],
            sub: '',
            tag: '',
            onlyToday: false,
            maxPrice: '300',
            page: 1,
          }
        }),
      active:
        browseState.maxPrice === '300' &&
        !browseState.cats.length &&
        !browseState.tag &&
        !browseState.onlyToday,
    },
    {
      label: 'Under ₱100',
      icon: 'tag' as const,
      onClick: () =>
        setBrowseState((prev) => {
          const alreadyActive =
            prev.maxPrice === '100' &&
            !prev.cats.length &&
            !prev.tag &&
            !prev.onlyToday
          if (alreadyActive) {
            return { ...prev, cats: [], sub: '', tag: '', onlyToday: false, maxPrice: '', page: 1 }
          }
          return {
            ...prev,
            cats: [],
            sub: '',
            tag: '',
            onlyToday: false,
            maxPrice: '100',
            page: 1,
          }
        }),
      active:
        browseState.maxPrice === '100' &&
        !browseState.cats.length &&
        !browseState.tag &&
        !browseState.onlyToday,
    }
  ]

  const showRateBasis =
    browseState.sortBy === 'Top-Rated' || browseState.sortBy === 'Lowest-Rated'
  const cardRateBasis: 'item' | 'seller' =
    showRateBasis && browseState.rateBasis === 'seller' ? 'seller' : 'item'

  /** True when any filter (category, sub, tag, seller type, price, today, map-free, search) is active. */
  const hasActiveFilters =
    browseState.cats.length > 0 ||
    browseState.sub !== '' ||
    browseState.tag !== '' ||
    browseState.sellerType.length > 0 ||
    browseState.maxPrice !== '' ||
    browseState.onlyToday === true ||
    browseState.mapFree === true ||
    activeQ !== ''

  const activeFilterCount = () => {
    let n = 0
    n += browseState.cats.length
    n += browseState.sub ? 1 : 0
    n += browseState.tag ? 1 : 0
    n += browseState.sellerType.length
    n += browseState.maxPrice ? 1 : 0
    n += browseState.onlyToday ? 1 : 0
    n += browseState.mapFree ? 1 : 0
    n += activeQ ? 1 : 0
    return n
  }

  // Lock body scroll while mobile filter sheet is open
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterSheetOpen(false)
    }

    const shouldLock = filterSheetOpen && isMobile
    document.documentElement.classList.toggle('filter-sheet-open', shouldLock)
    document.body.classList.toggle('filter-sheet-open', shouldLock)

    if (shouldLock) {
      window.addEventListener('keydown', handleKeydown)
    } else {
      window.removeEventListener('keydown', handleKeydown)
    }
    return () => {
      document.documentElement.classList.remove('filter-sheet-open')
      document.body.classList.remove('filter-sheet-open')
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [filterSheetOpen, isMobile])

  // Close sort dropdown on outside click or Escape key
  useEffect(() => {
    if (!sortOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (sortWrapRef.current && !sortWrapRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSortOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [sortOpen])

  // Infinite chip carousel: start at middle copy, wrap on scroll boundaries
  useEffect(() => {
    const el = chipTrackRef.current
    if (listingsLoading || !el) return
    const ro = new ResizeObserver(() => {
      setWidthRef.current = el.scrollWidth / 3
      el.scrollLeft = setWidthRef.current
    })
    ro.observe(el)
    setWidthRef.current = el.scrollWidth / 3
    el.scrollLeft = setWidthRef.current
    return () => ro.disconnect()
  }, [listingsLoading])

  const handleChipScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const sw = setWidthRef.current
    if (!sw) return
    if (el.scrollLeft <= 2) el.scrollLeft += sw
    else if (el.scrollLeft >= sw * 2 - 2) el.scrollLeft -= sw
  }

  const scrollChip = (dir: -1 | 1) => {
    const el = chipTrackRef.current
    if (!el) return
    const step = Math.round(el.clientWidth * 0.55)
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <>
      {listingsLoading && (
        <div style={{ padding: 40, textAlign: 'center', minHeight: 400 }}>
          <MiniLoader variant="section" size="lg" label="Loading campus listings…" />
        </div>
      )}
      {!listingsLoading && (
        <>
          <div className="browse-header">
            <div>
              <h1>Browse campus listings</h1>
              <p className="muted small">
                Every item here is picked up in person inside Pasig Campus.
              </p>
            </div>
            {/* Mobile (< 768px): Filters + Sort on one 50/50 row */}
            <div className="browse-controls">
              <span className="small muted browse-sort-label">Sort</span>
              <button
                type="button"
                className="browse-filters-btn"
                onClick={() => {
                  setFilterSheetOpen(true)
                }}
              >
                <Icon name="tag" />
                Filters
                {hasActiveFilters && <span className="badge-pill">{activeFilterCount()}</span>}
              </button>
              <div className="browse-sort-wrap" ref={sortWrapRef}>
                <button
                  type="button"
                  className={`browse-sort-trigger ${sortOpen ? 'open' : ''}`.trim()}
                  aria-haspopup="listbox"
                  aria-expanded={sortOpen}
                  aria-label="Sort listings"
                  onClick={() => setSortOpen((prev) => !prev)}
                >
                  <span className="browse-sort-value">{browseState.sortBy}</span>
                  <Icon className="browse-sort-chev" name="chev" size="sm" />
                </button>
                <div
                  className={`browse-sort-menu ${sortOpen ? 'open' : ''}`.trim()}
                  role="listbox"
                  aria-label="Sort options"
                  aria-hidden={!sortOpen}
                >
                  {SORT_MODES.map((o) => {
                    const selected = browseState.sortBy === o
                    return (
                      <button
                        key={o}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        tabIndex={sortOpen ? 0 : -1}
                        className={`browse-sort-opt ${selected ? 'on' : ''}`.trim()}
                        onClick={() => {
                          setBrowseState((prev) => ({ ...prev, sortBy: o, page: 1 }))
                          setSortOpen(false)
                        }}
                      >
                        <span>{o}</span>
                        {selected && <Icon className="browse-sort-check" name="check" size="sm" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

      {/* Seller type tabs — single non-wrapping row on mobile */}
      <div
        className={`tabs mobile-seller-tabs`}
        role="tablist"
        aria-label="Seller type"
      >
        {(
          [
            ['all', 'All', countsBySeller.all],
            ['student', 'Students', countsBySeller.student],
            ['school', 'RTU Store', countsBySeller.school],
          ] as const
        ).map((t) => (
          <button
            key={t[0]}
            type="button"
            className={`tab ${curSellerTab === t[0] ? 'on' : ''}`.trim()}
            role="tab"
            aria-selected={curSellerTab === t[0]}
            onClick={() =>
              setBrowseState((prev) => ({
                ...prev,
                sellerType:
                  t[0] === 'student'
                    ? ['Student sellers']
                    : t[0] === 'school'
                      ? ['Official store']
                      : [],
                page: 1,
              }))
            }
          >
            {t[1]} <span className="tnum">({t[2]})</span>
          </button>
        ))}
      </div>

      {/* Infinite chip carousel (replaces .browse-quick-strip) */}
      <div className="browse-chip-wrap">
        <button
          type="button"
          className="browse-chip-arrow l"
          aria-label="Scroll choices left"
          onClick={() => scrollChip(-1)}
        >
          <Icon name="chev" size="sm" />
        </button>
        <div
          ref={chipTrackRef}
          className="browse-chip-row"
          onScroll={handleChipScroll}
          aria-label="Quick filter choices, scroll sideways for more"
        >
          {[0, 1, 2].flatMap((copyIdx) =>
            QUICK_CHOICES.map((c) => (
              <button
                key={`${copyIdx}-${c.label}`}
                type="button"
                className={`browse-chip ${c.active ? 'on' : ''}`.trim()}
                aria-hidden={copyIdx !== 1 ? true : undefined}
                tabIndex={copyIdx === 1 ? 0 : -1}
                onClick={() => c.onClick()}
              >
                <span className="catico">
                  <Icon name={c.icon} size="sm" />
                </span>
                {c.label}
              </button>
            ))
          )}
        </div>
        <button
          type="button"
          className="browse-chip-arrow r"
          aria-label="Scroll choices right"
          onClick={() => scrollChip(1)}
        >
          <Icon name="chev" size="sm" />
        </button>
      </div>

      {/* Main two-column browse layout */}
      <div className="bgrid">
        {/* Inline filter sidebar — hidden on mobile (< 768px), use bottom sheet instead */}
        <aside className="card stack">
            <b>Category</b>
            {allCats.map((c) => {
              const checked = browseState.cats.includes(c)
              const count = allOnSale.filter((p) => catOf(p) === c).length
              return (
                <label key={c} className="check">
                  <input
                    type="checkbox"
                    className="browse-check-input"
                    checked={checked}
                    onChange={(e) => {
                      const isChecked = e.target.checked
                      setBrowseState((prev) => {
                        const nextCats = isChecked
                          ? [...prev.cats, c]
                          : prev.cats.filter((x) => x !== c)
                        const nextSingle = nextCats.length === 1 ? nextCats[0] : ''
                        const nextSub =
                          prev.sub &&
                          nextSingle &&
                          (SUBCATS[nextSingle] || []).includes(prev.sub)
                            ? prev.sub
                            : ''
                        return { ...prev, cats: nextCats, sub: nextSub, page: 1 }
                      })
                    }}
                  />
                  {c}{' '}
                  <span className="muted tiny" style={{ marginLeft: 'auto' }}>
                    {count}
                  </span>
                </label>
              )
            })}

            {subsForCat.length > 0 && (
              <div
                className="stack"
                style={{ gap: 6, borderTop: '1px solid var(--line)', paddingTop: 10 }}
              >
                <b className="small">Subcategory</b>
                <div className="row wrap" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className={`btn sm ${!browseState.sub ? '' : 'ghost'}`.trim()}
                    onClick={() => setBrowseState((prev) => ({ ...prev, sub: '', page: 1 }))}
                  >
                    All
                  </button>
                  {subsForCat.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`btn sm ${browseState.sub === s ? '' : 'ghost'}`.trim()}
                      onClick={() =>
                        setBrowseState((prev) => ({
                          ...prev,
                          sub: prev.sub === s ? '' : s,
                          page: 1,
                        }))
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <b style={{ marginTop: 6 }}>Seller type</b>
            {(['Student sellers', 'Official store'] as const).map((t) => {
              const checked = browseState.sellerType.includes(t)
              return (
                <label key={t} className="check">
                  <input
                    type="checkbox"
                    className="browse-check-input"
                    checked={checked}
                    onChange={(e) => {
                      const isChecked = e.target.checked
                      setBrowseState((prev) => ({
                        ...prev,
                        sellerType: isChecked
                          ? [...prev.sellerType, t]
                          : prev.sellerType.filter((x) => x !== t),
                        page: 1,
                      }))
                    }}
                  />
                  {t}
                </label>
              )
            })}

            <div className="field" style={{ marginTop: 6 }}>
              <label htmlFor="maxp">Max price (₱)</label>
              <input
                className="input tnum"
                id="maxp"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Any"
                value={browseState.maxPrice}
                onChange={(e) =>
                  setBrowseState((prev) => ({ ...prev, maxPrice: e.target.value, page: 1 }))
                }
              />
            </div>

            <label className="check">
              <input
                type="checkbox"
                className="browse-check-input"
                checked={browseState.onlyToday}
                onChange={(e) =>
                  setBrowseState((prev) => ({ ...prev, onlyToday: e.target.checked, page: 1 }))
                }
              />
              Available today
            </label>
          </aside>

        <div className="stack">
          <div className="row between wrap">
            <span className="small muted">
              Showing <b className="tnum">{filteredList.length}</b> listing
              {filteredList.length === 1 ? '' : 's'}
              {activeQ ? ` for “${activeQ}”` : ''}
            </span>
            <div className="row wrap">
              {browseState.cats.map((c) => (
                <span key={c} className="pill">
                  {c}{' '}
                  <button
                    type="button"
                    aria-label={`Remove ${c}`}
                    style={{ background: 'none', border: 0, padding: 0 }}
                    onClick={() =>
                      setBrowseState((prev) => ({
                        ...prev,
                        cats: prev.cats.filter((x) => x !== c),
                        sub: '',
                        page: 1,
                      }))
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
              {browseState.sub && (
                <span className="pill">
                  {browseState.sub}{' '}
                  <button
                    type="button"
                    aria-label={`Remove ${browseState.sub}`}
                    style={{ background: 'none', border: 0, padding: 0 }}
                    onClick={() => setBrowseState((prev) => ({ ...prev, sub: '', page: 1 }))}
                  >
                    ×
                  </button>
                </span>
              )}
              {browseState.tag && (
                <span className="pill">
                  {browseState.tag}{' '}
                  <button
                    type="button"
                    aria-label={`Remove ${browseState.tag}`}
                    style={{ background: 'none', border: 0, padding: 0 }}
                    onClick={() => setBrowseState((prev) => ({ ...prev, tag: '', page: 1 }))}
                  >
                    ×
                  </button>
                </span>
              )}
              {activeQ && (
                <span className="pill">
                  “{activeQ}”{' '}
                  <button
                    type="button"
                    aria-label="Clear search"
                    style={{ background: 'none', border: 0, padding: 0 }}
                    onClick={() => {
                      setBrowseState((prev) => ({ ...prev, q: '', page: 1 }))
                      if (urlQ) navigate('browse')
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>

          {slice.length ? (
            <div className="pgrid">
              {slice.map((p) => (
                <ProductCard key={p.id} product={p} rateBasis={cardRateBasis} />
              ))}
            </div>
          ) : (
            <div
              className="card stack"
              style={{ alignItems: 'center', textAlign: 'center', padding: 40 }}
            >
              <span style={{ color: 'var(--blue)' }}>
                <Icon name="search" />
              </span>
              <b>
                {allOnSale.length ? 'No listings match your filters' : 'No listings yet'}
              </b>
              <p className="small muted">
                {allOnSale.length
                  ? 'Clear a filter or try a broader search word.'
                  : 'Approved student listings and official store products will appear here.'}
              </p>
              {allOnSale.length ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => clearBrowseFilters()}
                >
                  Clear all filters
                </button>
              ) : (
                <button
                  type="button"
                  className="btn yellow"
                  onClick={() => navigate('create')}
                >
                  Sell an item
                </button>
              )}
            </div>
          )}

          {pages > 1 && (
            <div className="row" style={{ justifyContent: 'center' }}>
              {Array.from({ length: pages }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  type="button"
                  className={`btn sm ${currentPage === pg ? '' : 'ghost'} tnum`.trim()}
                  onClick={() => setBrowseState((prev) => ({ ...prev, page: pg }))}
                >
                  {pg}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet filter drawer — portaled, always mounted on mobile */}
      {isMobile && (
        <>
          {createPortal(
            <div
              className={`mobile-filter-backdrop${filterSheetOpen ? ' is-open' : ''}`}
              onClick={() => setFilterSheetOpen(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setFilterSheetOpen(false)
              }}
              aria-hidden={!filterSheetOpen}
            />,
            document.body
          )}
          {createPortal(
            <div
              className={`mobile-filter-sheet-content${filterSheetOpen ? ' is-open' : ''}`}
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              aria-hidden={!filterSheetOpen}
            >
              <div className="mobile-filter-sheet-header">
                <h2>Filters</h2>
                <div className="row between">
                  <button
                    type="button"
                    className="mobile-filter-close"
                    aria-label="Close filters"
                    onClick={() => setFilterSheetOpen(false)}
                  >
                    <Icon name="x" size="sm" />
                  </button>
                </div>
              </div>

              <div className="mobile-filter-sheet-body stack">
                <div className="mobile-filter-section">
                  <b>Category</b>
                  {allCats.map((c) => {
                    const checked = browseState.cats.includes(c)
                    const count = allOnSale.filter((p) => catOf(p) === c).length
                    return (
                      <label key={c} className="check">
                        <input
                          type="checkbox"
                          className="browse-check-input"
                          checked={checked}
                          onChange={(e) => {
                            const isChecked = e.target.checked
                            setBrowseState((prev) => {
                              const nextCats = isChecked
                                ? [...prev.cats, c]
                                : prev.cats.filter((x) => x !== c)
                              const nextSingle = nextCats.length === 1 ? nextCats[0] : ''
                              const nextSub =
                                prev.sub &&
                                nextSingle &&
                                (SUBCATS[nextSingle] || []).includes(prev.sub)
                                  ? prev.sub
                                  : ''
                              return { ...prev, cats: nextCats, sub: nextSub, page: 1 }
                            })
                          }}
                        />
                        {c}{' '}
                        <span className="muted tiny" style={{ marginLeft: 'auto' }}>
                          {count}
                        </span>
                      </label>
                    )
                  })}

                  {subsForCat.length > 0 && (
                    <div
                      className="stack"
                      style={{ gap: 6, borderTop: '1px solid var(--line)', paddingTop: 10 }}
                    >
                      <b className="small">Subcategory</b>
                      <div className="row wrap" style={{ gap: 6 }}>
                        <button
                          type="button"
                          className={`btn sm ${!browseState.sub ? '' : 'ghost'}`.trim()}
                          onClick={() => setBrowseState((prev) => ({ ...prev, sub: '', page: 1 }))}
                        >
                          All
                        </button>
                        {subsForCat.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={`btn sm ${browseState.sub === s ? '' : 'ghost'}`.trim()}
                            onClick={() =>
                              setBrowseState((prev) => ({
                                ...prev,
                                sub: prev.sub === s ? '' : s,
                                page: 1,
                              }))
                            }
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <b style={{ marginTop: 14 }}>Seller type</b>
                  {(['Student sellers', 'Official store'] as const).map((t) => {
                    const checked = browseState.sellerType.includes(t)
                    return (
                      <label key={t} className="check">
                        <input
                          type="checkbox"
                          className="browse-check-input"
                          checked={checked}
                          onChange={(e) => {
                            const isChecked = e.target.checked
                            setBrowseState((prev) => ({
                              ...prev,
                              sellerType: isChecked
                                ? [...prev.sellerType, t]
                                : prev.sellerType.filter((x) => x !== t),
                              page: 1,
                            }))
                          }}
                        />
                        {t}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="mobile-filter-sheet-footer">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    clearBrowseFilters()
                    setFilterSheetOpen(false)
                  }}
                >
                  Clear all
                </button>
                <button
                  type="button"
                  className="btn yellow"
                  onClick={() => setFilterSheetOpen(false)}
                >
                  Show results
                </button>
              </div>
            </div>,
          document.body
        )}
    </>)}
    </>)}
    </>)
}
