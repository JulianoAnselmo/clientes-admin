import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { userData, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center text-sm font-bold">G</div>
            <span className="font-semibold text-slate-800 hidden sm:block">Gestao</span>
          </Link>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                to="/admin/restaurantes"
                className={`text-xs px-3 py-1.5 rounded-full transition ${
                  location.pathname.startsWith('/admin')
                    ? 'bg-amber-100 text-amber-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Admin
              </Link>
            )}
            <span className="text-xs text-slate-400 hidden sm:block">{userData?.email}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-500 hover:text-red-500 transition px-2 py-1"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
