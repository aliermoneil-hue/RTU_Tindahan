import './GuestBand.css'
import Icon from './Icon'

type Props = { onOpen: (which: 'guidelines' | 'policy') => void }

/* The framed two-column band from the Vite template: guest pages on the left, help on the right.
   It uses the template's ids (#next-steps, #docs, #social, #spacer) and its .ticks marks. */
export default function GuestBand({ onOpen }: Props) {
  return (
    <div className="frame">
      <div className="ticks" />
      <section id="next-steps">
        <div id="docs">
          <Icon name="eye" className="icon" />
          <h2>Look around as a guest</h2>
          <p>These two sections open without an account.</p>
          <ul>
            <li>
              <a href="#/books">
                <Icon name="book" small className="button-icon" />
                Books and Academic Materials
              </a>
            </li>
            <li>
              <a href="#/merch">
                <Icon name="shirt" small className="button-icon" />
                RTU Merchandise
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <Icon name="key" className="icon" />
          <h2>Need a hand first?</h2>
          <p>These pages explain the sign-up steps and the rules.</p>
          <ul>
            <li>
              <a href="#/verify-help">
                <Icon name="key" small className="button-icon" />
                Need help verifying?
              </a>
            </li>
            <li>
              <button type="button" onClick={() => onOpen('guidelines')}>
                <Icon name="note" small className="button-icon" />
                Community guidelines
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onOpen('policy')}>
                <Icon name="flag" small className="button-icon" />
                Prohibited items policy
              </button>
            </li>
          </ul>
        </div>
      </section>
      <div className="ticks" />
      <section id="spacer" />
    </div>
  )
}
