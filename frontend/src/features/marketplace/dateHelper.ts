import { cleanDays, isSvc, parseWindow } from './constants'
import type { PrototypeProduct } from './types'

export interface PickupDateOption {
  id: string // "2026-11-05"
  label: string // "Today, Nov 5"
  fullLabel: string // "Today, Nov 5 · 12:00 to 1:00 PM"
  isToday: boolean
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/**
 * Calculates selectable pickup/meetup dates for a buyer based on:
 * 1. The seller's available days (`product.avail`, e.g. Mon, Tue, Wed)
 * 2. Products vs Services rule:
 *    - Products: Can be ordered for today UNLESS the seller's meetup window has closed.
 *    - Services: Cannot be ordered for today; must be ordered in advance (tomorrow onwards).
 */
export function getPickupDates(
  product?: PrototypeProduct | null,
  referenceDate: Date = new Date(),
): {
  options: PickupDateOption[]
  todayStatus: 'available' | 'service_advance_only' | 'window_closed' | 'not_selling_day'
  windowEndText: string
} {
  if (!product) {
    return {
      options: [],
      todayStatus: 'window_closed',
      windowEndText: '',
    }
  }

  const rawAvail = cleanDays(product.avail)
  const availDays = rawAvail.length ? rawAvail : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const svc = isSvc(product)

  // Parse time window from product.when (e.g. "Main lobby, 12:00 to 1:00 PM")
  const whenPart = product.when && product.when.includes(',')
    ? product.when.split(',')[1].trim()
    : product.when || ''
  const parsedWin = parseWindow(whenPart)

  const curMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes()
  const isWindowClosed = parsedWin ? curMinutes >= parsedWin.e : false
  const windowEndText = whenPart

  const todayDayName = DAY_ABBR[referenceDate.getDay()]
  const isTodayAvailDay = availDays.includes(todayDayName)

  let todayStatus: 'available' | 'service_advance_only' | 'window_closed' | 'not_selling_day' =
    'available'

  if (svc) {
    todayStatus = 'service_advance_only'
  } else if (!isTodayAvailDay) {
    todayStatus = 'not_selling_day'
  } else if (isWindowClosed) {
    todayStatus = 'window_closed'
  }

  const options: PickupDateOption[] = []

  // Check up to 14 days ahead
  for (let i = 0; i < 14; i++) {
    const d = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() + i,
    )
    const dayName = DAY_ABBR[d.getDay()]
    if (!availDays.includes(dayName)) continue

    const isToday = i === 0

    // Apply rule:
    // Services cannot be ordered today (must be in advance)
    if (isToday && svc) continue
    // Products cannot be ordered today if window has closed
    if (isToday && isWindowClosed) continue

    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dayNum = String(d.getDate()).padStart(2, '0')
    const id = `${y}-${m}-${dayNum}`

    const monthName = d.toLocaleDateString('en-US', { month: 'short' })
    const label = isToday
      ? `Today, ${monthName} ${d.getDate()}`
      : i === 1
        ? `Tomorrow, ${monthName} ${d.getDate()}`
        : `${dayName}, ${monthName} ${d.getDate()}`

    const fullLabel = whenPart ? `${label} (${whenPart})` : label

    options.push({
      id,
      label,
      fullLabel,
      isToday,
    })

    if (options.length >= 7) break
  }

  return {
    options,
    todayStatus,
    windowEndText,
  }
}
