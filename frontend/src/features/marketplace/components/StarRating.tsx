import { useTindahan } from '../context/TindahanContext'
import type { PrototypeProduct } from '../types'
import './StarRating.css'

export function StarsDisplay({
  avg = 0,
  size = '',
}: {
  avg?: number
  size?: '' | 'lg'
}) {
  const val = Math.max(0, Math.min(5, Number(avg) || 0))
  const w = Math.round((val / 5) * 100)
  return (
    <span
      className={`stars ${size}`.trim()}
      role="img"
      aria-label={`${val.toFixed(1)} out of 5 stars`}
    >
      <span className="stars-bg" aria-hidden="true">
        ★★★★★
      </span>
      <span className="stars-fg" style={{ width: `${w}%` }} aria-hidden="true">
        ★★★★★
      </span>
    </span>
  )
}

export function RatingText({
  kind,
  targetKey,
  onClick,
}: {
  kind: 'item' | 'seller'
  targetKey: string
  onClick?: () => void
}) {
  const { ratingOf } = useTindahan()
  const r = ratingOf(kind, targetKey)
  if (!r.n) {
    return <span className="tiny muted">No ratings yet</span>
  }
  const inner = (
    <>
      <StarsDisplay avg={r.avg} />
      <b className="tnum">{r.avg.toFixed(1)}</b>
      <span className="muted tnum">
        ({r.n} {r.n === 1 ? 'review' : 'reviews'})
      </span>
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        className="rate-line rate-btn"
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        {inner}
      </button>
    )
  }
  return <span className="rate-line">{inner}</span>
}

export function CardRating({
  product,
  rateBasis = 'item',
}: {
  product: PrototypeProduct
  rateBasis?: 'item' | 'seller'
}) {
  const { ratingOf, sellerKeyOf } = useTindahan()
  if (rateBasis === 'seller') {
    const r = ratingOf('seller', sellerKeyOf(product))
    return (
      <div className="tiny">
        <span className="muted">Seller: </span>
        {r.n ? (
          <span className="rate-line">
            <StarsDisplay avg={r.avg} />
            <b className="tnum">{r.avg.toFixed(1)}</b>
            <span className="muted tnum">
              ({r.n} {r.n === 1 ? 'review' : 'reviews'})
            </span>
          </span>
        ) : (
          <span className="tiny muted">No ratings yet</span>
        )}
      </div>
    )
  }
  const r = ratingOf('item', product.id)
  return (
    <div className="tiny">
      {r.n ? (
        <span className="rate-line">
          <StarsDisplay avg={r.avg} />
          <b className="tnum">{r.avg.toFixed(1)}</b>
          <span className="muted tnum">
            ({r.n} {r.n === 1 ? 'review' : 'reviews'})
          </span>
        </span>
      ) : (
        <span className="tiny muted">No ratings yet</span>
      )}
    </div>
  )
}

export function StarPicker({
  value,
  onChange,
  label = 'Rating',
}: {
  value: number
  onChange: (stars: number) => void
  label?: string
}) {
  const cur = Number(value) || 0
  return (
    <div className="row star-in" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          className={`star-btn ${i <= cur ? 'on' : ''}`.trim()}
          role="radio"
          aria-checked={cur === i}
          aria-label={`${i} star${i === 1 ? '' : 's'}`}
          onClick={() => onChange(i)}
        >
          ★
        </button>
      ))}
      <span className="small muted tnum">
        {cur ? `${cur} of 5` : 'Tap a star (1 to 5)'}
      </span>
    </div>
  )
}
