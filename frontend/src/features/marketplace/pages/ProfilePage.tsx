import { Icon } from '@/common/components/Icon'
import { useAuth } from '@/features/authentication'
import { DAYS, monthYear } from '../constants'
import { useTindahan } from '../context/TindahanContext'
import { AvatarBadge } from '../components/AvatarBadge'
import { ProfileSettings } from '../components/ProfileSettings'
import { useProfileSettings } from '../profileSettingsStore'
import './ProfilePage.css'

export function ProfilePage() {
  const { user } = useAuth()
  const {
    db,
    currentAccount,
    toggleSellingWindow,
    openModal,
  } = useTindahan()

  if (!currentAccount) return null

  const { privacy } = useProfileSettings(currentAccount.email)

  const ann = db.ann || []
  const pickedOrders = (currentAccount.orders || []).filter(
    (o) => o.tab === 'Completed',
  ).length
  const completedPickups = (currentAccount.sellerReq || []).filter(
    (r) => r.state === 'done',
  ).length

  const showContact = privacy.showContact

  const verifRows: [string, string][] = [
    ['RTU email (@rtu.edu.ph)', 'Confirmed'],
    [`Student ID (${currentAccount.sid})`, 'On file'],
    ['Campus affiliation', 'Pasig Campus'],
    ...(user?.year_level != null ? ([['Year level', `Year ${user.year_level}`]] as [string, string][]) : []),
    ...(showContact && user?.contact_number ? ([['Contact number', user.contact_number]] as [string, string][]) : []),
    ['Account status', 'Good standing'],
  ]

  return (
    <>
      <div>
        <span className="eyebrow">CAMPUS PROFILE</span>
        <h1>Your verified RTU profile</h1>
        <p className="muted small">
          Shown to other verified RTU students when you buy or sell on campus.
        </p>
      </div>

      {/* Announcements card */}
      <div className="card stack">
        <div className="row between wrap">
          <div className="row">
            <span className="pill yellow">
              <Icon name="mega" size="sm" />
              Announcements
            </span>
            <span className="tiny muted">From the RTU Office of Student Affairs</span>
          </div>
          {ann.length > 0 && (
            <button
              type="button"
              className="link"
              onClick={() => openModal({ kind: 'archive' })}
            >
              View archive
            </button>
          )}
        </div>

        {ann.length ? (
          <>
            <div
              className="card flat"
              style={{
                background: 'var(--navy)',
                color: '#fff',
                border: 0,
                display: 'flex',
                gap: 14,
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ maxWidth: 640 }}>
                <span className="tiny" style={{ opacity: 0.75 }}>
                  FEATURED · {ann[0].d}
                </span>
                <h3 style={{ marginTop: 2 }}>{ann[0].t}</h3>
                <p className="small" style={{ opacity: 0.85, marginTop: 4 }}>
                  {ann[0].b}
                </p>
              </div>
              <button
                type="button"
                className="btn yellow sm"
                onClick={() => openModal({ kind: 'announcement', title: ann[0].t })}
              >
                Read more
              </button>
            </div>

            {ann.length > 1 && (
              <div className="grid2">
                {ann.slice(1, 3).map((a, idx) => (
                  <button
                    key={a.id || idx}
                    type="button"
                    className="card flat stack"
                    style={{ textAlign: 'left', gap: 4 }}
                    onClick={() => openModal({ kind: 'announcement', title: a.t })}
                  >
                    <span className="tiny muted">Office of Student Affairs · {a.d}</span>
                    <b>{a.t}</b>
                    <span className="small muted">{a.b}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="small muted">
            No announcements yet. Notices posted by RTU staff in Staff tools will show up here.
          </p>
        )}
      </div>

      {/* Main profile two-column grid */}
      <div className="profile-two two">
        <div className="card stack">
          <div className="row" style={{ gap: 14 }}>
            <AvatarBadge
              account={currentAccount}
              photoUrl={user?.profile_photo || null}
              size="xl"
            />
            <div>
              <h2 style={{ fontSize: 19 }}>{currentAccount.name}</h2>
              <div className="small muted">
                {currentAccount.prog} · Pasig Campus
              </div>
            </div>
          </div>

          <div className="grid2">
            <div className="card flat" style={{ background: 'var(--bg)' }}>
              <span className="tiny muted">ORDERS PICKED UP</span>
              <br />
              <b className="tnum" style={{ fontSize: 20 }}>
                {pickedOrders}
              </b>
            </div>
            <div className="card flat" style={{ background: 'var(--bg)' }}>
              <span className="tiny muted">PICKUPS COMPLETED</span>
              <br />
              <b className="tnum" style={{ fontSize: 20 }}>
                {completedPickups}
              </b>
            </div>
          </div>

          <div className="tiny muted">
            Member since {monthYear(currentAccount.since)} · Student no.{' '}
            <b className="tnum">{currentAccount.sid}</b>
          </div>

          <button
            type="button"
            className="btn ghost block"
            onClick={() => openModal({ kind: 'edit-profile' })}
          >
            <Icon name="edit" size="sm" />
            Edit profile
          </button>
        </div>

        <div className="stack">
          <div className="card stack">
            <b>Verification status</b>
            {verifRows.map((x) => (
              <div key={x[0]} className="row between small wrap">
                <span>{x[0]}</span>
                <span className="pill green">
                  <Icon name="check" size="sm" />
                  {x[1]}
                </span>
              </div>
            ))}
          </div>

          <div className="card stack">
            <div className="row between">
              <b>Transaction record</b>
              <button
                type="button"
                className="link"
                onClick={() => openModal({ kind: 'export-record' })}
              >
                Export record
              </button>
            </div>
            <p className="small muted">
              Your completed campus meetups are logged for both sides in case the Student Affairs
              office ever needs to check a dispute.
            </p>
          </div>

          <div className="card stack">
            <b>Default selling windows</b>
            <p className="small muted">
              Pre-fills your preferred days when you create a new listing.
            </p>
            <div className="daypick" role="group" aria-label="Default selling days">
              {DAYS.map((day) => {
                const on = currentAccount.windows.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    className={`btn sm ${on ? '' : 'ghost'}`.trim()}
                    aria-pressed={on}
                    onClick={() => toggleSellingWindow(day)}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
            {currentAccount.windows.length > 0 ? (
              <p className="tiny muted">
                Saved automatically. New listings start with {currentAccount.windows.join(', ')}.
              </p>
            ) : (
              <p className="tiny muted">
                No days selected. New listings start with Mon, Tue.
              </p>
            )}
          </div>
          <ProfileSettings />
        </div>
      </div>
    </>
  )
}
