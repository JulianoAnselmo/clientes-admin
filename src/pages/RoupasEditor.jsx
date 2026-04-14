import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { db, storage } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

const CATEGORIAS = [
  { value: 'camisas-sociais', label: 'Camisas Sociais' },
  { value: 'camisetas-polos', label: 'Camisetas & Polos' },
  { value: 'calcas-bermudas', label: 'Calças & Bermudas' },
  { value: 'ternos-costumes', label: 'Ternos & Costumes' },
  { value: 'acessorios', label: 'Acessórios' },
  { value: 'kits-combinacoes', label: 'Kits & Combinações' },
  { value: 'jaquetas-sueteres', label: 'Jaquetas & Suéteres' },
  { value: 'perfumes', label: 'Perfumes' },
]

// ===== Image Uploader (até 6 fotos por produto) =====
function ImageUploader({ images = [], onChange, slug, productId }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileRef = useRef()

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (images.length >= 6) return alert('Máximo de 6 fotos por produto.')

    setUploading(true)
    setProgress(0)

    const storagePath = `restaurants/${slug}/roupas/${productId}/${Date.now()}_${file.name}`
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
      <div className="flex flex-wrap gap-2 mb-2">
        {images.map((img, i) => (
          <div key={i} className="relative group w-24 h-18 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
            <img
              src={typeof img === 'string' ? img : img.url}
              alt={`Foto ${i + 1}`}
              className="w-full h-full object-cover"
            />
            <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
              {i + 1}
            </span>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => handleReorder(i, i - 1)}
                  className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-slate-700 text-xs hover:bg-white"
                >←</button>
              )}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600"
              >✕</button>
              {i < images.length - 1 && (
                <button
                  type="button"
                  onClick={() => handleReorder(i, i + 1)}
                  className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-slate-700 text-xs hover:bg-white"
                >→</button>
              )}
            </div>
          </div>
        ))}
        {images.length < 6 && !uploading && (
          <label className="w-24 h-18 rounded-lg border-2 border-dashed border-slate-300 hover:border-rose-400 flex flex-col items-center justify-center cursor-pointer transition bg-slate-50 hover:bg-rose-50">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[10px] text-slate-400 mt-0.5">Foto</span>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        )}
      </div>
      {uploading && (
        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1">
          <div className="bg-rose-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

// ===== Product Card (individual editor) =====
function ProductCard({ produto, onChange, onRemove, slug }) {
  const [collapsed, setCollapsed] = useState(false)
  const isSobConsulta = produto.preco === null || produto.preco === undefined

  function update(field, value) {
    onChange({ ...produto, [field]: value })
  }

  function toggleSobConsulta() {
    if (isSobConsulta) {
      update('preco', 0)
    } else {
      update('preco', null)
    }
  }

  const catLabel = CATEGORIAS.find(c => c.value === produto.categoria)?.label || produto.categoria || 'Sem categoria'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          {produto.images?.length > 0 && (
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
              <img
                src={typeof produto.images[0] === 'string' ? produto.images[0] : produto.images[0]?.url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">
              {produto.nome || 'Novo produto'}
            </h3>
            <p className="text-xs text-slate-400">
              {catLabel}{produto.preco != null ? ` · R$ ${Number(produto.preco).toFixed(2).replace('.', ',')}` : ' · Sob consulta'}
            </p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {!collapsed && (
        <div className="p-4 pt-0 space-y-4 border-t border-slate-100">
          <ImageUploader
            images={produto.images || []}
            onChange={(imgs) => update('images', imgs)}
            slug={slug}
            productId={produto.id}
          />

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Nome do produto</label>
            <input
              type="text"
              value={produto.nome || ''}
              onChange={e => update('nome', e.target.value)}
              placeholder="Ex: Camisa Social Slim Fit"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-rose-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Descrição</label>
            <textarea
              value={produto.descricao || ''}
              onChange={e => update('descricao', e.target.value)}
              placeholder="Descreva o produto..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-rose-500 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Preço</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={isSobConsulta ? '' : (produto.preco || '')}
                  onChange={e => update('preco', e.target.value === '' ? null : parseFloat(e.target.value))}
                  disabled={isSobConsulta}
                  placeholder={isSobConsulta ? 'Sob consulta' : 'R$ 0,00'}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-rose-500 outline-none disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
              <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSobConsulta}
                  onChange={toggleSobConsulta}
                  className="accent-rose-500"
                />
                <span className="text-[11px] text-slate-500">Sob consulta</span>
              </label>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Categoria</label>
              <select
                value={produto.categoria || ''}
                onChange={e => update('categoria', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-rose-500 outline-none bg-white"
              >
                <option value="">Selecione...</option>
                {CATEGORIAS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Observações</label>
            <input
              type="text"
              value={produto.observacoes || ''}
              onChange={e => update('observacoes', e.target.value)}
              placeholder="Ex: Consulte disponibilidade de tamanhos"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-rose-500 outline-none"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
            >
              Remover produto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== Main Roupas Editor =====
export default function RoupasEditor() {
  const { slug } = useParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const restSnap = await getDoc(doc(db, 'restaurants', slug))
        if (restSnap.exists()) setClientName(restSnap.data().name)

        const snap = await getDoc(doc(db, 'restaurants', slug, 'data', 'roupas'))
        if (snap.exists() && snap.data().content) {
          setProducts(snap.data().content)
        }
      } catch (err) {
        console.error('Erro ao carregar produtos:', err)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  function updateProduct(index, newProduct) {
    const updated = [...products]
    updated[index] = newProduct
    setProducts(updated)
    setSaved(false)
  }

  function removeProduct(index) {
    const p = products[index]
    if (!confirm(`Remover "${p.nome || 'este produto'}"?`)) return
    setProducts(products.filter((_, i) => i !== index))
    setSaved(false)
  }

  function addProduct() {
    setProducts([...products, {
      id: generateId(),
      nome: '',
      descricao: '',
      preco: null,
      categoria: '',
      destaque: false,
      observacoes: '',
      images: []
    }])
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const content = products.map(p => ({
        ...p,
        images: (p.images || []).map(img =>
          typeof img === 'string' ? { url: img, storagePath: '' } : img
        )
      }))

      await setDoc(doc(db, 'restaurants', slug, 'data', 'roupas'), {
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">{clientName}</p>
          <h1 className="text-2xl font-bold text-slate-900">Catálogo de Roupas</h1>
        </div>
        <div className="ml-auto flex gap-2 items-center">
          {saved && (
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-lg">✓ Salvo</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold rounded-xl transition disabled:opacity-50 shadow-sm"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {products.length} {products.length === 1 ? 'produto' : 'produtos'}
        </p>
        <button
          onClick={addProduct}
          className="text-sm bg-rose-50 hover:bg-rose-100 text-rose-700 px-4 py-2 rounded-xl transition font-medium"
        >
          + Novo produto
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">Nenhum produto cadastrado</p>
          <p className="text-sm">Clique em "+ Novo produto" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p, i) => (
            <ProductCard
              key={p.id}
              produto={p}
              onChange={(updated) => updateProduct(i, updated)}
              onRemove={() => removeProduct(i)}
              slug={slug}
            />
          ))}
        </div>
      )}
    </div>
  )
}
