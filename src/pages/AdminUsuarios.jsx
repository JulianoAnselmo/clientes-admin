import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db, secondaryAuth } from '../firebase'
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'

export default function AdminUsuarios() {
  const [users, setUsers] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', displayName: '', restaurantSlug: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Edição de vínculo
  const [editingUser, setEditingUser] = useState(null)
  const [editSlug, setEditSlug] = useState('')

  async function loadData() {
    const [usersSnap, restSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'restaurants'))
    ])
    setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    setRestaurants(restSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function getRestaurantName(slug) {
    const r = restaurants.find(r => r.slug === slug)
    return r ? r.name : slug || '—'
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCreating(true)

    try {
      // Cria o usuário na segunda instância (não desloga o admin)
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, form.email, form.password
      )

      // Cria o documento do usuário no Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: form.email,
        displayName: form.displayName || form.email.split('@')[0],
        role: 'client',
        restaurantSlug: form.restaurantSlug || null,
        createdAt: new Date().toISOString()
      })

      // Se vinculou a um restaurante, atualiza o ownerId
      if (form.restaurantSlug) {
        await updateDoc(doc(db, 'restaurants', form.restaurantSlug), {
          ownerId: userCredential.user.uid
        })
      }

      // Desloga da instância secundária
      await signOut(secondaryAuth)

      setSuccess(`Usuário ${form.email} criado com sucesso!`)
      setForm({ email: '', password: '', displayName: '', restaurantSlug: '' })
      setShowForm(false)
      loadData()
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email já está em uso.')
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.')
      } else {
        setError('Erro: ' + err.message)
      }
    }
    setCreating(false)
  }

  async function handleUpdateSlug(userId) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        restaurantSlug: editSlug || null
      })

      // Atualiza o ownerId no restaurante
      if (editSlug) {
        await updateDoc(doc(db, 'restaurants', editSlug), {
          ownerId: userId
        })
      }

      setEditingUser(null)
      setEditSlug('')
      setSuccess('Vínculo atualizado!')
      setTimeout(() => setSuccess(''), 3000)
      loadData()
    } catch (err) {
      setError('Erro ao atualizar: ' + err.message)
    }
  }

  async function handleDeleteUser(userId, email) {
    if (!confirm(`Remover o usuário "${email}" do sistema? (a conta Firebase Auth continuará existindo, mas perderá acesso ao painel)`)) return
    try {
      await deleteDoc(doc(db, 'users', userId))
      loadData()
    } catch (err) {
      alert('Erro: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/admin/restaurantes" className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-slate-800">Gerenciar Usuários</h1>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
          className="text-sm bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl transition font-medium"
        >
          {showForm ? 'Cancelar' : '+ Novo Usuário'}
        </button>
      </div>

      {success && <div className="bg-green-50 text-green-600 text-sm rounded-lg p-3 mb-4">{success}</div>}
      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>}

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-5 border border-slate-200 mb-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Novo Usuário</h2>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Nome</label>
            <input
              type="text"
              value={form.displayName}
              onChange={e => setForm(prev => ({ ...prev, displayName: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
              placeholder="Ex: Ricardo Vagner"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
              placeholder="cliente@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Senha inicial (mín. 6 caracteres)</label>
            <input
              type="text"
              value={form.password}
              onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
              placeholder="senha123"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Vincular a restaurante</label>
            <select
              value={form.restaurantSlug}
              onChange={e => setForm(prev => ({ ...prev, restaurantSlug: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none bg-white"
            >
              <option value="">— Nenhum (vincular depois) —</option>
              {restaurants.map(r => (
                <option key={r.slug} value={r.slug}>{r.name}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition disabled:opacity-50"
          >
            {creating ? 'Criando...' : 'Criar Usuário'}
          </button>
        </form>
      )}

      {/* Users List */}
      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="bg-white rounded-2xl p-4 border border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">{u.displayName || u.email}</h3>
                  {u.role === 'admin' && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">ADMIN</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{u.email}</p>
              </div>
              {u.role !== 'admin' && (
                <button
                  onClick={() => handleDeleteUser(u.id, u.email)}
                  className="text-xs text-red-400 hover:text-red-600 transition"
                >
                  Remover
                </button>
              )}
            </div>

            {/* Vínculo com restaurante */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              {editingUser === u.id ? (
                <div className="flex items-center gap-2">
                  <select
                    value={editSlug}
                    onChange={e => setEditSlug(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-amber-500 outline-none bg-white"
                  >
                    <option value="">— Sem restaurante —</option>
                    {restaurants.map(r => (
                      <option key={r.slug} value={r.slug}>{r.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleUpdateSlug(u.id)}
                    className="text-xs px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingUser(null)}
                    className="text-xs px-3 py-2 text-slate-400 hover:text-slate-600 transition"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-slate-500">Restaurante: </span>
                    <span className={u.restaurantSlug ? 'text-slate-800 font-medium' : 'text-slate-400 italic'}>
                      {u.restaurantSlug ? getRestaurantName(u.restaurantSlug) : 'Não vinculado'}
                    </span>
                  </div>
                  {u.role !== 'admin' && (
                    <button
                      onClick={() => { setEditingUser(u.id); setEditSlug(u.restaurantSlug || '') }}
                      className="text-xs text-amber-600 hover:text-amber-700 transition font-medium"
                    >
                      Alterar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
