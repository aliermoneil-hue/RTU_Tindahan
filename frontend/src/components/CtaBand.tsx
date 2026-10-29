import './CtaBand.css'
import { authHref } from '../config'

/* The closing band above the footer. */
export default function CtaBand() {
  return (
    <section className="cta-band">
      <div className="wrap cta-in">
        <div>
          <h2>Ready to trade on campus?</h2>
          <p className="small">Create your RTU account in a few minutes and start browsing.</p>
        </div>
        <div className="cta-actions">
          <a className="btn yellow lg" href={authHref('create-account')}>
            Create your account
          </a>
          <a className="btn ghost lg" href={authHref('sign-in')}>
            Sign in
          </a>
        </div>
      </div>
    </section>
  )
}
