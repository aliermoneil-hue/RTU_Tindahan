import './Insights.css'
import Icon from './Icon'
import { TIPS } from '../data'
import { authHref } from '../config'

const TILES = [
  { icon: 'bowl', title: 'Food and snacks', text: 'Home-cooked snacks and drinks.', href: authHref('sign-in'), note: 'Sign in to browse' },
  { icon: 'book', title: 'Books and Academic Materials', text: 'Textbooks, lab manuals and reviewers.', href: '#/books', note: 'Open as a guest' },
  { icon: 'print', title: 'Student services', text: 'Printing, tutoring and other help.', href: authHref('sign-in'), note: 'Sign in to browse' },
  { icon: 'shirt', title: 'RTU Merchandise', text: 'Uniforms, bags and RTU keepsakes.', href: '#/merch', note: 'Open as a guest' },
]

/* Insights: what can be found on Tindahan, and three meetup tips. No numbers are shown, because this page has no live data. */
export default function Insights() {
  return (
    <section className="section alt" id="insights">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">Insights</span>
          <h2>What you can find on Tindahan</h2>
          <p className="small muted">Books and merchandise open to guests. The rest opens after you sign in.</p>
        </div>
        <div className="ins-tiles">
          {TILES.map((t) => (
            <a className="card ins-tile" key={t.title} href={t.href}>
              <span className="icon-box">
                <Icon name={t.icon} />
              </span>
              <b>{t.title}</b>
              <span className="small muted">{t.text}</span>
              <span className="ins-note small">
                {t.note}
                <Icon name="arrow" small />
              </span>
            </a>
          ))}
        </div>
        <div className="section-head ins-tips">
          <h3>Meetup tips</h3>
        </div>
        <div className="grid-3">
          {TIPS.map((t) => (
            <div className="card flat ins-tip" key={t.title}>
              <b>
                <Icon name={t.icon} small />
                {t.title}
              </b>
              <p className="small muted">{t.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
