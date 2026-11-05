import { useRef } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { useTindahan } from '../context/TindahanContext'
import { AvatarBadge } from '../components/AvatarBadge'
import { ProductCard } from '../components/ProductCard'
import { RatingText } from '../components/StarRating'
import './FavoritesPage.css'

export function FavoritesPage() {
  const {
    currentAccount,
    allOnSale,
    byId,
    acctByEmail,
    sellerNameOf,
    browseFor,
    toggleFav,
    toggleSellerFav,
  } = useTindahan()

  const productsRef = useRef<HTMLElement | null>(null)
  const sellersRef = useRef<HTMLElement | null>(null)

  if (!currentAccount) return null

  const favIds = currentAccount.favs || []
  const sfavKeys = currentAccount.sfavs || []
  const liveSet = new Set(allOnSale.map((p) => p.id))
  const prods = favIds
    .filter((id) => liveSet.has(id))
    .map((id) => byId(id)!)
    .filter(Boolean)
  const gone = favIds.filter((id) => !liveSet.has(id))

  return (
    <>
      <div className="srchead">
        <div style={{ maxWidth: '62ch' }}>
          <span className="eyebrow">YOUR SAVED ITEMS</span>
          <h1>Favorites</h1>
          <p className="muted small">
            Products and sellers you saved. Only you can see and change this list. Tap the heart on
            a product, or "Add seller to favorites" on a seller, to save more.
          </p>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => productsRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            Products <span className="tnum">({prods.length + gone.length})</span>
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => sellersRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            Sellers <span className="tnum">({sfavKeys.length})</span>
          </button>
        </div>
      </div>

      <section
        ref={productsRef}
        className="stack"
        id="fav-products"
        aria-labelledby="fav-p-h"
        style={{ gap: 12 }}
      >
        <h2 id="fav-p-h" style={{ fontSize: 18 }}>
          Favorite products
        </h2>
        {prods.length || gone.length ? (
          <>
            {prods.length > 0 && (
              <div className="pgrid">
                {prods.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
            {gone.map((id) => (
              <div key={id} className="card row between wrap">
                <span className="small muted">
                  A saved item is not on sale right now. It may be paused, sold out or removed.
                </span>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => toggleFav(id)}
                >
                  <Icon name="x" size="sm" />
                  Remove
                </button>
              </div>
            ))}
          </>
        ) : (
          <div
            className="card stack"
            style={{ alignItems: 'center', textAlign: 'center', padding: 30 }}
          >
            <span style={{ color: 'var(--blue)' }}>
              <Icon name="heart" />
            </span>
            <b>No favorite products yet</b>
            <p className="small muted" style={{ maxWidth: '46ch' }}>
              Tap the heart on any product to keep it here.
            </p>
            <button type="button" className="btn" onClick={() => navigate('browse')}>
              Browse all
            </button>
          </div>
        )}
      </section>

      <section
        ref={sellersRef}
        className="stack"
        id="fav-sellers"
        aria-labelledby="fav-s-h"
        style={{ gap: 12 }}
      >
        <h2 id="fav-s-h" style={{ fontSize: 18 }}>
          Favorite sellers
        </h2>
        {sfavKeys.length ? (
          sfavKeys.map((k) => {
            const official = k === 'official'
            const nm = sellerNameOf(k)
            const acct = official ? undefined : acctByEmail(k)
            return (
              <div key={k} className="card row wrap fav-seller" style={{ gap: 12 }}>
                {official ? (
                  <span className="avw av-lg">
                    <span className="avatar staff">RTU</span>
                  </span>
                ) : (
                  <AvatarBadge account={acct} name={nm} size="lg" />
                )}
                <div className="grow" style={{ minWidth: 0 }}>
                  <b style={{ overflowWrap: 'anywhere' }}>{nm}</b>
                  <div className="small muted">
                    {official ? 'Official RTU Store' : 'Student seller'}
                  </div>
                  <div className="small">
                    <RatingText kind="seller" targetKey={k} />
                  </div>
                </div>
                <div className="row wrap" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      if (official) navigate('store')
                      else browseFor({ q: nm })
                    }}
                  >
                    View shop
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    aria-label={`Remove ${nm} from favorites`}
                    onClick={() => toggleSellerFav(k)}
                  >
                    <Icon name="x" size="sm" />
                    Remove
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div
            className="card stack"
            style={{ alignItems: 'center', textAlign: 'center', padding: 30 }}
          >
            <span style={{ color: 'var(--blue)' }}>
              <Icon name="user" />
            </span>
            <b>No favorite sellers yet</b>
            <p className="small muted" style={{ maxWidth: '46ch' }}>
              Open a product and choose "Add seller to favorites", or find sellers on the Student
              Sellers page.
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => navigate('student-sellers')}
            >
              Student Sellers
            </button>
          </div>
        )}
      </section>
    </>
  )
}
