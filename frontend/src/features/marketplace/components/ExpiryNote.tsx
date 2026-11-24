/**
 * OT-12: a request is a clock, not a promise. This says how long is left, in
 * hours while it is far away and in minutes when it is close, so nobody is
 * surprised when the seller's silence cancels it.
 */
export function ExpiryNote({ expiresAt }: { expiresAt?: string | null }) {
  if (!expiresAt) return null
  const deadline = new Date(expiresAt).getTime()
  if (Number.isNaN(deadline)) return null
  const left = deadline - Date.now()
  if (left <= 0) return <span className="tiny muted">expiring now</span>

  const hours = Math.floor(left / 3_600_000)
  const minutes = Math.floor((left % 3_600_000) / 60_000)
  const text =
    hours >= 1 ? `expires in ${hours} h` : `expires in ${Math.max(1, minutes)} min`

  return <span className="tiny muted">{text}</span>
}
