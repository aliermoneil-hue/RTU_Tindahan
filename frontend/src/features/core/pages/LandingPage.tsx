import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import type { IconName } from '@/common/components/icons'
import { navigate } from '@/common/router/router'
import { HeroCarousel } from '../components/HeroCarousel'
import './LandingPage.css'

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

const LOCKED: { title: string; text: string; icon: IconName }[] = [
  { title: 'Full marketplace', text: 'Every listing, every seller', icon: 'store' },
  { title: 'Search and filters', text: 'Find items by name, price or category', icon: 'search' },
  { title: 'Request cart', text: 'Reserve items for a campus meetup', icon: 'cart' },
  { title: 'Sell an item', text: 'Post your own listing', icon: 'plus' },
  { title: 'My orders', text: 'Track requests and pickups', icon: 'bag' },
  { title: 'Pasig Campus Store', text: 'Official uniforms and books', icon: 'shirt' },
  { title: 'My shop', text: 'Sell items and answer requests', icon: 'eye' },
  { title: 'Profile and alerts', text: 'Notifications and your account', icon: 'user' },
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
  const [lockedPopup, setLockedPopup] = useState<{ route: string; why: string } | null>(null)

  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className="ld-hero">
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
              <button key={t.title} type="button" className="lock-tile" onClick={() => {
                setLockedPopup({ route: t.title.toLowerCase().replace(/\s+/g, '-'), why: t.text })
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

          <div className="ld-stats">
            <div className="card ld-stat">
              <span className="ld-ic"><Icon name="tag" /></span>
              <div>
                <div className="tnum ld-num" data-num="0">0</div>
                <span className="small muted">listings on sale now</span>
              </div>
            </div>
            <div className="card ld-stat">
              <span className="ld-ic"><Icon name="check" /></span>
              <div>
                <div className="tnum ld-num" data-num="0">0</div>
                <span className="small muted">completed campus pickups</span>
              </div>
            </div>
          </div>

          <div className="g-head" style={{ marginTop: 30, textAlign: 'left' }}>
            <h3 style={{ fontSize: 18 }}>Open to guests</h3>
            <p className="small muted">Look around these two sections without an account.</p>
          </div>
          <div className="g-3">
            <button type="button" className="card stack g-open" onClick={() => navigate('books')}>
              <span className="avatar" style={{ background: 'var(--soft)', color: 'var(--blue)', borderRadius: 10 }}>
                <Icon name="book" />
              </span>
              <b style={{ fontSize: 16 }}>Books & Academic Materials</b>
              <span className="small muted">Textbooks, notes and supplies at student prices.</span>
              <span className="row between">
                <span className="tiny" style={{ color: 'var(--blue)', fontWeight: 700 }}>
                  Browse as a guest
                </span>
                <span className="row small" style={{ gap: 4, color: 'var(--blue)', fontWeight: 700 }}>
                  View as guest <Icon name="arrow" size="sm" />
                </span>
              </span>
            </button>
            <button type="button" className="card stack g-open" onClick={() => navigate('merch')}>
              <span className="avatar" style={{ background: 'var(--soft)', color: 'var(--blue)', borderRadius: 10 }}>
                <Icon name="shirt" />
              </span>
              <b style={{ fontSize: 16 }}>RTU Merchandise</b>
              <span className="small muted">Uniforms, books and merchandise from RTU staff.</span>
              <span className="row between">
                <span className="tiny" style={{ color: 'var(--blue)', fontWeight: 700 }}>
                  Browse as a guest
                </span>
                <span className="row small" style={{ gap: 4, color: 'var(--blue)', fontWeight: 700 }}>
                  View as guest <Icon name="arrow" size="sm" />
                </span>
              </span>
            </button>
          </div>

          <div className="row between wrap g-head" style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 30 }}>
            <div>
              <h3 style={{ fontSize: 18 }}>Latest on Tindahan</h3>
            </div>
          </div>
          <div className="pgrid pgrid4">
            {/* Product grid populated by backend - placeholder for now */}
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
          <div className="popup-box" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ gap: 8, marginBottom: 16 }}>
              <Icon name="lock" size="sm" />
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Sign in to continue</span>
            </div>
            <p className="small muted" style={{ lineHeight: 1.55, marginBottom: 20 }}>
              You need a verified RTU account to {lockedPopup.why}. Sign in with your RTU email, or create an account if you are new. You can keep browsing the Books and Merchandise pages as a guest.
            </p>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn ghost" onClick={() => setLockedPopup(null)}>
                Not now
              </button>
              <button type="button" className="btn ghost" onClick={() => {
                setLockedPopup(null)
                navigate('register')
              }}>
                Create account
              </button>
              <button type="button" className="btn" onClick={() => {
                setLockedPopup(null)
                navigate('login')
              }}>
                <Icon name="lock" size="sm" /> Sign in
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}