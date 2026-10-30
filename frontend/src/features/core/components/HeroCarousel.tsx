import { useEffect, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { Button } from '@/common/components/Button'
import { navigate } from '@/common/router/router'
import { ICON_PATHS, type IconName } from '@/common/components/icons'
import './HeroCarousel.css'

/**
 * Marketing slides for the landing page (same four as the prototype).
 * These are fixed texts, not marketplace data.
 * To change a slide: edit this list. `tone` is a gradient class in HeroCarousel.css.
 */
interface Slide {
  tone: string
  tag: string
  title: string
  text: string
  icons: [IconName, IconName, IconName]
}

const SLIDES: Slide[] = [
  { tone: 't-food', tag: 'Food and snacks', title: 'Merienda between classes',
    text: 'Home-cooked snacks and drinks from RTU students, ready for campus pickup.', icons: ['bowl', 'cup', 'tag'] },
  { tone: 't-study', tag: 'Books and supplies', title: 'Books, notes and school supplies',
    text: 'Textbooks, calculators and supplies at student prices.', icons: ['book', 'calc', 'note'] },
  { tone: 't-print', tag: 'Student services', title: 'Services from students',
    text: 'Printing, tutoring and other help from students who are free when you are.', icons: ['print', 'user', 'clock'] },
  { tone: 't-merch', tag: 'RTU merchandise', title: 'Official RTU items',
    text: 'Uniforms, books and merchandise published by RTU staff.', icons: ['shirt', 'store', 'shield'] },
]

const AUTOPLAY_MS = 6500

/** One decorative picture made of three big icons on soft circles. */
function SlideArt({ icons }: { icons: Slide['icons'] }) {
  const glyph = (name: IconName, x: number, y: number, scale: number) => (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      fill="none"
      stroke="#fff"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  )
  return (
    <svg className="car-art" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <circle cx="336" cy="60" r="92" fill="rgba(255,255,255,.10)" />
      <circle cx="52" cy="226" r="74" fill="rgba(255,255,255,.08)" />
      <circle cx="200" cy="130" r="68" fill="rgba(255,255,255,.18)" />
      {glyph(icons[0], 152, 82, 4)}
      <rect x="88" y="150" width="54" height="54" rx="14" fill="rgba(255,255,255,.22)" />
      {glyph(icons[1], 97, 159, 1.5)}
      <rect x="262" y="40" width="50" height="50" rx="14" fill="rgba(255,255,255,.22)" />
      {glyph(icons[2], 270, 48, 1.4)}
    </svg>
  )
}

/**
 * Slideshow in the landing hero. Features: previous/next, dots, pause button,
 * auto-advance (stops on hover/focus, and when the visitor prefers reduced
 * motion), and Left/Right arrow keys.
 */
export function HeroCarousel() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )
  const [hovering, setHovering] = useState(false)
  const count = SLIDES.length

  const go = (i: number) => setIndex(((i % count) + count) % count)

  useEffect(() => {
    if (paused || hovering) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS)
    return () => window.clearInterval(id)
  }, [paused, hovering, count, index])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(index - 1)
    if (e.key === 'ArrowRight') go(index + 1)
  }

  return (
    <div
      className="car"
      role="region"
      aria-roledescription="carousel"
      aria-label="Marketplace highlights"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <div className="car-track">
        {SLIDES.map((s, i) => (
          <div
            key={s.title}
            className={`car-slide ${s.tone} ${i === index ? 'on' : ''}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i === index ? undefined : true}
          >
            <SlideArt icons={s.icons} />
            <div className="car-cap">
              <span className="pill yellow">{s.tag}</span>
              <b>{s.title}</b>
              <p>{s.text}</p>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="car-nav prev" aria-label="Previous slide" onClick={() => go(index - 1)}>
        <Icon name="chev" />
      </button>
      <button type="button" className="car-nav next" aria-label="Next slide" onClick={() => go(index + 1)}>
        <Icon name="chev" />
      </button>

      <div className="car-bar">
        <div className="car-dots" role="group" aria-label="Choose a slide">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              className={`car-dot ${i === index ? 'on' : ''}`}
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => go(i)}
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
      <p className="sr-only" aria-live="polite">{`Slide ${index + 1} of ${count}`}</p>
    </div>
  )
}
