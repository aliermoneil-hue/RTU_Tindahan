import { useId } from 'react'

import './Banderitas.css'

export type BanderitasVariant =
  | 'corner-left'
  | 'corner-right'
  | 'canopy'
  | 'garland'
  | 'mini'
  | 'header'

interface BanderitasProps {
  variant?: BanderitasVariant
  opacity?: number
  className?: string
  surface?: 'dark' | 'light'
  compact?: boolean
}

/** Brand colors for dark (navy) surfaces — cream flag pops on dark. */
const DARK_SURFACE_COLORS = ['#f4b63a', '#c84b4b', '#2563eb', '#fffaf0']
/** Brand colors for light/white surfaces — navy flag replaces cream so no white-on-white. */
const LIGHT_SURFACE_COLORS = ['#f4b63a', '#c84b4b', '#2563eb', '#1a2f57']

/** Irregular header strands: 1400px tile rendered twice for a 2800px repeat.
 * Each strand starts/ends at y 0-6 along the header edge; deepest flag tip stays at or above y=40.
 */
const HEADER_STRANDS: {
  p0: [number, number]
  p1: [number, number]
  p2: [number, number]
  count: number
  flagWidth: number
  flagHeight: number
  opacity?: number
}[] = [
  { p0: [-10, 0], p1: [80, 44], p2: [175, 2], count: 6, flagWidth: 14, flagHeight: 15, opacity: 1 },
  { p0: [165, 2], p1: [228, 22], p2: [292, 0], count: 4, flagWidth: 12, flagHeight: 13, opacity: 0.95 },
  { p0: [330, 0], p1: [372, 18], p2: [412, 0], count: 3, flagWidth: 11, flagHeight: 12, opacity: 0.9 },
  { p0: [470, 0], p1: [585, 50], p2: [700, 0], count: 8, flagWidth: 14, flagHeight: 15, opacity: 1 },
  { p0: [650, 1], p1: [715, 28], p2: [780, 3], count: 4, flagWidth: 12, flagHeight: 13, opacity: 0.8 },
  { p0: [860, 0], p1: [905, 20], p2: [950, 0], count: 3, flagWidth: 11, flagHeight: 12, opacity: 0.9 },
  { p0: [1010, 0], p1: [1100, 46], p2: [1195, 2], count: 6, flagWidth: 14, flagHeight: 14, opacity: 1 },
  { p0: [1180, 2], p1: [1245, 24], p2: [1310, 0], count: 4, flagWidth: 12, flagHeight: 13, opacity: 0.85 },
  { p0: [1290, 0], p1: [1345, 36], p2: [1410, 6], count: 4, flagWidth: 13, flagHeight: 14, opacity: 0.9 },
]

/** Build pennant polygons whose top edge sits flush on a quadratic Bezier curve. */
function buildPennants(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  count: number,
  flagWidth: number,
  flagHeight: number,
  colors: string[],
) {
  const pt = (t: number): [number, number] => {
    const u = 1 - t
    return [
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]
  }
  const tan = (t: number): [number, number] => [
    2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]),
    2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]),
  ]

  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count
    const [cx, cy] = pt(t)
    const [tx, ty] = tan(t)
    const len = Math.hypot(tx, ty) || 1
    const ux = tx / len
    const uy = ty / len
    let nx = -uy
    let ny = ux
    if (ny < 0) {
      nx = -nx
      ny = -ny
    }
    const half = flagWidth / 2
    const x1 = cx - ux * half
    const y1 = cy - uy * half
    const x2 = cx + ux * half
    const y2 = cy + uy * half
    const x3 = cx + nx * flagHeight
    const y3 = cy + ny * flagHeight
    return {
      points: `${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x3.toFixed(1)},${y3.toFixed(1)}`,
      fill: colors[i % colors.length],
    }
  })
}

/** Build bulb positions along a quadratic Bezier strand (night-market string lights). */
function buildBulbs(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  count: number,
) {
  const pt = (t: number): [number, number] => {
    const u = 1 - t
    return [
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]
  }
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count
    const [cx, cy] = pt(t)
    return { cx, cy, delay: `${((i * 0.43) % 2.6).toFixed(2)}s` }
  })
}

/** Render one curved strand with both pennants (light mode) and lights (dark mode). */
function Strand({
  p0,
  p1,
  p2,
  count,
  flagWidth,
  flagHeight,
  opacity = 1,
  colors = DARK_SURFACE_COLORS,
  glowId,
  compact = false,
}: {
  p0: [number, number]
  p1: [number, number]
  p2: [number, number]
  count: number
  flagWidth: number
  flagHeight: number
  opacity?: number
  colors?: string[]
  glowId: string
  compact?: boolean
}) {
  const pennants = buildPennants(p0, p1, p2, count, flagWidth, flagHeight, colors)
  const bulbs = buildBulbs(p0, p1, p2, count)
  return (
    <g style={{ opacity }}>
      <path
        className="banderitas-string"
        d={`M ${p0[0]},${p0[1]} Q ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`}
        fill="none"
        stroke="rgba(225, 195, 145, 0.85)"
        strokeWidth="1.8"
        strokeLinecap="round"
        vector-effect="non-scaling-stroke"
      />
      <g className="banderitas-pennants">
        {pennants.map((p, i) => (
          <polygon
            key={`p-${i}`}
            className="banderitas-flag"
            data-i={i}
            points={p.points}
            fill={p.fill}
            stroke="rgba(0, 0, 0, 0.08)"
            strokeWidth="0.5"
            vector-effect="non-scaling-stroke"
            style={{ animationDelay: `${(i % 5) * 0.28}s` }}
          />
        ))}
      </g>
      <g className="banderitas-lights">
        {bulbs.map((b, i) => (
          <g key={`b-${i}`}>
            <line
              x1={b.cx}
              y1={b.cy}
              x2={b.cx}
              y2={b.cy + 5}
              className="banderitas-socket"
            />
            <circle
              cx={b.cx}
              cy={b.cy + 8}
              r={compact ? 11 : 14}
              fill={`url(#bulb-glow-${glowId})`}
              className="banderitas-halo"
              style={{ animationDelay: b.delay }}
            />
            <circle
              cx={b.cx}
              cy={b.cy + 8}
              r={compact ? 2.6 : 3.4}
              className="banderitas-bulb"
              style={{ animationDelay: b.delay }}
            />
          </g>
        ))}
      </g>
    </g>
  )
}

export function Banderitas({
  variant = 'garland',
  opacity = 0.9,
  className,
  surface = 'dark',
  compact = false,
}: BanderitasProps) {
  const s = opacity
  const lightCls = surface === 'light' ? ' banderitas--light' : ''
  const compactCls = compact ? ' banderitas--compact' : ''
  const cls = `banderitas banderitas--${variant}${className ? ` ${className}` : ''}${lightCls}${compactCls}`
  const colors = surface === 'light' ? LIGHT_SURFACE_COLORS : DARK_SURFACE_COLORS
  const glowId = useId().replace(/:/g, '')

  const defs = (
    <defs>
      <radialGradient id={`bulb-glow-${glowId}`}>
        <stop offset="0%" stopColor="#fff4c2" stopOpacity={0.95} />
        <stop offset="30%" stopColor="#f5b942" stopOpacity={0.55} />
        <stop offset="70%" stopColor="#e59a24" stopOpacity={0.14} />
        <stop offset="100%" stopColor="#e59a24" stopOpacity={0} />
      </radialGradient>
    </defs>
  )

  if (variant === 'corner-left' && compact) {
    return (
      <svg
        className={cls}
        aria-hidden="true"
        style={{ opacity: s }}
        viewBox="0 0 150 65"
        preserveAspectRatio="none"
      >
        {defs}
        <Strand p0={[-4, 46]} p1={[66, 34]} p2={[136, -4]} count={5} flagWidth={18} flagHeight={20} colors={colors} glowId={glowId} compact />
      </svg>
    )
  }

  if (variant === 'corner-left') {
    return (
      <svg
        className={cls}
        aria-hidden="true"
        style={{ opacity: s }}
        viewBox="0 0 260 120"
        preserveAspectRatio="none"
      >
        {defs}
        <Strand p0={[-6, 96]} p1={[115, 68]} p2={[250, -6]} count={8} flagWidth={22} flagHeight={26} colors={colors} glowId={glowId} />
        <Strand p0={[-6, 48]} p1={[70, 38]} p2={[145, -6]} count={5} flagWidth={18} flagHeight={21} opacity={0.72} colors={colors} glowId={glowId} />
      </svg>
    )
  }

  if (variant === 'corner-right' && compact) {
    return (
      <svg
        className={cls}
        aria-hidden="true"
        style={{ opacity: s }}
        viewBox="0 0 150 65"
        preserveAspectRatio="none"
      >
        {defs}
        <Strand p0={[14, -4]} p1={[84, 34]} p2={[154, 46]} count={5} flagWidth={18} flagHeight={20} colors={colors} glowId={glowId} compact />
      </svg>
    )
  }

  if (variant === 'corner-right') {
    return (
      <svg
        className={cls}
        aria-hidden="true"
        style={{ opacity: s }}
        viewBox="0 0 260 130"
        preserveAspectRatio="none"
      >
        {defs}
        <Strand p0={[10, -6]} p1={[140, 76]} p2={[266, 112]} count={9} flagWidth={22} flagHeight={26} colors={colors} glowId={glowId} />
        <Strand p0={[110, -6]} p1={[190, 42]} p2={[266, 54]} count={5} flagWidth={18} flagHeight={21} opacity={0.72} colors={colors} glowId={glowId} />
      </svg>
    )
  }

  if (variant === 'canopy') {
    return (
      <svg
        className={cls}
        aria-hidden="true"
        style={{ opacity: s }}
        viewBox="0 0 1200 170"
        preserveAspectRatio="xMidYMin slice"
      >
        {defs}
        <Strand p0={[-10, 115]} p1={[240, 65]} p2={[520, -6]} count={13} flagWidth={24} flagHeight={26} colors={colors} glowId={glowId} />
        <Strand p0={[640, -6]} p1={[940, 85]} p2={[1210, 135]} count={14} flagWidth={24} flagHeight={26} colors={colors} glowId={glowId} />
        <Strand p0={[-10, 18]} p1={[600, 68]} p2={[1210, 12]} count={24} flagWidth={20} flagHeight={20} opacity={0.55} colors={colors} glowId={glowId} />
      </svg>
    )
  }

  if (variant === 'garland') {
    return (
      <svg
        className={cls}
        aria-hidden="true"
        style={{ opacity: s }}
        viewBox="0 0 1200 48"
      >
        {defs}
        <Strand p0={[0, 2]} p1={[200, 24]} p2={[400, 4]} count={11} flagWidth={22} flagHeight={18} colors={colors} glowId={glowId} />
        <Strand p0={[400, 4]} p1={[600, 24]} p2={[800, 4]} count={11} flagWidth={22} flagHeight={18} colors={colors} glowId={glowId} />
        <Strand p0={[800, 4]} p1={[1000, 24]} p2={[1200, 2]} count={11} flagWidth={22} flagHeight={18} colors={colors} glowId={glowId} />
      </svg>
    )
  }

  // header: irregular strands hanging from the top bar edge, repeated to 2800px
  if (variant === 'header') {
    return (
      <svg
        className={cls}
        aria-hidden="true"
        style={{ opacity: s }}
        viewBox="0 0 2800 44"
      >
        {defs}
        {HEADER_STRANDS.map((strand, i) => (
          <Strand key={`s-${i}`} {...strand} colors={colors} glowId={glowId} compact />
        ))}
        <g transform="translate(1400 0)">
          {HEADER_STRANDS.map((strand, i) => (
            <Strand key={`r-${i}`} {...strand} colors={colors} glowId={glowId} compact />
          ))}
        </g>
      </svg>
    )
  }

  // mini: compact 5-flag curved accent
  return (
    <svg
      className={cls}
      aria-hidden="true"
      style={{ opacity: s }}
      viewBox="0 0 140 32"
      preserveAspectRatio="none"
    >
      {defs}
      <Strand p0={[4, 4]} p1={[70, 18]} p2={[136, 4]} count={5} flagWidth={18} flagHeight={16} colors={colors} glowId={glowId} />
    </svg>
  )
}
