import { useLayoutEffect, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { navigate } from '@/common/router/router'
import { LoginForm } from '../components/LoginForm'
import { useAuth } from '../AuthContext'
import { Icon } from '@/common/components/Icon'
import logoImg from '@/assets/logo-removebg-preview.png'
import img0 from '@/assets/SampleImages/0.jpg'
import imgRtu from '@/assets/SampleImages/applying-to-rizal-technological-university.png'
import imgBef from '@/assets/SampleImages/bef71f2e0c003d63.jpeg'
import img3 from '@/assets/SampleImages/images (3).jpeg'
import img4 from '@/assets/SampleImages/images (4).jpeg'
import img5 from '@/assets/SampleImages/images (5).jpeg'
import type { LoginCredentials } from '../types'
import './LoginPage.css'

const CAROUSEL_IMAGES = [
  { src: img0, alt: 'Sample image 0' },
  { src: imgRtu, alt: 'Applying to RTU' },
  { src: imgBef, alt: 'Sample image bef71f2e0c003d63' },
  { src: img3, alt: 'Campus marketplace image 3' },
  { src: img4, alt: 'Campus marketplace image 4' },
  { src: img5, alt: 'Campus marketplace image 5' },
]

/* ---- Carousel motion settings ---- */
const STEP_SECONDS = 3 // how long each image rests in the center
const SLIDE_SECONDS = 1.2 // how long the glide to the next image takes
const TRAVEL = 210 // xPercent each card travels from (+) to (-); controls neighbour spacing

/**
 * Auto-sliding, seamlessly looping carousel (no controls).
 *
 * Based on the GSAP "infinite cards" loop: every card flies across the track
 * while scaling/fading in and out (yoyo), staggered so the card in the middle
 * is biggest and its neighbours shrink away on each side. Instead of a
 * ScrollTrigger, a single `pos` value is eased from slide to slide, and every
 * card's pass is rendered from that value, so the loop never has a seam.
 */
function LoginCarousel({ images }: { images: { src: string; alt: string }[] }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.login-carousel-card')
      const n = cards.length
      if (n === 0) return

      // One paused "pass" timeline per card: scale/opacity/grayscale peak in the
      // middle (yoyo) while the card travels right → left in a straight line.
      const passes = cards.map((card) =>
        gsap
          .timeline({ paused: true })
          .fromTo(
            card,
            { scale: 0 },
            { scale: 1, duration: 0.5, yoyo: true, repeat: 1, ease: 'power1.in' },
            0
          )
          .fromTo(
            card,
            { opacity: 0, filter: 'grayscale(60%)' },
            { opacity: 1, filter: 'grayscale(0%)', duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.in' },
            0
          )
          .fromTo(card, { xPercent: TRAVEL }, { xPercent: -TRAVEL, duration: 1, ease: 'none' }, 0)
      )

      const wrap = gsap.utils.wrap(0, 1)
      const state = { pos: 0 } // card `i` is centered whenever pos === i (mod n)

      const render = () => {
        passes.forEach((pass, i) => {
          const progress = wrap(0.5 + (state.pos - i) / n)
          pass.progress(progress)
          // keep the centered card on top (z-index must be an integer)
          cards[i].style.zIndex = String(Math.round((1 - Math.abs(progress - 0.5) * 2) * 100))
        })
      }
      render()

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      let target = 0
      const advance = () => {
        target += 1
        gsap.to(state, {
          pos: target,
          duration: SLIDE_SECONDS,
          ease: 'power3.inOut',
          overwrite: true,
          onUpdate: render,
        })
      }

      // slide on a steady beat, forever
      gsap
        .timeline({ repeat: -1, delay: STEP_SECONDS })
        .call(advance)
        .to({}, { duration: STEP_SECONDS })
    }, root)

    return () => ctx.revert()
  }, [images.length])

  return (
    <div className="login-carousel" ref={rootRef} aria-roledescription="carousel" aria-label="Campus marketplace images">
      <div className="login-carousel-track">
        {images.map(({ src, alt }) => (
          <div className="login-carousel-card" key={src}>
            <img src={src} alt={alt} draggable={false} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The sign-in page. Matches the prototype layout: split panel with info on the left, form on the right. */
export function LoginPage() {
  const { login } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [popup, setPopup] = useState<'guidelines' | 'policy' | null>(null)
  const loginStartRef = useRef<number>(0)

  // Always scroll down when entering the sign-in page
  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  const handleLogin = async ({ email, password }: LoginCredentials) => {
    loginStartRef.current = Date.now()
    setIsLoading(true)
    setError(null)
    try {
      await login(email, password)
      navigate('', { replace: true }) // the home route shows the marketplace once signed in
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = () => {
    navigate('forgot-password')
  }

  const handleGuidelines = () => {
    setPopup('guidelines')
  }

  return (
    <div className="login-page">
      <div className="split">
        {/* Left info panel (navy background, from prototype) */}
        <div className="l">
          <button className="logo" type="button" onClick={() => navigate('/')}>
            <img className="logo-img" src={logoImg} alt="RTU Tindahan Campus Marketplace" />
          </button>
          <LoginCarousel images={CAROUSEL_IMAGES} />
          <div className="info-panel">
            <h1 className="hero-h">Your campus marketplace, made for everyday student life.</h1>
            <p>
              Buy merienda, find pre-loved books, book student services, and request official RTU items from verified students and personnel at Pasig Campus.
            </p>
            <div className="row wrap small" style={{ opacity: 0.9, gap: 16, justifyContent: 'center' }}>
              <span className="row" style={{ gap: 6 }}>
                <Icon name="shield" size="sm" /> Verified RTU accounts
              </span>
              <span className="row" style={{ gap: 6 }}>
                <Icon name="pin" size="sm" /> Campus meetup only
              </span>
              <span className="row" style={{ gap: 6 }}>
                <Icon name="bag" size="sm" /> Cash or e-wallet
              </span>
            </div>
            <div className="note blue">
              <Icon name="info" />
              <span>
                Access is restricted to verified RTU students and personnel. Never share your password or other sign-in details.
              </span>
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="r">
          <div className="row between" style={{ width: '100%', maxWidth: '400px', marginBottom: 18 }}>
            <button type="button" className="link" onClick={() => navigate('/verify')}>
              Need help verifying?
            </button>
            <button type="button" className="link" onClick={handleGuidelines}>
              View guidelines
            </button>
          </div>

          <LoginForm
            onSubmit={handleLogin}
            isLoading={isLoading}
            error={error}
            onForgotPassword={handleForgotPassword}
          />
        </div>
      </div>

      {/* Popup: Community Guidelines — same as LandingPage */}
      {popup === 'guidelines' && (
        <div className="popup-overlay" onClick={() => setPopup(null)}>
          <div className="popup-box" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ gap: 8, marginBottom: 16 }}>
              <Icon name="note" size="sm" />
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Community Guidelines</span>
            </div>
            <ul className="small muted" style={{ lineHeight: 1.55, marginBottom: 20, paddingLeft: 20 }}>
              <li>Be honest about what you sell, including its condition.</li>
              <li>Meet only at visible spots inside Pasig Campus.</li>
              <li>Pay in person. RTU Tindahan never handles money or delivery.</li>
              <li>No exam answers, vaping products, medicines, resale tickets or weapons.</li>
              <li>Treat every student and staff member with respect.</li>
            </ul>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setPopup(null)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
