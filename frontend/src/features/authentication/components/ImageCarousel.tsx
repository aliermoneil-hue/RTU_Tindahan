'use client'

import { useState, useEffect, useRef } from 'react'

export interface CarouselImage {
  src: string
  alt: string
}

/**
 * Auto-sliding carousel showing 3 images at once:
 * previous (left), current (center), next (right).
 * Track physically slides left on each auto-advance, then images swap
 * and the track slides back — creating a seamless sliding effect.
 * No buttons or controls. Isolated to the login page left panel.
 */
export function ImageCarousel({ images }: { images: CarouselImage[] }) {
  const [index, setIndex] = useState(0)
  const [slideX, setSlideX] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (images.length < 3) return
    intervalRef.current = setInterval(() => {
      // Slide track left
      setSlideX(-120)
      setTimeout(() => {
        // Swap images while track is offset
        setIndex((prev) => (prev + 1) % images.length)
        // Slide track back to center
        setSlideX(0)
      }, 400)
    }, 4000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [images.length])

  const prev = images[(index - 1 + images.length) % images.length]
  const current = images[index]
  const next = images[(index + 1) % images.length]

  return (
    <div className="login-carousel">
      <div className="login-carousel-track" style={{ transform: `translateX(${slideX}px)` }}>
        <div className="login-carousel-card prev">
          <img src={prev.src} alt={prev.alt} />
        </div>
        <div className="login-carousel-card current">
          <img src={current.src} alt={current.alt} />
        </div>
        <div className="login-carousel-card next">
          <img src={next.src} alt={next.alt} />
        </div>
      </div>
    </div>
  )
}
