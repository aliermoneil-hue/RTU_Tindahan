import './About.css'
import Icon from './Icon'
import { BENEFITS, STEPS } from '../data'

/* About Us: what RTU Tindahan is, three benefit cards, and how a pickup works. */
export default function About() {
  return (
    <section className="section" id="about">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">About Us</span>
          <h2>A campus marketplace made by and for RTU students</h2>
          <p className="small muted about-intro">
            RTU Tindahan helps students on the Pasig Campus find what they need from people they can meet in person. Every
            account is checked, every listing is reviewed by staff, and every deal ends with a handshake on campus.
          </p>
        </div>
        <div className="grid-3">
          {BENEFITS.map((b) => (
            <div className="card about-card" key={b.title}>
              <span className="icon-box">
                <Icon name={b.icon} />
              </span>
              <b>{b.title}</b>
              <p className="small muted">{b.text}</p>
            </div>
          ))}
        </div>
        <div className="section-head about-how">
          <span className="eyebrow">How it works</span>
          <h2>Request, agree, meet on campus</h2>
        </div>
        <div className="grid-3">
          {STEPS.map((s, i) => (
            <div className="card flat about-step" key={s.title}>
              <span className="pill navy">Step {i + 1}</span>
              <b>
                <Icon name={s.icon} small />
                {s.title}
              </b>
              <p className="small muted">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
