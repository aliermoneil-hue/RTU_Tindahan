import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { baoItemType } from '../baoHelpers'
import { useTindahan } from '../context/TindahanContext'
import { ProductCard } from '../components/ProductCard'
import './GuestSectionPage.css'

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

  const total = officialItems.length
  const shown = guest ? officialItems.slice(0, 4) : officialItems
  const hiddenCount = guest ? Math.max(0, total - shown.length) : 0

  return (
    <main className="page" style={{ margin: '0 auto', padding: '22px clamp(16px, 4.45vw, 64px)' }}>
      <div className="row between wrap">
        <div style={{ maxWidth: '62ch' }}>
          <span className="eyebrow">OFFICIAL RTU STORE</span>
          <h1>Uniforms, books and merchandise</h1>
          <p className="muted small">
            Official uniforms, books and merchandise published by RTU staff.
            Published by the Pasig Campus Store.
          </p>
        </div>
      </div>

      {guest && (
        <div className="note blue" role="status">
          <Icon name="lock" />
          <span className="grow">
            <b>You are browsing as a guest.</b> You can see {Math.min(4, total)} of {total}{' '}
            listings with seller names hidden. Sign in to see everything, open details, reserve and
            message sellers.
          </span>
          <span className="row">
            <button type="button" className="btn sm" onClick={() => navigate('login')}>
              Sign in
            </button>
            <button type="button" className="btn ghost sm" onClick={() => navigate('register')}>
              Create account
            </button>
          </span>
        </div>
      )}

      {/* Tab bar */}
      <div className="row wrap" style={{ marginBottom: 18 }}>
        {dynamicTabs.map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            className="btn sm"
            onClick={() => {
              if (guest) {
                openModal({ kind: 'gate', route: 'store', why: 'browse the store tabs' })
                return
              }
              navigate('store')
            }}
          >
            {label}
            <span className="small muted">({count})</span>
          </button>
        ))}
      </div>

      {shown.length ? (
        <div className="pgrid">
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

      {hiddenCount > 0 && (
        <div className="card row wrap" style={{ justifyContent: 'space-between', background: 'var(--soft)' }}>
          <span className="row">
            <Icon name="lock" />
            <span>
              <b>More listings</b>
              <span className="small muted" style={{ display: 'block' }}>
                Available to signed-in RTU members.
              </span>
            </span>
          </span>
          <button type="button" className="btn" onClick={() => navigate('login')}>
            Sign in to see everything
          </button>
        </div>
      )}
    </main>
  )
}
