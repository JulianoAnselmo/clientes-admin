import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const defaultInfo = {
  name: '',
  city: '',
  slogan: '',
  tagline: '',
  whatsapp: '',
  whatsappNumber: '',
  phone: '',
  address: '',
  neighborhood: '',
  cityState: '',
  cep: '',
  hours: {
    funcionamento: '',
    jantar: '',
    almoco: '',
    completo: '',
  },
  instagram: '',
  facebook: '',
  googleMapsEmbed: '',
  googleMapsLink: ''
}

function Field({ label, value, onChange, placeholder, type = 'text', hint }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-teal-500 outline-none"
      />
      {hint && <span className="text-[10px] text-slate-400 mt-0.5 block">{hint}</span>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h2 className="font-semibold text-slate-800 text-sm border-b border-slate-100 pb-2">{title}</h2>
      {children}
    </div>
  )
}

export default function BusinessInfoEditor() {
  const { slug } = useParams()
  const [info, setInfo] = useState(defaultInfo)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const restSnap = await getDoc(doc(db, 'restaurants', slug))
        if (restSnap.exists()) setClientName(restSnap.data().name)

        const snap = await getDoc(doc(db, 'restaurants', slug, 'data', 'businessInfo'))
        if (snap.exists() && snap.data().content) {
          setInfo({ ...defaultInfo, ...snap.data().content })
        }
      } catch (err) {
        console.error('Erro ao carregar informações:', err)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  function update(field, value) {
    setInfo(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  function updateHours(field, value) {
    setInfo(prev => ({
      ...prev,
      hours: { ...prev.hours, [field]: value }
    }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'restaurants', slug, 'data', 'businessInfo'), {
        content: info,
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">{clientName}</p>
          <h1 className="text-2xl font-bold text-slate-900">Informações</h1>
        </div>
        <div className="flex gap-2 items-center">
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

      <div className="space-y-4">
        {/* Dados básicos */}
        <Section title="Dados da Empresa">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome da empresa" value={info.name} onChange={v => update('name', v)} placeholder="Quejinho Veículos" />
            <Field label="Cidade" value={info.city} onChange={v => update('city', v)} placeholder="Taquaritinga - SP" />
          </div>
          <Field label="Slogan" value={info.slogan} onChange={v => update('slogan', v)} placeholder="Confiança que te leva mais longe" />
          <Field label="Tagline / Descrição curta" value={info.tagline} onChange={v => update('tagline', v)} placeholder="Compra, Venda, Troca e Financiamento de Veículos" />
        </Section>

        {/* Contato */}
        <Section title="Contato">
          <div className="grid grid-cols-2 gap-3">
            <Field label="WhatsApp (exibição)" value={info.whatsapp} onChange={v => update('whatsapp', v)} placeholder="(16) 99635-5566" />
            <Field label="WhatsApp (número API)" value={info.whatsappNumber} onChange={v => update('whatsappNumber', v)} placeholder="5516996355566" hint="Somente números com DDI. Ex: 5516996355566" />
          </div>
          <Field label="Telefone" value={info.phone} onChange={v => update('phone', v)} placeholder="(16) 99635-5566" />
        </Section>

        {/* Endereço */}
        <Section title="Endereço">
          <Field label="Endereço" value={info.address} onChange={v => update('address', v)} placeholder="Rua Principal, 123" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Bairro" value={info.neighborhood} onChange={v => update('neighborhood', v)} placeholder="Centro" />
            <Field label="Cidade - UF" value={info.cityState} onChange={v => update('cityState', v)} placeholder="Taquaritinga - SP" />
            <Field label="CEP" value={info.cep} onChange={v => update('cep', v)} placeholder="15900-000" />
          </div>
        </Section>

        {/* Horários */}
        <Section title="Horário de Atendimento">
          <Field
            label="Dias de funcionamento"
            value={info.hours?.funcionamento}
            onChange={v => updateHours('funcionamento', v)}
            placeholder="Ex: Terça a Domingo"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Jantar"
              value={info.hours?.jantar}
              onChange={v => updateHours('jantar', v)}
              placeholder="Ex: 19h30 às 23h"
            />
            <Field
              label="Almoço"
              value={info.hours?.almoco}
              onChange={v => updateHours('almoco', v)}
              placeholder="Ex: Sáb 11h · Dom 11h30"
            />
          </div>
          <Field
            label="Horário completo (exibido na seção Contato)"
            value={info.hours?.completo}
            onChange={v => updateHours('completo', v)}
            placeholder="Ex: Ter a Sex 19h30–23h · Sáb 11h–14h / 19h30–23h30 · Dom 11h30–14h"
          />
        </Section>

        {/* Redes sociais */}
        <Section title="Redes Sociais">
          <Field label="Instagram (URL)" value={info.instagram} onChange={v => update('instagram', v)} placeholder="https://instagram.com/seuusuario" />
          <Field label="Facebook (URL)" value={info.facebook} onChange={v => update('facebook', v)} placeholder="https://facebook.com/suapagina" />
        </Section>

        {/* Maps */}
        <Section title="Google Maps">
          <Field label="Link do Google Maps" value={info.googleMapsLink} onChange={v => update('googleMapsLink', v)} placeholder="https://www.google.com/maps/search/..." hint="Link para o botão 'Como chegar'" />
          <Field label="Embed do Google Maps" value={info.googleMapsEmbed} onChange={v => update('googleMapsEmbed', v)} placeholder="https://www.google.com/maps?q=...&output=embed" hint="URL para embutir mapa (opcional)" />
        </Section>
      </div>
    </div>
  )
}
