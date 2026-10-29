import './Pages.css'
import Icon from '../components/Icon'
import { GUEST_PAGES } from '../data'
import { authHref } from '../config'

/* A guest section page (Books or Merchandise). This project has no listings data, so it shows an honest empty state. */
export default function GuestPage({ kind }: { kind: 'books' | 'merch' }) {
  const g = GUEST_PAGES[kind]
  return (
    <main className="page">
      <div className="wrap">
        <a className="back" href="#/">
          <Icon name="arrow" small />
          Back to home
        </a>
        <div className="page-head">
          <span className="eyebrow">{g.eyebrow}</span>
          <h1>{g.heading}</h1>
          <p className="muted">{g.blurb}</p>
        </div>
        <div className="card empty">
          <Icon name={g.icon} />
          <b>No listings to show here</b>
          <p className="small muted">
            This page is not connected to the RTU Tindahan listings, so nothing is posted yet. In the full prototype, approved
            listings appear here for guests.
          </p>
          <a className="btn yellow" href={authHref('sign-in')}>
            Sign in to see more
          </a>
        </div>
        {g.tips.length > 0 && (
          <div className="card flat tips-card">
            <b>{g.tipsTitle}</b>
            <ul className="small">
              {g.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  )
}
