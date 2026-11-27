import type { PrototypeProduct } from '@/features/marketplace/types'
import { findVar, varLabel } from '@/features/marketplace/constants'

export interface ItemTitleWithVariantProps {
  /** Base title (without variant). If variant is baked into title, the full title is parsed. */
  title: string
  /** Variant label (e.g. "Red, Large"). If provided, title should be the base without variant. */
  variant?: string | null
  /** Product object (for looking up variant from vid) */
  product?: PrototypeProduct | null
  /** Variant ID (used with product to look up variant label) */
  vid?: string | null
  /** CSS class name for the title wrapper */
  className?: string
  /** HTML tag for the title wrapper */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'div' | 'b'
  /** Inline styles */
  style?: React.CSSProperties
}

export function ItemTitleWithVariant({
  title,
  variant,
  product,
  vid,
  className,
  as: As = 'span',
}: ItemTitleWithVariantProps) {
  // Resolve variant from product+vid if not directly provided
  let resolvedVariant = variant
  if (!resolvedVariant && product && vid) {
    const row = findVar(product, vid)
    if (row) resolvedVariant = varLabel(product, row)
  }

  // Handle baked-in variant in title (e.g. "Hoodie | Marcha Latte (ewqe, wqewqewq)")
  let baseTitle = title
  if (!resolvedVariant) {
    const bakedMatch = title.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
    if (bakedMatch) {
      baseTitle = bakedMatch[1].trim()
      resolvedVariant = bakedMatch[2].trim()
    }
  }

  return (
    <As className={className}>
      {baseTitle}
      {resolvedVariant && <span className="item-variant-text"> ({resolvedVariant})</span>}
    </As>
  )
}
