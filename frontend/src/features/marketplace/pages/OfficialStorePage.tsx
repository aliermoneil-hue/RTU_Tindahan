import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { playHeart } from '@/common/sounds'
import { navigate } from '@/common/router/router'
import { MiniLoader } from '@/common/components/BrandLoader'
import { baoItemType } from '../baoHelpers'
import { useTindahan } from '../context/TindahanContext'
import { ProductCard } from '../components/ProductCard'
import { RatingText } from '../components/StarRating'
import './OfficialStorePage.css'

export function OfficialStorePage() {
  const {
    db,
    currentAccount,
    isStaffUser,
    allOnSale,
    sellerKind,
    toggleSellerFav,
    setDraft,
    setListStep,
    listingsLoading,
  } = useTindahan()
  const [storeTab, setStoreTab] = useState<string>('All')

  // Exclusively display products managed and sold by authorized RTU administrators
  const officialItems = allOnSale.filter(
    (p) => sellerKind(p) === 'school' && p.kind !== 'service',
  )

  // v1.6: tabs follow the active BAO item types from Store inventory > Item types, with live counts
  const dynamicTabs: Array<[string, string, number]> = [
    ['All', 'All official products', officialItems.length],
    ...db.bao.types
      .filter((t) => t.active)
      .map((t): [string, string, number] => {
        const label =
          t.name === 'Uniform'
            ? 'Uniforms'
            : t.name === 'Book'
              ? 'Books & manuals'
              : t.name === 'Merchandise'
                ? 'RTU merchandise'
                : t.name
        const count = officialItems.filter((p) => {
          const it = baoItemType(db.bao, p)
          return Boolean(it && it.id === t.id)
        }).length
        return [t.id, label, count]
      }),
  ]

  const activeTab = dynamicTabs.some((t) => t[0] === storeTab) ? storeTab : 'All'

  const list = officialItems.filter((p) => {
    if (activeTab === 'All') return true
    const it = baoItemType(db.bao, p)
    return Boolean(it && it.id === activeTab)
  })

  const sfav = Boolean(currentAccount?.sfavs?.includes('official'))

  return (
    <>
      {listingsLoading && (
        <div style={{ padding: 40, textAlign: 'center', minHeight: 400 }}>
          <MiniLoader variant="section" size="lg" label="Loading campus listings…" />
        </div>
      )}
      {!listingsLoading && (
        <>
          <div className="srchead school">
        <div className="stack" style={{ gap: 6, maxWidth: 'none' }}>
          <span className="pill yellow" style={{ alignSelf: 'flex-start' }}>
            <Icon name="shield" size="sm" />
            OFFICIAL RTU PASIG STORE
          </span>
          <h1 style={{ fontSize: 24 }}>Uniforms, books and campus merchandise</h1>
          <p className="small" style={{ opacity: 0.9 }}>
            Published and managed by RTU staff. Reserve online, then pay and claim at the Pasig
            Campus Store window with your student ID. Student listings are on the{' '}
            <button
              type="button"
              className="link"
              style={{ color: 'var(--yellow)' }}
              onClick={() => navigate('student-sellers')}
            >
              Student Sellers page
            </button>
            .
          </p>
          <div className="small" style={{ opacity: 0.95 }}>
            Store rating: <RatingText kind="seller" targetKey="official" />
          </div>
        </div>
        <div className="stack" style={{ gap: 8, alignItems: 'flex-end' }}>

          {currentAccount && (
            <button
              type="button"
              className={`btn ghost sm sfav ${sfav ? 'on' : ''}`.trim()}
              aria-pressed={sfav}
              onClick={() => {
                playHeart()
                toggleSellerFav('official')
              }}
            >
              <Icon name="heart" size="sm" />
              {sfav ? 'Favorite seller' : 'Add seller to favorites'}
            </button>
          )}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {dynamicTabs.map(([k, label, count]) => (
          <button
            key={k}
            type="button"
            className={`tab ${activeTab === k ? 'on' : ''}`.trim()}
            role="tab"
            aria-selected={activeTab === k}
            onClick={() => setStoreTab(k)}
          >
            {label} <span className="tnum muted">({count})</span>
          </button>
        ))}
      </div>

      {list.length ? (
        <div className="pgrid">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div
          className="card stack"
          style={{ alignItems: 'center', textAlign: 'center', padding: 40 }}
        >
          <span style={{ color: 'var(--blue)' }}>
            <Icon name="store" />
          </span>
          <b>
            {officialItems.length ? 'Nothing in this section yet' : 'No official products yet'}
          </b>
          <p className="small muted" style={{ maxWidth: '48ch' }}>
            {officialItems.length
              ? 'Choose another tab above.'
              : 'RTU staff publish uniforms, manuals and merchandise from Sell an item and manage them in Admin | RTU Shop.'}
          </p>
          {isStaffUser && (
            <div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
              <button
                type="button"
                className="btn yellow"
                onClick={() => {
                  setDraft((prev) => (prev.editLid ? prev : { ...prev, type: 'product' }))
                  setListStep(1)
                  navigate('create')
                }}
              >
                <Icon name="plus" size="sm" />
                Admin | Sell an Item
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => navigate('shop')}
              >
                Admin | RTU Shop
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid2">
        <div className="card stack" style={{ gap: 6 }}>
          <b>Sizes</b>
          <p className="small muted">
            Uniforms and PE shirts follow the campus store size chart (S, M, L, XL). Try the
            sample rack at the window before you pay.
          </p>
        </div>
        <div className="card stack" style={{ gap: 6 }}>
          <b>Claiming at the store window</b>
          <p className="small muted">
            Show your order number and RTU ID at the window. Unclaimed reservations are released
            after two school days so other students can reserve them.
          </p>
        </div>
      </div>
      </>)}
    </>
  )
}
