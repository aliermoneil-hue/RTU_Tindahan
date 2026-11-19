import { useMemo } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { useTindahan } from '../context/TindahanContext'
import { ProductCard } from '../components/ProductCard'
import './GuestSectionPage.css'

/** Guest-facing page: items sold by verified RTU students.
 * Guests see only the first 4 listings with seller names masked.
 * Sign in required to open details, reserve, or message sellers.
 */
export function GuestStudentSellersPage() {
  const {
    currentAccount,
    allProducts,
    sellerKind,
    openModal,
  } = useTindahan()

  const guest = !currentAccount

  const mine = allProducts.filter((p) => sellerKind(p) === 'student')
  const total = mine.length

  const shown = guest ? mine.slice(0, 4) : mine
  const hiddenCount = guest ? Math.max(0, total - shown.length) : 0

  const handleSellHere = () => {
    if (guest) {
      openModal({ kind: 'gate', route: 'create', why: 'sell on campus' })
      return
    }
    navigate('create')
  }

  return (
    <main className="page" style={{ margin: '0 auto', padding: '22px clamp(16px, 4.45vw, 64px)' }}>
      <div className="row between wrap">
        <div style={{ maxWidth: '62ch' }}>
          <span className="eyebrow">STUDENT SELLERS</span>
          <h1>Items sold by students</h1>
          <p className="muted small">
            Listings posted by verified RTU students. Staff checked each one before it went live.
          </p>
        </div>
        <button type="button" className="btn yellow" onClick={handleSellHere}>
          <Icon name="plus" size="sm" /> Sell an item
        </button>
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

      {shown.length ? (
        <div className="pgrid">
          {shown.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              maskedSeller={guest ? 'Verified RTU seller' : undefined}
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
          <span style={{ color: 'var(--blue)' }}><Icon name="user" /></span>
          <b>No student listings yet</b>
          <p className="small muted">No verified RTU students have posted items here.</p>
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
