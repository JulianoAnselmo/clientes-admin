import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../firebase'
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'

export default function AdminRestaurantes() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function loadRestaurants() {
    const snap = await getDocs(collection(db, 'restaurants'))
    setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }

  useEffect(() => { loadRestaurants() }, [])

  function generateSlug(name) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function handleNameChange(name) {
    setForm(prev => ({ ...prev, name, slug: generateSlug(name) }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setCreating(true)

    try {
      // Create restaurant document
      await setDoc(doc(db, 'restaurants', form.slug), {
        name: form.name,
        slug: form.slug,
        createdAt: new Date().toISOString()
      })

      // Initialize empty cardapio and promocoes
      await setDoc(doc(db, 'restaurants', form.slug, 'data', 'cardapio'), {
        content: [],
        updatedAt: new Date().toISOString()
      })

      await setDoc(doc(db, 'restaurants', form.slug, 'data', 'promocoes'), {
        content: {
          domingo: [], segunda: [], terca: [], quarta: [],
          quinta: [], sexta: [], sabado: []
        },
        updatedAt: new Date().toISOString()
      })

      setForm({ name: '', slug: '' })
      setShowForm(false)
      loadRestaurants()
    } catch (err) {
      setError('Erro: ' + err.message)
    }
    setCreating(false)
  }

  async function handleDelete(slug, name) {
    if (!confirm(`Remover o restaurante "${name}"? Esta ação não pode ser desfeita.`)) return
    try {
      await deleteDoc(doc(db, 'restaurants', slug, 'data', 'cardapio'))
      await deleteDoc(doc(db, 'restaurants', slug, 'data', 'promocoes'))
      await deleteDoc(doc(db, 'restaurants', slug))
      loadRestaurants()
    } catch (err) {
      alert('Erro ao remover: ' + err.message)
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-slate-800">Gerenciar Restaurantes</h1>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/usuarios"
            className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition font-medium"
          >
            Usuários
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl transition font-medium"
          >
            {showForm ? 'Cancelar' : '+ Novo'}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-5 border border-slate-200 mb-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Novo Restaurante</h2>

          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>}

          <div>
            <label className="block text-xs text-slate-500 mb-1">Nome do restaurante</label>
            <input
              type="text"
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
              placeholder="Ex: Marieta Bistrô"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Slug (identificador único)</label>
            <input
              type="text"
              value={form.slug}
              onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none font-mono"
              placeholder="marieta-bistro"
              required
            />
          </div>

          <p className="text-xs text-slate-400">Para criar conta de acesso, use a página <Link to="/admin/usuarios" className="text-amber-600 underline">Usuários</Link> após criar o restaurante.</p>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition disabled:opacity-50"
          >
            {creating ? 'Criando...' : 'Criar Restaurante'}
          </button>
        </form>
      )}

      {/* Restaurant List */}
      <div className="space-y-3">
        {restaurants.map(r => (
          <div key={r.id} className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">{r.name}</h3>
              <p className="text-xs text-slate-400 font-mono">/{r.slug}</p>
            </div>
            <div className="flex gap-2">
              <Link
                to={`/restaurante/${r.slug}/cardapio`}
                className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition"
              >
                Cardápio
              </Link>
              <Link
                to={`/restaurante/${r.slug}/promocoes`}
                className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition"
              >
                Promoções
              </Link>
              <button
                onClick={() => handleDelete(r.slug, r.name)}
                className="text-xs px-3 py-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
