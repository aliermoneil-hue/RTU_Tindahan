import { useCallback, useEffect, useRef, useState } from 'react'
import './Carousel.css'
import Icon from './Icon'
import { ICONS } from '../icons'
import { SLIDES } from '../data'
import { authHref } from '../config'

const SLIDE_MS = 6500

/* Soft circles, one big icon and two small icon chips, drawn as SVG so no picture files are needed. */
function Art({ icons }: { icons: [string, string, string] }) {
  const g = (name: string, x: number, y: number, scale: number) => (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      fill="none"
      stroke="#fff"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? '' }}
    />
  )
  return (
    <svg className="car-art" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <circle cx="336" cy="60" r="92" fill="rgba(255,255,255,.10)" />
      <circle cx="52" cy="226" r="74" fill="rgba(255,255,255,.08)" />
      <circle cx="200" cy="130" r="68" fill="rgba(255,255,255,.18)" />
      {g(icons[0], 152, 82, 4)}
      <rect x="88" y="150" width="54" height="54" rx="14" fill="rgba(255,255,255,.22)" />
      {g(icons[1], 97, 159, 1.5)}
      <rect x="262" y="40" width="50" height="50" rx="14" fill="rgba(255,255,255,.22)" />
      {g(icons[2], 270, 48, 1.4)}
    </svg>
  )
}

/* The slideshow: slides fade every 6.5 seconds. It waits while the mouse or keyboard focus is on it, while the browser tab is hidden, and when Pause is pressed. */
export default function Carousel() {
  const [cur, setCur] = useState(0)
  const [paused, setPaused] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  const [live, setLive] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const n = SLIDES.length

  const show = useCallback(
    (i: number, say: boolean) => {
      const next = ((i % n) + n) % n
      setCur(next)
      if (say) setLive(`Slide ${next + 1} of ${n}`)
    },
    [n],
  )

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      const el = box.current
      if (!el || document.hidden) return
      const canHover = window.matchMedia?.('(hover: hover)').matches
      if ((canHover && el.matches(':hover')) || el.contains(document.activeElement)) return
      setCur((c) => (c + 1) % n)
    }, SLIDE_MS)
    return () => clearInterval(id)
  }, [paused, n])

  return (
    <div className="car" ref={box} role="region" aria-roledescription="carousel" aria-label="Marketplace highlights">
      <div className="car-track">
        {SLIDES.map((s, i) => (
          <div
            key={s.title}
            className={`car-slide tone-${s.tone} ${i === cur ? 'on' : ''}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${n}`}
            aria-hidden={i === cur ? undefined : true}
          >
            <Art icons={s.icons} />
            <div className="car-cap">
              <span className="pill yellow">{s.label}</span>
              <b>{s.title}</b>
              <p>{s.text}</p>
              <a className="btn yellow sm" href={authHref('sign-in')} tabIndex={i === cur ? 0 : -1}>
                Sign in to browse
              </a>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="car-nav prev" aria-label="Previous slide" onClick={() => show(cur - 1, true)}>
        <Icon name="chev" />
      </button>
      <button type="button" className="car-nav next" aria-label="Next slide" onClick={() => show(cur + 1, true)}>
        <Icon name="chev" />
      </button>
      <div className="car-bar">
        <div className="car-dots" role="group" aria-label="Choose a slide">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              className={`car-dot ${i === cur ? 'on' : ''}`}
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === cur ? 'true' : undefined}
              onClick={() => show(i, true)}
            />
          ))}
        </div>
        <button
          type="button"
          className="car-pause"
          aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
          onClick={() => setPaused((p) => !p)}
        >
          <svg className="ico sm" viewBox="0 0 24 24" aria-hidden="true">
            {paused ? <path d="m8 5 11 7-11 7z" /> : <path d="M8 5v14M16 5v14" />}
          </svg>
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  )
}
