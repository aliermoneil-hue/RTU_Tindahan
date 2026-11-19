import { useMemo } from 'react'
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
    toast,
    listingsLoading,
  } = useTindahan()

  // Optional URL query sync
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

  const perPage = 8
  const pages = Math.max(1, Math.ceil(filteredList.length / perPage))
  const currentPage = Math.min(browseState.page, pages)
  const slice = filteredList.slice((currentPage - 1) * perPage, currentPage * perPage)

  const stOn = browseState.sellerType.includes('Student sellers')
  const scOn = browseState.sellerType.includes('Official store')
  const curSellerTab = stOn && !scOn ? 'student' : scOn && !stOn ? 'school' : 'all'

  const isAllQuick =
    !browseState.cats.length &&
    !browseState.onlyToday &&
    !browseState.maxPrice &&
    !browseState.sellerType.length &&
    !browseState.tag &&
    !browseState.sub
  const isOfficialQuick =
    browseState.sellerType.includes('Official store') && browseState.sellerType.length === 1
  const isServicesQuick =
    browseState.cats.includes(SERVICES_CAT) && browseState.cats.length === 1

  const showRateBasis =
    browseState.sortBy === 'Top-Rated' || browseState.sortBy === 'Lowest-Rated'
  const cardRateBasis: 'item' | 'seller' =
    showRateBasis && browseState.rateBasis === 'seller' ? 'seller' : 'item'

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
              <h1>Browse campus listings</h1>
          <p className="muted small">
            Every item here is picked up in person inside Pasig Campus.
          </p>
        </div>
        <div className="row wrap">
          <span className="small muted">Sort</span>
          <select
            className="input"
            aria-label="Sort listings"
            style={{ width: 'auto' }}
            value={browseState.sortBy}
            onChange={(e) =>
              setBrowseState((prev) => ({ ...prev, sortBy: e.target.value, page: 1 }))
            }
          >
            {SORT_MODES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {showRateBasis && (
            <>
              <span className="small muted">Based on</span>
              <select
                className="input"
                aria-label="Rating basis"
                style={{ width: 'auto' }}
                value={browseState.rateBasis}
                onChange={(e) =>
                  setBrowseState((prev) => ({
                    ...prev,
                    rateBasis: e.target.value as 'item' | 'seller',
                    page: 1,
                  }))
                }
              >
                <option value="item">Item rating</option>
                <option value="seller">Seller rating</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* Seller type tabs (sellerTabs in js/9-forum-sellers.js) */}
      <div className="tabs" role="tablist" aria-label="Seller type">
        {(
          [
            ['all', 'All sellers', countsBySeller.all],
            ['student', 'Student Sellers', countsBySeller.student],
            ['school', 'Official RTU Store', countsBySeller.school],
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

      {/* Quick filter chips */}
      <div className="row wrap">
        <button
          type="button"
          className={`btn ${isAllQuick ? '' : 'ghost'} sm`.trim()}
          onClick={() => clearBrowseFilters()}
        >
          All
        </button>
        <button
          type="button"
          className={`btn ${browseState.onlyToday ? '' : 'ghost'} sm`.trim()}
          onClick={() =>
            setBrowseState((prev) => ({ ...prev, onlyToday: !prev.onlyToday, page: 1 }))
          }
        >
          Ready today
        </button>
        <button
          type="button"
          className={`btn ${browseState.maxPrice === '300' ? '' : 'ghost'} sm`.trim()}
          onClick={() =>
            setBrowseState((prev) => ({
              ...prev,
              maxPrice: prev.maxPrice === '300' ? '' : '300',
              page: 1,
            }))
          }
        >
          Under ₱300
        </button>
        <button
          type="button"
          className={`btn ${isServicesQuick ? '' : 'ghost'} sm`.trim()}
          onClick={() =>
            setBrowseState((prev) => ({
              ...prev,
              cats: isServicesQuick ? [] : [SERVICES_CAT],
              sub: '',
              page: 1,
            }))
          }
        >
          Services
        </button>
        <button
          type="button"
          className={`btn ${isOfficialQuick ? '' : 'ghost'} sm`.trim()}
          onClick={() =>
            setBrowseState((prev) => ({
              ...prev,
              sellerType: isOfficialQuick ? [] : ['Official store'],
              page: 1,
            }))
          }
        >
          Official
        </button>
        <button type="button" className="btn ghost sm" onClick={() => clearBrowseFilters()}>
          Clear all
        </button>
        <button
          type="button"
          className={`btn ${browseState.mapFree ? '' : 'ghost'} sm`.trim()}
          style={{ marginLeft: 'auto' }}
          aria-pressed={browseState.mapFree}
          onClick={() => {
            const next = !browseState.mapFree
            setBrowseState((prev) => ({ ...prev, mapFree: next, page: 1 }))
            toast(
              next
                ? 'Showing pickups at the lobby, library, canteen and campus store.'
                : 'Showing every pickup spot.',
            )
          }}
        >
          <Icon name="pin" size="sm" />
          Map-free pickup
        </button>
      </div>

      {/* Main two-column browse layout */}
      <div className="bgrid">
        <aside className="card stack">
          <b>Category</b>
          {allCats.map((c) => {
            const checked = browseState.cats.includes(c)
            const count = allOnSale.filter((p) => catOf(p) === c).length
            return (
              <label key={c} className="check">
                <input
                  type="checkbox"
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
      </>)}
    </>
  )
}
