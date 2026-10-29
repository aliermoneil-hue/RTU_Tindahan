import './Help.css'
import Icon from './Icon'
import { FAQ } from '../data'
import { config } from '../config'

type Props = { onOpen: (which: 'guidelines' | 'policy') => void }

/* Need Help?: questions that open and close, and a side card with links. */
export default function Help({ onOpen }: Props) {
  return (
    <section className="section" id="help">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">Need Help?</span>
          <h2>Answers before you sign in</h2>
        </div>
        <div className="help-grid">
          <div className="help-faq">
            {FAQ.map(([q, a]) => (
              <details className="card help-q" key={q}>
                <summary>
                  {q}
                  <Icon name="chev" small />
                </summary>
                <p className="small muted">{a}</p>
              </details>
            ))}
          </div>
          <aside className="card help-aside">
            <b>Still stuck?</b>
            <p className="small muted">These pages explain the rules and the sign-up steps.</p>
            <a className="btn ghost" href="#/verify-help">
              <Icon name="key" small />
              Need help verifying?
            </a>
            <button type="button" className="btn ghost" onClick={() => onOpen('guidelines')}>
              <Icon name="note" small />
              Community guidelines
            </button>
            <button type="button" className="btn ghost" onClick={() => onOpen('policy')}>
              <Icon name="flag" small />
              Prohibited items policy
            </button>
            {config.contactEmail && (
              <p className="small">
                Email: <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
              </p>
            )}
          </aside>
        </div>
      </div>
    </section>
  )
}
