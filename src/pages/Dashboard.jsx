import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../firebase'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'

export default function Dashboard() {
  const { userData, isAdmin, user } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        if (isAdmin) {
          const snap = await getDocs(collection(db, 'restaurants'))
          setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        } else if (userData?.restaurantSlug) {
          const docRef = doc(db, 'restaurants', userData.restaurantSlug)
          const snap = await getDoc(docRef)
          if (snap.exists()) {
            setRestaurants([{ id: snap.id, ...snap.data() }])
          }
        }
      } catch (err) {
        console.error('Erro ao carregar restaurantes:', err)
      }
      setLoading(false)
    }
    if (userData) load()
  }, [userData, isAdmin])

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
        <h1 className="text-xl font-bold text-slate-800">
          {isAdmin ? 'Todos os Restaurantes' : 'Meu Restaurante'}
        </h1>
        {isAdmin && (
          <Link
            to="/admin/restaurantes"
            className="text-sm bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl transition font-medium"
          >
            + Novo
          </Link>
        )}
      </div>

      {restaurants.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg">Nenhum restaurante encontrado</p>
          {isAdmin && <p className="text-sm mt-1">Crie um novo restaurante para comecar</p>}
        </div>
      ) : (
        <div className="grid gap-4">
          {restaurants.map(r => (
            <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h2 className="font-semibold text-lg text-slate-800 mb-3">{r.name}</h2>
              <p className="text-xs text-slate-400 mb-4">/{r.slug}</p>
              <div className="flex gap-3">
                <Link
                  to={`/restaurante/${r.slug}/cardapio`}
                  className="flex-1 text-center py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-sm font-medium transition"
                >
                  Cardapio
                </Link>
                <Link
                  to={`/restaurante/${r.slug}/promocoes`}
                  className="flex-1 text-center py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-sm font-medium transition"
                >
                  Promocoes
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
