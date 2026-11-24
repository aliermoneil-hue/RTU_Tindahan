import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { useTindahan } from '../context/TindahanContext'
import { ProductCard } from '../components/ProductCard'
import { Banderitas } from '@/common/components/Banderitas'
import './GuestMarketplacePages.css'

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
  const totalCount = mine.length

  const shown = guest ? mine.slice(0, 50) : mine
  const shownCount = shown.length

  const handleSellHere = () => {
    if (guest) {
      openModal({ kind: 'gate', route: 'create', why: 'sell on campus' })
      return
    }
    navigate('create')
  }

  return (
    <div className="guest-page">
      <div className="guest-hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <Banderitas variant="corner-right" opacity={0.85} />
        <div className="guest-hero-copy" style={{ position: 'relative', zIndex: 2 }}>
          <span className="eyebrow">STUDENT SELLERS</span>
          <h1>Items sold by RTU students</h1>
          <p className="muted small">
            Verified student listings reviewed by RTU staff before going live. Sign in to view
            seller details, reserve, or message.
          </p>
        </div>
        <div className="guest-hero-actions" style={{ position: 'relative', zIndex: 2 }}>
          <button type="button" className="btn yellow" onClick={handleSellHere}>
            <Icon name="plus" size="sm" /> Sell an item
          </button>
          <span className="guest-count-pill">
            <Icon name="lock" size="sm" /> Guest preview · {shownCount} of {totalCount} shown
          </span>
        </div>
      </div>

      {shown.length ? (
        <div className="guest-pgrid">
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
                        after: `product?id=${p.id}`,
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
