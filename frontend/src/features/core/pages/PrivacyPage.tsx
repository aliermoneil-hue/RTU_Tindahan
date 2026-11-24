/**
 * PR-01: the privacy notice, in the application.
 *
 * The long version is `docs/PRIVACY.md`. This is the same promise in the words
 * a student actually reads: what we keep, why, who sees it, how long, and how
 * to get out. It is linked from the sign-up checkbox, the sign-in page and the
 * Help Center, so the promise is visible exactly where the data is given.
 */
export function PrivacyPage() {
  return (
    <div className="section">
      <div className="card stack" style={{ gap: 14, maxWidth: 760, margin: '0 auto' }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="tiny muted" style={{ letterSpacing: '.08em' }}>RTU TINDAHAN</span>
          <h2 style={{ margin: 0 }}>Privacy notice</h2>
          <p className="small muted" style={{ margin: 0 }}>
            How this campus marketplace handles your data, under the Data Privacy Act of 2012
            (RA 10173).
          </p>
        </div>

        <Section title="What we keep, and why">
          Your RTU email is your account and receives the verification code. Your name is what the
          other side of a sale sees so you can meet. Program and year level are campus context. A
          contact number is optional: it exists only so two people can arrange a meet-up, it appears
          only when an order is accepted, and it disappears again when the order closes.
        </Section>

        <Section title="What we never collect">
          No student number, no birthdate, no home address, no government ID. The Official Store's
          mail is built without your student number and name.
        </Section>

        <Section title="What we never do with it">
          No advertising, no tracking, no selling. The only outside service is the screening step:
          when you post a listing or a forum post, its <b>text</b> is sent to a language model to
          check it against the posting guideline — no email, no name, no number, no photo. If the
          model is down, a local rules check answers and nothing leaves the server.
        </Section>

        <Section title="Who can see what">
          Approved listings and the forum are public. Office Staff see the Official Store's tickets
          and stock. Moderators see held and reported content and the reason for a report, but never
          who reported whom. Every staff action that changes something is written to an audit log
          with the person's name on it.
        </Section>

        <Section title="How long we keep it">
          Finished orders and their reviews: two years, then purged on a schedule. Read
          notifications: 90 days. Requests that are still open are never purged — a live obligation
          is not housekeeping. Sign-ins end after 30 minutes of no activity or 14 days.
        </Section>

        <Section title="Your rights">
          You can see and correct your details in Profile. You can delete your account from Profile:
          if you have no listings or store tickets it is removed; if other people rely on your
          history, the account is deactivated and your name, email, contact number and photo are
          scrubbed, so nobody keeps your data but the record stays honest. To object to how your data
          is used, or to complain, contact the capstone's data protection contact — the project
          adviser — or the National Privacy Commission.
        </Section>

        <p className="small muted" style={{ margin: 0 }}>
          The full statement, including what is verified by tests, is in <code>docs/PRIVACY.md</code>.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      <b>{title}</b>
      <p className="small" style={{ margin: 0 }}>{children}</p>
    </div>
  )
}
