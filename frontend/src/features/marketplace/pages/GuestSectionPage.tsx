import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { catOf, subOf } from '../constants'
import { useTindahan } from '../context/TindahanContext'
import type { PrototypeProduct } from '../types'
import { ProductCard } from '../components/ProductCard'
import './GuestSectionPage.css'

const GP_META = {
  books: {
    label: 'Books and Academic Materials',
    eyebrow: 'STUDY MATERIALS',
    icon: 'book' as const,
    h: 'Textbooks, lab manuals and reviewers',
    blurb: 'Prescribed textbooks, lab manuals and student reviewers at campus prices.',
    subs: ['All', 'Textbooks', 'Lab manuals', 'Reviewers & notes'],
    sellCat: 'Books and Academic Materials',
    tipsLabel: 'Used-book checklist',
  },
  merch: {
    label: 'RTU Merchandise',
    eyebrow: 'UNIFORMS AND MERCH',
    icon: 'shirt' as const,
    h: 'Uniforms, bags and RTU keepsakes',
    blurb:
      'Official uniforms and merchandise from the campus store, plus handmade RTU items from students.',
    subs: ['All', 'Uniforms', 'Merch & bags', 'Handmade'],
    sellCat: 'RTU Merchandise',
    tipsLabel: 'Uniform size guide',
  },
}

export function GuestSectionPage({ section, kind }: { section?: 'books' | 'merch'; kind?: 'books' | 'merch' }) {
  const sec: 'books' | 'merch' = section || kind || 'books'
  const { currentAccount, allProducts, openModal, setDraft, setListStep } = useTindahan()

  const [q, setQ] = useState('')
  const [sub, setSub] = useState('All')
  const [sort, setSort] = useState('Recommended')

  const g = GP_META[sec]
  const guest = !currentAccount

  const matchProduct = (p: PrototypeProduct) => {
    if (sec === 'books') return catOf(p) === 'Books and Academic Materials'
    return (
      catOf(p) === 'RTU Merchandise' ||
      subOf(p) === 'Uniform' ||
      (p.cat === 'Official' && (p.tag === 'Uniform' || p.tag === 'Merch')) ||
      (p.cat !== 'Official' && /RTU/.test(p.name) && catOf(p) === 'Clothing and Accessories')
    )
  }

  const matchSub = (p: PrototypeProduct, s: string) => {
    if (s === 'All') return true
    if (sec === 'books') {
      if (s === 'Textbooks') return subOf(p) === 'Textbook'
      if (s === 'Lab manuals') return subOf(p) === 'Manual'
      return subOf(p) !== 'Manual' && subOf(p) !== 'Textbook'
    }
    if (s === 'Uniforms') return subOf(p) === 'Uniform'
    if (s === 'Merch & bags') return p.cat === 'Official' && p.tag === 'Merch'
    return p.cat !== 'Official'
  }

  const total = allProducts.filter(matchProduct).length
  const filtered = allProducts
    .filter(
      (p) =>
        matchProduct(p) &&
        matchSub(p, sub) &&
        (!q.trim() ||
          `${p.name} ${p.seller} ${p.tag}`
            .toLowerCase()
            .includes(q.trim().toLowerCase())),
    )
    .slice()

  if (sort === 'Price: low to high') filtered.sort((a, b) => a.price - b.price)
  if (sort === 'Price: high to low') filtered.sort((a, b) => b.price - a.price)

  const shown = guest ? filtered.slice(0, 4) : filtered
  const hiddenCount = guest ? Math.max(0, filtered.length - shown.length) : 0

  const handleSellHere = () => {
    if (guest) {
      openModal({ kind: 'gate', route: 'create', why: 'sell on campus' })
      return
    }
    setDraft((prev) => ({
      ...prev,
      type: prev.editLid ? prev.type : 'product',
      cat: g.sellCat,
    }))
    setListStep(1)
    navigate('create')
  }

  return (
    <main
      className="page"
      style={{ margin: '0 auto', padding: '22px clamp(16px, 4.45vw, 64px)' }}
    >
      <div className="row between wrap">
        <div style={{ maxWidth: '62ch' }}>
          <span className="eyebrow">{g.eyebrow}</span>
          <h1>{g.h}</h1>
          <p className="muted small">{g.blurb}</p>
        </div>
        <button type="button" className="btn yellow" onClick={handleSellHere}>
          <Icon name="plus" size="sm" />
          Sell here
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
            <button
              type="button"
              className="btn sm"
              onClick={() => navigate('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => navigate('register')}
            >
              Create account
            </button>
          </span>
        </div>
      )}

      <div className="row wrap" role="tablist" aria-label="Sections">
        {(['books', 'merch'] as const).map((x) => (
          <button
            key={x}
            type="button"
            className={`btn sm ${x === sec ? '' : 'ghost'}`.trim()}
            aria-current={x === sec}
            onClick={() => navigate(x)}
          >
            <Icon name={GP_META[x].icon} size="sm" />
            {GP_META[x].label}
          </button>
        ))}
      </div>

      <div className="row wrap">
        {guest ? (
          <div className="search" style={{ maxWidth: 340 }}>
            <Icon name="search" size="sm" />
            <input
              readOnly
              placeholder="Sign in to search this section"
              aria-label="Search (sign in required)"
              onClick={() =>
                openModal({
                  kind: 'gate',
                  route: 'browse',
                  why: 'search the marketplace',
                })
              }
            />
          </div>
        ) : (
          <div className="search" style={{ maxWidth: 340 }}>
            <Icon name="search" size="sm" />
            <input
              value={q}
              placeholder={`Search ${g.label.toLowerCase()}`}
              aria-label="Search this section"
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        )}

        {g.subs.map((x) => (
          <button
            key={x}
            type="button"
            className={`btn sm ${sub === x ? '' : 'ghost'}`.trim()}
            aria-pressed={sub === x}
            onClick={() => setSub(x)}
          >
            {x}
          </button>
        ))}

        {!guest && (
          <label className="row small" style={{ gap: 6, marginLeft: 'auto' }}>
            Sort{' '}
            <select
              className="input"
              style={{ width: 'auto' }}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {['Recommended', 'Price: low to high', 'Price: high to low'].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {q && !guest && <p className="small muted">Results for “{q}”</p>}

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
      ) : total ? (
        <div
          className="card stack"
          style={{ alignItems: 'center', textAlign: 'center', padding: 36 }}
        >
          <b>Nothing matches yet</b>
          <p className="small muted">Try another word or section.</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setQ('')
              setSub('All')
              setSort('Recommended')
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div
          className="card stack"
          style={{ alignItems: 'center', textAlign: 'center', padding: 36 }}
        >
          <span style={{ color: 'var(--blue)' }}>
            <Icon name={g.icon} />
          </span>
          <b>No listings in {g.label} yet</b>
          <p className="small muted">
            Students and RTU staff have not posted anything here. Be the first.
          </p>
          <button type="button" className="btn yellow" onClick={handleSellHere}>
            <Icon name="plus" size="sm" />
            Sell here
          </button>
        </div>
      )}

      {hiddenCount > 0 && (
        <div
          className="card row wrap"
          style={{ justifyContent: 'space-between', background: 'var(--soft)' }}
        >
          <span className="row">
            <Icon name="lock" />
            <span>
              <b>More listings</b>
              <span className="small muted" style={{ display: 'block' }}>
                Available to signed-in RTU members.
              </span>
            </span>
          </span>
          <button
            type="button"
            className="btn"
            onClick={() => navigate('login')}
          >
            Sign in to see everything
          </button>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
        }}
      >
        <div className="card row">
          <span style={{ color: 'var(--blue)' }}>
            <Icon name={sec === 'merch' ? 'shirt' : 'info'} />
          </span>
          <div className="grow">
            <b>{g.tipsLabel}</b>
            <p className="small muted">
              {sec === 'merch'
                ? 'Find your size before you reserve.'
                : 'A short list to check before you hand over any money.'}
            </p>
          </div>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => openModal({ kind: 'section-tips', section: sec })}
          >
            Open
          </button>
        </div>

        <div
          className="card row"
          style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-line)' }}
        >
          <span style={{ color: 'var(--navy)' }}>
            <Icon name="store" />
          </span>
          <div className="grow">
            <b>Need the official item?</b>
            <p className="small muted">
              The Pasig Campus Store has prescribed books, uniforms and merchandise.
            </p>
          </div>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              if (guest) {
                openModal({
                  kind: 'gate',
                  route: 'store',
                  why: 'visit the Pasig Campus Store',
                })
              } else {
                navigate('store')
              }
            }}
          >
            Visit store
          </button>
        </div>
      </div>
    </main>
  )
}
