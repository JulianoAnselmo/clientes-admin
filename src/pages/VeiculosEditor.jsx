import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { db, storage } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

// ===== Image Uploader (até 6 fotos por veículo) =====
function ImageUploader({ images = [], onChange, slug, vehicleId }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileRef = useRef()

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (images.length >= 6) return alert('Máximo de 6 fotos por veículo.')

    setUploading(true)
    setProgress(0)

    const storagePath = `restaurants/${slug}/veiculos/${vehicleId}/${Date.now()}_${file.name}`
    const storageRef = ref(storage, storagePath)
    const task = uploadBytesResumable(storageRef, file)

    task.on('state_changed',
      (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { alert('Erro no upload: ' + err.message); setUploading(false) },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        onChange([...images, { url, storagePath }])
        setUploading(false)
        setProgress(0)
        if (fileRef.current) fileRef.current.value = ''
      }
    )
  }

  async function handleRemove(index) {
    const img = images[index]
    try {
      if (img.storagePath) {
        await deleteObject(ref(storage, img.storagePath))
      }
    } catch (err) {
      console.warn('Erro ao deletar do Storage:', err)
    }
    onChange(images.filter((_, i) => i !== index))
  }

  function handleReorder(fromIndex, toIndex) {
    const updated = [...images]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    onChange(updated)
  }

  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 mb-2">
        Fotos ({images.length}/6)
      </label>

      {/* Grid de thumbnails */}
      <div className="flex flex-wrap gap-2 mb-2">
        {images.map((img, i) => (
          <div key={i} className="relative group w-24 h-18 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
            <img
              src={typeof img === 'string' ? img : img.url}
              alt={`Foto ${i + 1}`}
              className="w-full h-full object-cover"
            />
            {/* Badge de ordem */}
            <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
              {i + 1}
            </span>
            {/* Botões hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => handleReorder(i, i - 1)}
                  className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-slate-700 text-xs hover:bg-white"
                  title="Mover para esquerda"
                >
                  ←
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600"
                title="Remover foto"
              >
                ✕
              </button>
              {i < images.length - 1 && (
                <button
                  type="button"
                  onClick={() => handleReorder(i, i + 1)}
                  className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-slate-700 text-xs hover:bg-white"
                  title="Mover para direita"
                >
                  →
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Botão adicionar */}
        {images.length < 6 && !uploading && (
          <label className="w-24 h-18 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 flex flex-col items-center justify-center cursor-pointer transition bg-slate-50 hover:bg-blue-50">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[10px] text-slate-400 mt-0.5">Foto</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Progress bar */}
      {uploading && (
        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ===== Veículo Editor (card individual) =====
function VeiculoCard({ veiculo, onChange, onRemove, slug }) {
  const [collapsed, setCollapsed] = useState(false)

  function update(field, value) {
    onChange({ ...veiculo, [field]: value })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header do card */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          {/* Thumbnail da primeira foto */}
          {veiculo.images?.length > 0 && (
            <div className="w-12 h-9 rounded-lg overflow-hidden bg-slate-100 shrink-0">
              <img
                src={typeof veiculo.images[0] === 'string' ? veiculo.images[0] : veiculo.images[0]?.url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">
              {veiculo.name || 'Novo veículo'}
            </h3>
            <p className="text-xs text-slate-400">
              {[veiculo.brand, veiculo.year, veiculo.price].filter(Boolean).join(' · ') || 'Preencha os dados'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {veiculo.badge && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              {veiculo.badge}
            </span>
          )}
          <svg className={`w-4 h-4 text-slate-400 transition ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Body expandido */}
      {!collapsed && (
        <div className="p-4 pt-0 space-y-4 border-t border-slate-100">
          {/* Fotos */}
          <ImageUploader
            images={veiculo.images || []}
            onChange={(imgs) => update('images', imgs)}
            slug={slug}
            vehicleId={veiculo.id}
          />

          {/* Campos em grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Marca</label>
              <input
                type="text"
                value={veiculo.brand || ''}
                onChange={e => update('brand', e.target.value)}
                placeholder="Ex: Toyota"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Nome completo</label>
              <input
                type="text"
                value={veiculo.name || ''}
                onChange={e => update('name', e.target.value)}
                placeholder="Ex: Toyota Corolla XEi 2.0"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Ano</label>
              <input
                type="text"
                value={veiculo.year || ''}
                onChange={e => update('year', e.target.value)}
                placeholder="2021/2022"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Combustível</label>
              <select
                value={veiculo.fuel || 'Flex'}
                onChange={e => update('fuel', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none bg-white"
              >
                <option>Flex</option>
                <option>Gasolina</option>
                <option>Etanol</option>
                <option>Diesel</option>
                <option>Elétrico</option>
                <option>Híbrido</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Câmbio</label>
              <select
                value={veiculo.transmission || 'Automático'}
                onChange={e => update('transmission', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none bg-white"
              >
                <option>Automático</option>
                <option>Manual</option>
                <option>CVT</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Quilometragem</label>
              <input
                type="text"
                value={veiculo.km || ''}
                onChange={e => update('km', e.target.value)}
                placeholder="38.000 km"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Preço</label>
              <input
                type="text"
                value={veiculo.price || ''}
                onChange={e => update('price', e.target.value)}
                placeholder="R$ 129.900"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Etiqueta</label>
              <select
                value={veiculo.badge || ''}
                onChange={e => update('badge', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none bg-white"
              >
                <option value="">Nenhuma</option>
                <option>Destaque</option>
                <option>Seminovo</option>
                <option>Novo</option>
                <option>Oportunidade</option>
                <option>Reservado</option>
              </select>
            </div>
          </div>

          {/* Botão remover */}
          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
            >
              Remover veículo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== Main Veículos Editor =====
export default function VeiculosEditor() {
  const { slug } = useParams()
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const restSnap = await getDoc(doc(db, 'restaurants', slug))
        if (restSnap.exists()) setClientName(restSnap.data().name)

        const snap = await getDoc(doc(db, 'restaurants', slug, 'data', 'veiculos'))
        if (snap.exists() && snap.data().content) {
          setVehicles(snap.data().content)
        }
      } catch (err) {
        console.error('Erro ao carregar veículos:', err)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  function updateVehicle(index, newVehicle) {
    const updated = [...vehicles]
    updated[index] = newVehicle
    setVehicles(updated)
    setSaved(false)
  }

  function removeVehicle(index) {
    const v = vehicles[index]
    if (!confirm(`Remover "${v.name || 'este veículo'}"?`)) return
    setVehicles(vehicles.filter((_, i) => i !== index))
    setSaved(false)
  }

  function addVehicle() {
    setVehicles([...vehicles, {
      id: generateId(),
      brand: '',
      name: '',
      year: '',
      fuel: 'Flex',
      transmission: 'Automático',
      km: '',
      price: '',
      badge: '',
      images: []
    }])
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Preparar dados para salvar (converter images para formato serializável)
      const content = vehicles.map(v => ({
        ...v,
        images: (v.images || []).map(img =>
          typeof img === 'string' ? { url: img, storagePath: '' } : img
        )
      }))

      await setDoc(doc(db, 'restaurants', slug, 'data', 'veiculos'), {
        content,
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
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
          <h1 className="text-xl font-bold text-slate-800">Veículos</h1>
          <p className="text-xs text-slate-400">{clientName}</p>
        </div>
        <div className="ml-auto flex gap-2 items-center">
          {saved && <span className="text-xs text-green-600">Salvo!</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Vehicle count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {vehicles.length} {vehicles.length === 1 ? 'veículo' : 'veículos'}
        </p>
        <button
          onClick={addVehicle}
          className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-xl transition font-medium"
        >
          + Novo veículo
        </button>
      </div>

      {/* Vehicle list */}
      {vehicles.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">Nenhum veículo cadastrado</p>
          <p className="text-sm">Clique em "+ Novo veículo" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v, i) => (
            <VeiculoCard
              key={v.id}
              veiculo={v}
              onChange={(updated) => updateVehicle(i, updated)}
              onRemove={() => removeVehicle(i)}
              slug={slug}
            />
          ))}
        </div>
      )}
    </div>
  )
}
