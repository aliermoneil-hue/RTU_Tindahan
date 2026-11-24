import { Icon } from '@/common/components/Icon'

/**
 * CF-05: a Selling schedule post is an appointment, so the appointment is shown
 * as one — day, window and place — on the card and on the post itself, rather
 * than left in the prose for a reader to find.
 */
export function ScheduleLine({
  date,
  start,
  end,
  place,
}: {
  date?: string | null
  start?: string | null
  end?: string | null
  place?: string | null
}) {
  if (!date || !start) return null

  const day = new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const clock = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number)
    if (Number.isNaN(hours)) return value
    const stamp = new Date()
    stamp.setHours(hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0)
    return stamp.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  }

  const window = end ? `${clock(start)}–${clock(end)}` : clock(start)

  return (
    <p className="small schedule-line" data-schedule-line>
      <Icon name="cal" size="sm" /> Selling {day} · {window}
      {place ? ` · ${place}` : ''}
    </p>
  )
}
