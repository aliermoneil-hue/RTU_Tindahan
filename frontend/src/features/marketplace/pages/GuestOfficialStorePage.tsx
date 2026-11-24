import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { baoItemType } from '../baoHelpers'
import { useTindahan } from '../context/TindahanContext'
import { ProductCard } from '../components/ProductCard'
import { Banderitas } from '@/common/components/Banderitas'
import './GuestMarketplacePages.css'

/** Guest-facing page: official RTU store items (uniforms, books, merchandise).
 * Guests see only the first 4 listings with seller names masked.
 * Sign in required to open details, reserve, or message sellers.
 */
export function GuestOfficialStorePage() {
  const {
    currentAccount,
    db,
    allOnSale,
    openModal,
  } = useTindahan()

  const guest = !currentAccount

  // Exclusively display products managed and sold by authorized RTU administrators
  const officialItems = allOnSale.filter((p) => p.cat === 'Official')

  // Dynamic tabs from BAO item types
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

  const totalCount = officialItems.length
  const shown = guest ? officialItems.slice(0, 50) : officialItems
  const shownCount = shown.length

  return (
    <div className="guest-page">
      <div className="guest-hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <Banderitas variant="corner-right" opacity={0.85} />
        <div className="guest-hero-copy" style={{ position: 'relative', zIndex: 2 }}>
          <span className="eyebrow">OFFICIAL RTU STORE</span>
          <h1>Uniforms, books and campus merch</h1>
          <p className="muted small">
            Official items published by the RTU Pasig Campus Store. Sign in to reserve and track
            your pickup ticket.
          </p>
        </div>
        <div className="guest-hero-actions" style={{ position: 'relative', zIndex: 2 }}>
          <button type="button" className="btn yellow" onClick={() => navigate('login')}>
            Sign in to reserve
          </button>
          <span className="guest-count-pill">
            <Icon name="lock" size="sm" /> Guest preview · {shownCount} of {totalCount} shown
          </span>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="guest-pills" role="tablist" aria-label="Official store categories">
        {dynamicTabs.map(([id, label, count]) => {
          const isActive = id === 'All'
          return (
            <button
              key={id}
              type="button"
              className={`guest-pill ${isActive ? 'on' : ''}`}
              role="tab"
              aria-pressed={isActive}
              onClick={() => {
                if (guest) {
                  openModal({ kind: 'gate', route: 'store', why: 'browse the store tabs' })
                  return
                }
                navigate('store')
              }}
            >
              {label}
              <span className="guest-pill-count tnum">({count})</span>
            </button>
          )
        })}
      </div>

      {shown.length ? (
        <div className="guest-pgrid">
          {shown.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              maskedSeller={guest ? 'RTU Staff' : undefined}
              onOpen={
                guest
                  ? () =>
                      openModal({
                        kind: 'gate',
                        route: 'product',
                        why: 'open a listing and reserve it',
                        after: `product?id=${p.id}`,
                      })
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <div className="card stack" style={{ alignItems: 'center', textAlign: 'center', padding: 36 }}>
          <span style={{ color: 'var(--blue)' }}><Icon name="store" /></span>
          <b>No official store listings yet</b>
          <p className="small muted">RTU staff have not posted anything here yet.</p>
        </div>
      )}

      {totalCount > shownCount && (
        <div className="guest-unlock-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="lock" size="sm" />
            <span>
              <b>{totalCount - shownCount} more listing{totalCount - shownCount === 1 ? '' : 's'}</b>{' '}
              available to verified RTU members
            </span>
          </div>
          <button type="button" className="btn" onClick={() => navigate('login')}>
            Sign in to view all
          </button>
        </div>
      )}
    </div>
  )
}
