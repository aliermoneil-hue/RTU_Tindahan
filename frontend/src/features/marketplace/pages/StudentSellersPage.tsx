import { useMemo } from 'react'
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

  return (
    <>
      <div className="srchead">
        <div style={{ maxWidth: '62ch' }}>
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
          <div className="row wrap" style={{ gap: 14 }}>
            {sellerNames.map(([nm]) => {
              const skey = sellerKeyByName(nm)
              const acct = skey && skey !== 'official' ? acctByEmail(skey) : undefined
              const isOwn = Boolean(currentAccount && skey === currentAccount.email)
              const sfav = Boolean(skey && currentAccount?.sfavs?.includes(skey))
              return (
                <div key={nm} className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
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
        </div>
      )}

      {mine.length ? (
        <div className="pgrid">
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
