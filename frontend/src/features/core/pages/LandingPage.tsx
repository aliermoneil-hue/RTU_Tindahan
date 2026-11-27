import { useMemo, useState, useEffect } from 'react'
import { Icon } from '@/common/components/Icon'
import type { IconName } from '@/common/components/icons'
import { navigate } from '@/common/router/router'
import { setAfterLogin } from '@/common/utils/afterLogin'
import { apiFetch } from '@/common/api/client'
import { HeroCarousel } from '../components/HeroCarousel'
import { Banderitas } from '@/common/components/Banderitas'
import { MiniLoader } from '@/common/components/BrandLoader'
import { EmptyState } from '@/common/components/EmptyState'
import { ProductCard } from '../../marketplace/components/ProductCard'
import { useTindahan } from '../../marketplace/context/TindahanContext'
import { initialsOf } from '../../marketplace/constants'
import { imgSrc } from '../../marketplace/imageStore'
import type { PrototypeProduct } from '../../marketplace/types'
import './LandingPage.css'

interface PublicStats {
  listings_on_sale: number
  completed_pickups: number
}

const ABOUT_CARDS: { title: string; text: string; icon: IconName }[] = [
  { title: 'For buyers', icon: 'cart',
    text: 'Find snacks, books, supplies, merchandise and services in one place. Send a request, agree on a time, and pick it up on campus.' },
  { title: 'For sellers', icon: 'tag',
    text: 'List an item or a service, choose your own days and hours, and answer requests from your shop page. Photos, variations and ratings are built in.' },
  { title: 'Safe by design', icon: 'shield',
    text: 'Only verified RTU accounts can trade. Staff approve listings first, meetups happen in visible campus areas, and no money moves online.' },
]

const STEPS: { title: string; text: string; icon: IconName }[] = [
  { title: 'Find and request', text: 'Add listings to your request cart. Nothing is charged online.', icon: 'cart' },
  { title: 'Seller responds', text: 'The seller accepts, or suggests a new time and place.', icon: 'msg' },
  { title: 'Meet and pay at pickup', text: 'Meet in a visible campus area, check the item, then pay the seller in person.', icon: 'pin' },
]

const LOCKED: { title: string; text: string; icon: IconName; route: string }[] = [
  { title: 'Full marketplace', text: 'Every listing, every seller', icon: 'store', route: 'marketplace' },
  { title: 'Search and filters', text: 'Find items by name, price or category', icon: 'search', route: 'browse' },
  { title: 'Request cart', text: 'Reserve items for a campus meetup', icon: 'cart', route: 'cart' },
  { title: 'Sell an item', text: 'Post your own listing', icon: 'plus', route: 'create' },
  { title: 'My orders', text: 'Track requests and pickups', icon: 'bag', route: 'orders' },
  { title: 'Pasig Campus Store', text: 'Official uniforms and books', icon: 'shirt', route: 'store' },
  { title: 'My shop', text: 'Sell items and answer requests', icon: 'eye', route: 'shop' },
  { title: 'Profile and alerts', text: 'Notifications and your account', icon: 'user', route: 'profile' },
]

const TIPS: { title: string; text: string; icon: IconName }[] = [
  { title: 'Meet in a visible spot', text: 'Choose a busy campus area such as the main lobby, library or canteen.', icon: 'pin' },
  { title: 'Check before you pay', text: 'Look at the item or service first. Pay the seller in person only when you are happy.', icon: 'eye' },
  { title: 'Keep chats on Tindahan', text: 'Use Messages inside the site so staff can help if something goes wrong.', icon: 'msg' },
]

const FAQ: { q: string; a: string }[] = [
  { q: 'Who can use RTU Tindahan?',
    a: 'Only verified RTU members. You sign up with your RTU email (it ends with @rtu.edu.ph) and confirm it from your inbox. Guests can look around, but cannot buy, sell, search or message.' },
  { q: 'How do I create an account?',
    a: 'Choose Create account, enter your details, RTU email and a password, then confirm the verification link sent to your RTU inbox. Your account is ready after that.' },
  { q: 'Do I pay on the website? Is there delivery?',
    a: 'No. There is no online payment and no delivery. You agree on a visible campus spot and time, check the item, and pay the seller in person.' },
  { q: 'What can I sell?',
    a: 'Items and services that are safe to hand over on campus. Staff check every listing before it goes live. Some things are not allowed, such as exam answers, medicines and vaping products.' },
  { q: 'I cannot verify my account. What now?',
    a: 'Open the sign-in page and request a new verification link, then check your RTU inbox again.' },
]

export function LandingPage() {
  const [popup, setPopup] = useState<'guidelines' | 'policy' | null>(null)
  const [lockedPopup, setLockedPopup] = useState<{ route: string; title: string } | null>(null)

  // Close the locked-tile pop-up on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLockedPopup(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lockedPopup])

  // ---------- Public stats for logged-out visitors ----------
  // The /stats/ endpoint is AllowAny on the backend, so guests get real
  // numbers immediately with no token. Falls back to the listings already
  // loaded by TindahanContext if the stats endpoint is unreachable.
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const data = await apiFetch<PublicStats>('/stats/')
        if (!cancelled) setStats(data)
      } catch (err) {
        // Log instead of silently hiding so a mis-wired URL or CORS issue is
        // visible in DevTools rather than showing "—" / 0.
        console.error('[LandingPage] Failed to fetch public stats:', err)
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  // ---------- Student sellers for the hero marquee bar ----------
  const {
    allProducts,
    allOnSale,
    listingsLoading,
    sellerKind,
    acctByEmail,
    ratingOf,
    sellerKeyByName,
  } = useTindahan()

  const studentSellers = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    allProducts
      .filter((p: PrototypeProduct) => sellerKind(p) === 'student')
      .forEach((p: PrototypeProduct) => {
        const existing = map.get(p.seller)
        if (existing) existing.count += 1
        else map.set(p.seller, { name: p.seller, count: 1 })
      })
    return Array.from(map.values())
  }, [allProducts, sellerKind])

  // Duplicate when short so the marquee track is wide enough to loop on wide screens
  const marqueeSellers = studentSellers.length < 6 ? [...studentSellers, ...studentSellers] : studentSellers

  const renderSellerTrack = (suffix: string) => (
    <div className="seller-marquee-track">
      {marqueeSellers.map((seller) => {
        const skey = sellerKeyByName(seller.name)
        const acct = skey && skey !== 'official' ? acctByEmail(skey) : undefined
        const r = ratingOf('seller', skey || seller.name)
        return (
          <button
            key={`${suffix}-${seller.name}`}
            type="button"
            className="seller-marquee-item"
            onClick={() => navigate('student-sellers')}
          >
            <span className="seller-avatar">
              {acct?.avatar ? (
                <img src={imgSrc(acct.avatar)} alt="" className="seller-avatar-img" />
              ) : (
                <span className="seller-avatar-init">{initialsOf(acct?.name || seller.name)}</span>
              )}
            </span>
            <div className="seller-info">
              <b className="seller-name">{seller.name}</b>
              <span className="seller-meta">
                {r.n
                  ? `★ ${r.avg.toFixed(1)} · ${seller.count} listings`
                  : `${seller.count} listings`}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className="ld-hero">
        <Banderitas variant="canopy" opacity={0.92} />
        <div className="g-wrap ld-hero-grid">
          <div className="ld-copy">
            <span className="eyebrow">Rizal Technological University · Pasig Campus</span>
            <h1 className="ld-h">Buy, sell and meet up right on campus.</h1>
            <p className="ld-lead">
              RTU Tindahan is the student marketplace for RTU Pasig. Find food, books, school supplies and student
              services from verified RTU students, then meet on campus to pick up and pay.
            </p>
            <div className="row wrap">
              <button className="btn yellow lg" onClick={() => navigate('register')}>
                Create your account <Icon name="arrow" size="sm" />
              </button>
              <button className="btn ghost lg" onClick={() => navigate('login')}>
                Sign in
              </button>
            </div>
            <ul className="ld-trust" aria-label="Why students trust it">
              <li><Icon name="shield" size="sm" /> Verified RTU accounts only</li>
              <li><Icon name="pin" size="sm" /> Campus meetups, no delivery</li>
              <li><Icon name="bag" size="sm" /> Pay in person</li>
            </ul>
          </div>
          <HeroCarousel />
        </div>
      </section>

      {/* ---------- STUDENT SELLERS MARQUEE BAR ---------- */}
      {marqueeSellers.length > 0 && (
        <section className="seller-marquee-bar" aria-label="Active student sellers">
          <div className="seller-marquee" role="marquee" aria-label="Student sellers">
            {renderSellerTrack('a')}
            {renderSellerTrack('b')}
          </div>
        </section>
      )}

      {/* ---------- ABOUT ---------- */}
      <section className="ld-sec" id="about">
        <div className="g-wrap">
          <div className="g-head">
            <span className="eyebrow">About Us</span>
            <h2>A campus marketplace made by and for RTU students</h2>
            <p className="small muted" style={{ maxWidth: '68ch' }}>
              RTU Tindahan helps students on the Pasig Campus find what they need from people they can meet in
              person. Every account is checked, every listing is reviewed by staff, and every deal ends with a
              handshake on campus.
            </p>
          </div>
          <div className="g-3">
            {ABOUT_CARDS.map((c) => (
              <div key={c.title} className="card stack ld-card">
                <span className="ld-ic"><Icon name={c.icon} /></span>
                <b style={{ fontSize: 16 }}>{c.title}</b>
                <p className="small muted">{c.text}</p>
              </div>
            ))}
          </div>

          <div className="g-head" style={{ marginTop: 34 }}>
            <span className="eyebrow">How it works</span>
            <h2>Request, agree, meet on campus</h2>
          </div>
          <div className="g-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card flat stack" style={{ gap: 8 }}>
                <span className="pill navy" style={{ alignSelf: 'flex-start' }}>Step {i + 1}</span>
                <b className="row" style={{ gap: 8 }}><Icon name={s.icon} />{s.title}</b>
                <p className="small muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- SIGN IN TO UNLOCK ---------- */}
      <section className="ld-sec ld-alt" id="unlock">
        <div className="g-wrap">
          <div className="g-head">
            <span className="eyebrow">Sign in to unlock</span>
            <h2>Everything that opens with your RTU account</h2>
            <p className="small muted">
              Tap any tile and we will ask you to sign in first.
            </p>
          </div>
          <div className="g-4">
            {LOCKED.map((t) => (
              <button key={t.title} type="button" className="lock-tile" aria-haspopup="dialog" onClick={() => {
                setLockedPopup({ route: t.route, title: t.title })
              }}>
                <span className="lt-ic"><Icon name={t.icon} /></span>
                <span className="lt-t">
                  <b>{t.title}</b>
                  <span className="small muted">{t.text}</span>
                </span>
                <span className="lt-lock" aria-label="Locked"><Icon name="lock" size="sm" /></span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- INSIGHTS ---------- */}
      <section className="ld-sec" id="insights">
        <div className="g-wrap">
          <div className="g-head">
            <span className="eyebrow">Insights</span>
            <h2>What is happening on Tindahan</h2>
            <p className="small muted">
              These numbers come from the real listings and completed pickups on this site.
            </p>
          </div>

          {/* Live public stats (no sign-in required). Falls back to the
              listings already loaded by TindahanContext when the stats
              endpoint is unreachable. */}
          <div className="ld-stats">
            <div className="card ld-stat">
              <span className="ld-ic"><Icon name="tag" /></span>
              <div>
                <div className="tnum ld-num" aria-label="Listings on sale now">
                  {statsLoading ? '—' : String(stats?.listings_on_sale ?? allOnSale.length)}
                </div>
                <span className="small muted">listings on sale now</span>
              </div>
            </div>
            <div className="card ld-stat">
              <span className="ld-ic"><Icon name="check" /></span>
              <div>
                <div className="tnum ld-num" aria-label="Completed campus pickups">
                  {statsLoading ? '—' : String(stats?.completed_pickups ?? 0)}
                </div>
                <span className="small muted">completed campus pickups</span>
              </div>
            </div>
          </div>

          <div className="row between wrap g-head" style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 30 }}>
            <div>
              <h3 style={{ fontSize: 18 }}>Latest on Tindahan</h3>
            </div>
            {allOnSale.length > 0 && (
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  setAfterLogin('browse')
                  navigate('login')
                }}
              >
                Browse all listings <Icon name="arrow" size="sm" />
              </button>
            )}
          </div>
          <div className="pgrid pgrid4">
            {listingsLoading ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  justifyContent: 'center',
                  padding: 24,
                }}
              >
                <MiniLoader variant="section" size="md" label="Loading listings…" />
              </div>
            ) : allOnSale.length === 0 ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <EmptyState
                  icon="bag"
                  title="No listings yet"
                >
                  Be the first to see what RTU students are selling. Sign in to browse the full marketplace.
                </EmptyState>
              </div>
            ) : (
              allOnSale.slice(0, 8).map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onOpen={(product) =>
                    navigate(`product?id=${encodeURIComponent(product.id)}`)
                  }
                />
              ))
            )}
          </div>

          <div className="g-head" style={{ marginTop: 30, textAlign: 'left' }}>
            <h3 style={{ fontSize: 18 }}>Meetup tips</h3>
          </div>
          <div className="g-3">
            {TIPS.map((t) => (
              <div key={t.title} className="card flat stack" style={{ gap: 6 }}>
                <b className="row" style={{ gap: 8 }}>
                  <Icon name={t.icon} /> {t.title}
                </b>
                <p className="small muted">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- HELP / FAQ ---------- */}
      <section className="ld-sec ld-alt" id="help">
        <div className="g-wrap">
          <div className="g-head">
            <span className="eyebrow">Need Help?</span>
            <h2>Answers before you sign in</h2>
          </div>
          <div className="ld-help">
            <div className="stack" style={{ gap: 8 }}>
              {FAQ.map((f) => (
                <details key={f.q} className="card ld-faq">
                  <summary>{f.q}</summary>
                  <p className="small muted">{f.a}</p>
                </details>
              ))}
            </div>
            <aside className="card stack" style={{ gap: 10, alignSelf: 'start' }}>
              <b style={{ fontSize: 16 }}>Still stuck?</b>
              <p className="small muted">Open the full Help Center & User Manual for step-by-step instructions and policies.</p>
              <button type="button" className="btn yellow block sm" onClick={() => navigate('help')}>
                Open Help Center & Manual
              </button>
              <button className="btn ghost" onClick={() => navigate('register')}>
                <Icon name="key" size="sm" /> Need help verifying?
              </button>
              <button className="btn ghost" onClick={() => setPopup('guidelines')}>
                <Icon name="note" size="sm" /> Community guidelines
              </button>
              <button className="btn ghost" onClick={() => setPopup('policy')}>
                <Icon name="flag" size="sm" /> Prohibited items policy
              </button>
              <p className="tiny muted">After you sign in, you can message sellers and the Official RTU Store from Messages.</p>
            </aside>
          </div>
        </div>
      </section>

      {/* ---------- CALL TO ACTION ---------- */}
      <section className="ld-cta">
        <div className="g-wrap ld-cta-in">
          <div>
            <h2>Ready to trade on campus?</h2>
            <p className="small">Create your RTU account in a few minutes and start browsing.</p>
          </div>
          <div className="row wrap">
            <button className="btn yellow lg" onClick={() => navigate('register')}>Create your account</button>
            <button className="btn ghost lg" onClick={() => navigate('login')}>Sign in</button>
          </div>
        </div>
      </section>

      {/* ---------- POPUP: GUIDELINES / POLICY (same style as Sign in to continue) ---------- */}
      {popup && (
        <div className="popup-overlay" onClick={() => setPopup(null)}>
          <div className="popup-box" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ gap: 8, marginBottom: 16 }}>
              <Icon name={popup === 'guidelines' ? 'note' : 'flag'} size="sm" />
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                {popup === 'guidelines' ? 'Community Guidelines' : 'Prohibited Items Policy'}
              </span>
            </div>
            <ul className="small muted" style={{ lineHeight: 1.55, marginBottom: 20, paddingLeft: 20 }}>
              {popup === 'guidelines' ? (
                <>
                  <li>Be honest about what you sell, including its condition.</li>
                  <li>Meet only at visible spots inside Pasig Campus.</li>
                  <li>Pay in person. RTU Tindahan never handles money or delivery.</li>
                  <li>No exam answers, vaping products, medicines, resale tickets or weapons.</li>
                  <li>Treat every student and staff member with respect.</li>
                </>
              ) : (
                <>
                  <li>Exam answers, test papers and similar material</li>
                  <li>Medicines, supplements and regulated health products</li>
                  <li>Vaping products and tobacco</li>
                  <li>Tickets sold above face value</li>
                  <li>Weapons and dangerous items</li>
                  <li>Anything that cannot be handed over safely on campus</li>
                </>
              )}
            </ul>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setPopup(null)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- POPUP: SIGN IN TO CONTINUE (locked tiles) ---------- */}
      {lockedPopup && (
        <div className="popup-overlay" onClick={() => setLockedPopup(null)}>
          <div
            className="popup-box"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in to continue"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="popup-close"
              aria-label="Close"
              onClick={() => setLockedPopup(null)}
            >
              <Icon name="x" size="sm" />
            </button>
            <div className="row" style={{ gap: 8, marginBottom: 16 }}>
              <Icon name="lock" size="sm" />
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Sign in to continue</span>
            </div>
            <p className="small muted" style={{ lineHeight: 1.55, marginBottom: 20 }}>
              You need a verified RTU account to {lockedPopup.title}. After you sign in, we will take
              you there.
            </p>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn ghost" onClick={() => setLockedPopup(null)}>
                Not now
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setAfterLogin(lockedPopup.route)
                  setLockedPopup(null)
                  navigate('register')
                }}
              >
                Create account
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setAfterLogin(lockedPopup.route)
                  setLockedPopup(null)
                  navigate('login')
                }}
              >
                <Icon name="lock" size="sm" /> Sign in
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}