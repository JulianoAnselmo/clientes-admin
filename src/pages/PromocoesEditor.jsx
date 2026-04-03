import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const DIAS = [
  { key: 'domingo', label: 'Domingo', short: 'Dom' },
  { key: 'segunda', label: 'Segunda-feira', short: 'Seg' },
  { key: 'terca', label: 'Terça-feira', short: 'Ter' },
  { key: 'quarta', label: 'Quarta-feira', short: 'Qua' },
  { key: 'quinta', label: 'Quinta-feira', short: 'Qui' },
  { key: 'sexta', label: 'Sexta-feira', short: 'Sex' },
  { key: 'sabado', label: 'Sábado', short: 'Sáb' }
]

const EMPTY_PROMOCOES = {
  domingo: [], segunda: [], terca: [], quarta: [],
  quinta: [], sexta: [], sabado: []
}

function DiaCard({ dia, promos, onChange }) {
  function addPromo() {
    onChange([...promos, { texto: '', destaque: false }])
  }

  function updatePromo(index, field, value) {
    const newPromos = [...promos]
    newPromos[index] = { ...newPromos[index], [field]: value }
    onChange(newPromos)
  }

  function removePromo(index) {
    onChange(promos.filter((_, i) => i !== index))
  }

  const hoje = DIAS[new Date().getDay()]?.key
  const isHoje = dia.key === hoje

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${
      isHoje ? 'border-purple-300 ring-2 ring-purple-100' : 'border-slate-200'
    }`}>
      <div className={`px-4 py-3 flex items-center justify-between ${
        isHoje ? 'bg-purple-50' : 'bg-slate-50'
      }`}>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{dia.label}</span>
          {isHoje && (
            <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full font-medium">HOJE</span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {promos.length === 0 ? 'Sem promoções' : `${promos.length} promoção(ões)`}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {promos.map((promo, i) => (
          <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-xl p-3">
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={promo.texto}
                onChange={e => updatePromo(i, 'texto', e.target.value)}
                placeholder="Texto da promoção"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 outline-none"
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={promo.destaque || false}
                  onChange={e => updatePromo(i, 'destaque', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-xs text-slate-500">Destaque</span>
              </label>
            </div>
            <button
              onClick={() => removePromo(i)}
              className="text-slate-300 hover:text-red-500 transition p-1 shrink-0"
              title="Remover promoção"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        <button
          onClick={addPromo}
          className="w-full py-2 border-2 border-dashed border-slate-200 hover:border-purple-400 text-slate-400 hover:text-purple-600 rounded-xl text-sm transition"
        >
          + Adicionar Promoção
        </button>
      </div>
    </div>
  )
}

export default function PromocoesEditor() {
  const { slug } = useParams()
  const [promocoes, setPromocoes] = useState(EMPTY_PROMOCOES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const restSnap = await getDoc(doc(db, 'restaurants', slug))
        if (restSnap.exists()) setRestaurantName(restSnap.data().name)

        const snap = await getDoc(doc(db, 'restaurants', slug, 'data', 'promocoes'))
        if (snap.exists() && snap.data().content) {
          setPromocoes({ ...EMPTY_PROMOCOES, ...snap.data().content })
        }
      } catch (err) {
        console.error('Erro ao carregar promoções:', err)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  function updateDia(key, promos) {
    setPromocoes(prev => ({ ...prev, [key]: promos }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'restaurants', slug, 'data', 'promocoes'), {
        content: promocoes,
        updatedAt: new Date().toISOString()
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('Erro ao salvar: ' + err.message)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Promoções</h1>
          <p className="text-xs text-slate-400">{restaurantName}</p>
        </div>
        <div className="ml-auto flex gap-2">
          {saved && <span className="text-xs text-green-600 self-center">Salvo!</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Days */}
      <div className="space-y-4">
        {DIAS.map(dia => (
          <DiaCard
            key={dia.key}
            dia={dia}
            promos={promocoes[dia.key] || []}
            onChange={promos => updateDia(dia.key, promos)}
          />
        ))}
      </div>
    </div>
  )
}
