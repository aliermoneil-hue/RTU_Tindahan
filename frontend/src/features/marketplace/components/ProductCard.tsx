import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { Icon } from '@/common/components/Icon'
import type { IconName } from '@/common/components/icons'
import { playHeart } from '@/common/sounds'
import { isSvc, priceLabel } from '../constants'
import { useTindahan } from '../context/TindahanContext'
import { imgSrc, imgsOf } from '../imageStore'
import type { PrototypeProduct } from '../types'
import './ProductCard.css'

interface ProductCardProps {
  product: PrototypeProduct
  showFav?: boolean
  rateBasis?: 'item' | 'seller'
  extraActions?: ReactNode
  maskedSeller?: string
  onOpen?: (product: PrototypeProduct) => void
}

export function ProductCard({
  product,
  showFav = true,
  rateBasis = 'item',
  extraActions,
  maskedSeller: _maskedSeller,
  onOpen,
}: ProductCardProps) {
  const { currentAccount, openProduct, sellerKind, toggleFav, ratingOf, sellerKeyOf } = useTindahan()
  const sk = sellerKind(product)
  const svc = isSvc(product)
  const fav = Boolean(currentAccount?.favs?.includes(product.id))
  const imgs = imgsOf(product)
  const mainSrc = imgs.length ? imgSrc(imgs[0]) : null

  const typeCls = svc ? 'type-service is-service' : sk === 'school' ? 'type-school' : 'type-student'

  const r =
    rateBasis === 'seller' ? ratingOf('seller', sellerKeyOf(product)) : ratingOf('item', product.id)

  const [particles, setParticles] = useState<
    {
      x: number
      y: number
      id: number
      r: string
      tx: number
      ty: number
    }[]
  >([])
  const [ripple, setRipple] = useState<{ x: number; y: number; active: boolean } | null>(null)

  const handleOpen = () => {
    if (onOpen) {
      onOpen(product)
    } else {
      openProduct(product.id)
    }
  }

  const handleHeartClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()
    playHeart()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setRipple({ x, y, active: true })
    setTimeout(() => setRipple(null), 600)

    const newParticles = Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2
      return {
        x,
        y,
        id: i,
        r: `${angle}rad`,
        tx: Math.cos(angle) * (20 + i * 3),
        ty: Math.sin(angle) * (20 + i * 3),
      }
    })
    setParticles(newParticles)
    setTimeout(() => setParticles([]), 500)

    toggleFav(product.id)
  }

  return (
    <div
      className={`pcard src-${sk} ${typeCls}`.trim()}
      data-go="product"
      data-id={product.id}
      tabIndex={0}
      role="link"
      aria-label={product.name}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) {
          handleOpen()
        }
      }}
    >
      <div className={`photo ${product.tone || 't-study'} ${mainSrc ? 'has-img' : 'nophoto-tile'}`.trim()}>
        {mainSrc ? (
          <img
            className="pimg"
            src={mainSrc}
            alt={product.name}
            loading="lazy"
            decoding="async"
          />
        ) : null}
        {!mainSrc && (
          <>
            <Icon name={(product.icon || 'tag') as IconName} />
            <span className="nophoto">No photo yet</span>
          </>
        )}
        <span className="tag">{product.tag}</span>
        <span
          className={`srcpill ${sk} ${svc ? 'svc' : ''}`.trim()}
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            zIndex: 2,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            width: 'fit-content',
            maxWidth: 'calc(100% - 16px)',
          }}
        >
          {sk === 'school' ? (
            <>
              <Icon name="shield" size="sm" />
              Official RTU Store
            </>
          ) : svc ? (
            'Service'
          ) : (
            'Student seller'
          )}
        </span>
      </div>
      {showFav && (
        <button
          type="button"
          className={`heart ${fav ? 'on' : ''}`.trim()}
          data-fav={product.id}
          aria-label={`Save ${product.name}`}
          aria-pressed={fav}
          onClick={handleHeartClick}
        >
          <Icon name="heart" size="sm" />
          {ripple && <div className="heart-ripple" style={{ left: '50%', top: '50%' }} />}
          {particles.map((pt) => (
            <div
              key={pt.id}
              className="heart-particle"
              style={
                {
                  left: '50%',
                  top: '50%',
                  '--r': pt.r,
                  '--tx': `${pt.tx}px`,
                  '--ty': `${pt.ty}px`,
                } as CSSProperties
              }
            />
          ))}
        </button>
      )}

      <div className="pcard-body">
        <h4>{product.name}</h4>
        <span className="pcard-seller">{_maskedSeller ?? product.seller}</span>
        <div className="pcard-footer">
          <span className="price tnum">{priceLabel(product)}</span>
          <div className="card-rating">
            {r.n ? (
              <>
                <span className="star">★</span>
                <b className="tnum">{r.avg.toFixed(1)}</b>
                <span className="muted tnum">({r.n})</span>
              </>
            ) : (
              <span className="tiny muted">No ratings</span>
            )}
          </div>
        </div>
      </div>
      {extraActions}
    </div>
  )
}
