import AdminApp from './admin/AdminApp'

/* The admin area owns every URL under /admin. The student-facing screens
   (Sprint 2: router, auth, listings) will take over everything else. */
export default function App() {
  if (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')) {
    return <AdminApp />
  }
  return (
    <main style={{ maxWidth: 520, margin: '15vh auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>RTU Tindahan</h1>
      <p>The student marketplace is built in Sprint 2.</p>
      <p>
        Staff can open the <a href="/admin">admin area</a>.
      </p>
    </main>
  )
}
