import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CardapioEditor from './pages/CardapioEditor'
import PromocoesEditor from './pages/PromocoesEditor'
import AdminRestaurantes from './pages/AdminRestaurantes'
import AdminUsuarios from './pages/AdminUsuarios'
import Layout from './components/Layout'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/restaurante/:slug/cardapio" element={<CardapioEditor />} />
          <Route path="/restaurante/:slug/promocoes" element={<PromocoesEditor />} />
          <Route path="/admin/restaurantes" element={<ProtectedRoute adminOnly><AdminRestaurantes /></ProtectedRoute>} />
          <Route path="/admin/usuarios" element={<ProtectedRoute adminOnly><AdminUsuarios /></ProtectedRoute>} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
