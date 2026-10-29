import './Footer.css'
import logo from '../assets/logo.png'
import { authHref, config } from '../config'

type Props = {
  onSection: (id: string) => void
  onOpen: (which: 'guidelines' | 'policy') => void
}

/* The guest footer: short description, quick links and help links. */
export default function Footer({ onSection, onOpen }: Props) {
  const year = new Date().getFullYear()
  return (
    <footer className="foot" aria-label="Site footer">
      <div className="wrap foot-grid">
        <div className="foot-brand">
          <img src={logo} alt="RTU Tindahan Campus Marketplace" />
          <p className="small">
            A student marketplace for the RTU Pasig Campus. Students buy, sell and offer services, then meet on campus. There is
            no online payment and no delivery.
          </p>
        </div>
        <nav aria-label="Quick links">
          <h3>Quick links</h3>
          <ul>
            <li>
              <button type="button" onClick={() => onSection('about')}>
                About Us
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onSection('insights')}>
                Insights
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onSection('help')}>
                Need Help?
              </button>
            </li>
            <li>
              <a href={authHref('sign-in')}>Sign in</a>
            </li>
            <li>
              <a href={authHref('create-account')}>Create account</a>
            </li>
          </ul>
        </nav>
        <nav aria-label="Help">
          <h3>Help</h3>
          <ul>
            <li>
              <a href="#/verify-help">Need help verifying?</a>
            </li>
            <li>
              <button type="button" onClick={() => onOpen('guidelines')}>
                Community guidelines
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onOpen('policy')}>
                Prohibited items policy
              </button>
            </li>
            {config.contactEmail && (
              <li>
                <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
              </li>
            )}
          </ul>
        </nav>
      </div>
      <div className="wrap foot-base small">
        © {year} RTU Tindahan. A student capstone prototype for the Pasig Campus community.
      </div>
    </footer>
  )
}
