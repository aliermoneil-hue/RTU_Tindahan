/**
 * AI-13 and AI-16: say, in plain language, that what a member writes is checked
 * automatically — and that the check is not a promise about quality or safety.
 *
 * One component so the wording cannot drift between the sign-up screen, the
 * listing form and the forum. The wording is deliberately short: a notice
 * nobody reads is not a notice.
 */
export function ScreeningNotice({ tone = 'compose' }: { tone?: 'auth' | 'compose' }) {
  const text =
    tone === 'auth'
      ? 'Listings, posts and comments are checked automatically for prohibited content before other students can see them. A moderator reviews anything the check flags.'
      : 'Checked automatically before it is published. The check looks for prohibited content only — it is not a guarantee of quality or safety.'

  return (
    <p className="small muted screening-note" role="note" data-screening-notice={tone}>
      {text}
    </p>
  )
}
