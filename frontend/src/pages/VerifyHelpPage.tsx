import './Pages.css'
import Icon from '../components/Icon'
import { VERIFY_STEPS } from '../data'
import { authHref } from '../config'

/* Sign-up help: the steps for creating and verifying an account. */
export default function VerifyHelpPage() {
  return (
    <main className="page">
      <div className="wrap page-narrow">
        <a className="back" href="#/">
          <Icon name="arrow" small />
          Back to home
        </a>
        <div className="page-head">
          <span className="eyebrow">Sign-up help</span>
          <h1>How to verify your account</h1>
          <p className="muted">Only verified RTU members can trade. These are the steps.</p>
        </div>
        <div className="card">
          <ol className="steps-list">
            {VERIFY_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        <p className="form-foot" style={{ marginTop: 16 }}>
          Ready? <a href={authHref('create-account')}>Create your account</a>
        </p>
      </div>
    </main>
  )
}
