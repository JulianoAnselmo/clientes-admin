import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import html2pdf from 'html2pdf.js'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''
const SCOPES = 'https://www.googleapis.com/auth/webmasters.readonly'

function formatNumber(n) {
  return new Intl.NumberFormat('pt-BR').format(n)
}

function formatPercent(n) {
  return (n * 100).toFixed(1) + '%'
}

function formatPosition(n) {
  return n.toFixed(1)
}

function last30Days() {
  const end = new Date()
  end.setDate(end.getDate() - 3) // GSC data has ~3 day delay
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

function formatDateBR(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

async function getValidToken() {
  const snap = await getDoc(doc(db, 'settings', 'googleSearchConsole'))
  if (!snap.exists()) return null
  const data = snap.data()

  // Check if token is still valid (with 5 min buffer)
  if (data.expiresAt && data.expiresAt > Date.now() + 300000) {
    return data.accessToken
  }

  // Refresh the token
  if (!data.refreshToken) return null
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: data.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!resp.ok) return null
  const tokens = await resp.json()

  await setDoc(doc(db, 'settings', 'googleSearchConsole'), {
    ...data,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  })

  return tokens.access_token
}

async function fetchSearchAnalytics(siteUrl, token, dimension) {
  const { startDate, endDate } = last30Days()
  const resp = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: [dimension],
        rowLimit: dimension === 'query' ? 10 : 5,
      }),
    }
  )
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || `Erro ${resp.status}`)
  }
  return resp.json()
}

async function fetchSummary(siteUrl, token) {
  const { startDate, endDate } = last30Days()
  const resp = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startDate, endDate }),
    }
  )
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || `Erro ${resp.status}`)
  }
  return resp.json()
}

function KpiCard({ label, value, icon, color }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  }
  return (
    <div className={`rounded-2xl border p-6 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}

export default function RelatorioSEOPage() {
  const { slug } = useParams()
  const reportRef = useRef(null)
  const [restaurant, setRestaurant] = useState(null)
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    loadData()
  }, [slug])

  async function loadData() {
    setLoading(true)
    try {
      const [restSnap, contractSnap, authSnap] = await Promise.all([
        getDoc(doc(db, 'restaurants', slug)),
        getDoc(doc(db, 'contracts', slug)),
        getDoc(doc(db, 'settings', 'googleSearchConsole')),
      ])
      if (restSnap.exists()) setRestaurant({ id: restSnap.id, ...restSnap.data() })
      if (contractSnap.exists()) setContract(contractSnap.data())
      if (!authSnap.exists() || !authSnap.data().refreshToken) setNeedsAuth(true)
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message)
    }
    setLoading(false)
  }

  async function handleConnectGoogle() {
    if (!GOOGLE_CLIENT_ID) {
      setError('VITE_GOOGLE_CLIENT_ID não configurado no .env')
      return
    }

    // Use OAuth 2.0 authorization code flow with popup
    const redirectUri = window.location.origin + import.meta.env.BASE_URL + 'oauth-callback.html'
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')

    const popup = window.open(authUrl.toString(), 'googleAuth', 'width=500,height=600')
    if (!popup) {
      setError('Popup bloqueado. Permita popups para este site.')
      return
    }

    // Listen for the auth code from the popup
    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return
      if (!event.data?.code) return
      window.removeEventListener('message', handleMessage)

      try {
        // Exchange code for tokens
        const resp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: event.data.code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        })
        if (!resp.ok) throw new Error('Erro ao trocar código por tokens')
        const tokens = await resp.json()

        await setDoc(doc(db, 'settings', 'googleSearchConsole'), {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          connectedAt: new Date().toISOString(),
        })

        setNeedsAuth(false)
        setError('')
      } catch (err) {
        setError('Erro na autenticação: ' + err.message)
      }
    }

    window.addEventListener('message', handleMessage)
  }

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    setReport(null)

    try {
      const siteUrl = contract?.siteUrl
      if (!siteUrl) throw new Error('Site URL não configurado para este cliente')

      const token = await getValidToken()
      if (!token) {
        setNeedsAuth(true)
        throw new Error('Token expirado. Reconecte o Google Search Console.')
      }

      const [summaryData, queriesData, pagesData] = await Promise.all([
        fetchSummary(siteUrl, token),
        fetchSearchAnalytics(siteUrl, token, 'query'),
        fetchSearchAnalytics(siteUrl, token, 'page'),
      ])

      const { startDate, endDate } = last30Days()

      setReport({
        period: { start: startDate, end: endDate },
        summary: {
          clicks: summaryData.rows?.[0]?.clicks || 0,
          impressions: summaryData.rows?.[0]?.impressions || 0,
          ctr: summaryData.rows?.[0]?.ctr || 0,
          position: summaryData.rows?.[0]?.position || 0,
        },
        topQueries: (queriesData.rows || []).map(r => ({
          query: r.keys[0],
          clicks: r.clicks,
          impressions: r.impressions,
        })),
        topPages: (pagesData.rows || []).map(r => ({
          page: r.keys[0],
          clicks: r.clicks,
          impressions: r.impressions,
        })),
        generatedAt: new Date().toISOString(),
      })
    } catch (err) {
      setError(err.message)
    }
    setGenerating(false)
  }

  async function handleExportPDF() {
    if (!reportRef.current) return
    setExporting(true)
    try {
      const filename = `relatorio-seo-${slug}-${new Date().toISOString().slice(0, 7)}.pdf`
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(reportRef.current)
        .save()
    } catch (err) {
      setError('Erro ao exportar PDF: ' + err.message)
    }
    setExporting(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <p className="text-slate-500">Cliente não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Relatório SEO</h1>
          <p className="text-sm text-slate-500 mt-0.5">{restaurant.name} — {contract?.siteUrl || 'Site URL não configurado'}</p>
        </div>
        <div className="flex items-center gap-3">
          {needsAuth && (
            <button
              onClick={handleConnectGoogle}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm px-4 py-2 rounded-xl transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Conectar Search Console
            </button>
          )}
          {!needsAuth && (
            <button
              onClick={handleGenerate}
              disabled={generating || !contract?.siteUrl}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition disabled:opacity-50"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Gerando…
                </>
              ) : (
                <>📊 Gerar Relatório</>
              )}
            </button>
          )}
          {report && (
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition disabled:opacity-50"
            >
              {exporting ? 'Exportando…' : '📄 Exportar PDF'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {!report && !generating && !error && (
        <div className="bg-white rounded-2xl border border-slate-200 py-24 text-center">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-slate-500 text-sm">
            {needsAuth
              ? 'Conecte sua conta Google para acessar o Search Console.'
              : 'Clique em "Gerar Relatório" para buscar os dados do Search Console.'
            }
          </p>
        </div>
      )}

      {/* Report content */}
      {report && (
        <div ref={reportRef} className="bg-white rounded-2xl border border-slate-200 p-8">
          {/* Report Header */}
          <div className="text-center mb-8 pb-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800">{restaurant.name}</h2>
            <p className="text-sm text-slate-500 mt-1">
              Relatório de Desempenho SEO — {formatDateBR(report.period.start)} a {formatDateBR(report.period.end)}
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard
              label="Cliques"
              value={formatNumber(report.summary.clicks)}
              icon="🖱️"
              color="blue"
            />
            <KpiCard
              label="Impressões"
              value={formatNumber(report.summary.impressions)}
              icon="👁️"
              color="green"
            />
            <KpiCard
              label="CTR"
              value={formatPercent(report.summary.ctr)}
              icon="📈"
              color="amber"
            />
            <KpiCard
              label="Posição Média"
              value={formatPosition(report.summary.position)}
              icon="📍"
              color="purple"
            />
          </div>

          {/* Top Queries */}
          {report.topQueries.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Top 10 — Termos Mais Buscados
              </h3>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">#</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Termo de busca</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Cliques</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Impressões</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.topQueries.map((q, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-400 font-medium">{i + 1}</td>
                        <td className="px-4 py-2.5 text-slate-700 font-medium">{q.query}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{formatNumber(q.clicks)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{formatNumber(q.impressions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Pages */}
          {report.topPages.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Top 5 — Páginas Mais Acessadas
              </h3>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">#</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Página</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Cliques</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Impressões</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.topPages.map((p, i) => {
                      let displayUrl = p.page
                      try { displayUrl = new URL(p.page).pathname } catch {}
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-400 font-medium">{i + 1}</td>
                          <td className="px-4 py-2.5 text-slate-700 font-medium truncate max-w-[300px]" title={p.page}>
                            {displayUrl}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{formatNumber(p.clicks)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500">{formatNumber(p.impressions)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Relatório gerado em {new Date(report.generatedAt).toLocaleDateString('pt-BR')} às{' '}
              {new Date(report.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {' '}— Dados do Google Search Console
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
