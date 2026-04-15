import { useState, useRef, useEffect, useCallback } from 'react'
import { db } from '../firebase'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { syncMenudinoCardapio, tryParseBookmarkletPayload } from '../lib/menudino-sync'

/**
 * Modal para sincronizar o cardápio a partir do Menudino.
 *
 * Fluxo otimizado (3 cliques depois do bookmarklet instalado):
 *   1. [Abrir Menudino] → abre o cardápio do cliente em outra aba
 *   2. Na aba do Menudino → clica no bookmarklet da barra de favoritos
 *      (cookie copia automaticamente pro clipboard)
 *   3. [Colar e sincronizar] → lê o clipboard e dispara a sync
 *
 * Fallback: se o clipboard API não funcionar, há um textarea para colar manualmente.
 */

// Bookmarklet que busca TUDO do Menudino (token, merchant, categorias, items)
// e copia um payload JSON pronto pro clipboard. O cardapio-admin só precisa
// ler esse JSON, processar e gravar no Firestore.
//
// Passos:
//   1. Valida que o user está em *.menudino.com
//   2. fetch('/') para pegar app-access-token do header e merchantId do HTML
//   3. fetch merchant details, categorias e items via API (com Authorization)
//   4. Copia JSON do payload pro clipboard (com fallback execCommand/prompt)
//
// Qualquer erro em qualquer passo aparece em alert com mensagem clara.
const BOOKMARKLET_CODE = `javascript:(async()=>{try{if(!location.hostname.includes('menudino.com')){alert('Voce nao esta em *.menudino.com. Host: '+location.hostname);return;}var r=await fetch('/',{cache:'no-store'});if(!r.ok){alert('fetch / falhou: HTTP '+r.status);return;}var t=r.headers.get('app-access-token');if(!t){alert('Sem header app-access-token. O site pode ter mudado.');return;}var h=await r.text(),m=h.match(/merchantSummary[\\\\"\\s:{]*id[\\\\"\\s:]*([a-f0-9-]{36})/);if(!m){alert('Nao achei merchantId no HTML. O site pode ter mudado.');return;}var mid=m[1],a={headers:{Authorization:'Bearer '+t}},cb='https://menudino-catalog.consumerapis.com/api/v1',mb='https://menudino-merchants.consumerapis.com/api/v1';var me=await(await fetch(mb+'/merchants/'+mid,a)).json();var cr=await(await fetch(cb+'/categories/'+mid+'?OnlyActive=false',a)).json();var cs=cr.items||[];var it={},tt=0;for(var i=0;i<cs.length;i++){var ir=await(await fetch(cb+'/items/'+mid+'/'+cs[i].id+'/summary?SellOnline=false',a)).json();it[cs[i].id]=ir.items||[];tt+=it[cs[i].id].length;}var p=JSON.stringify({version:1,merchant:me,categories:cs,itemsByCategoryId:it});var ok=function(){alert('OK! '+cs.length+' categorias e '+tt+' items copiados ('+p.length+' chars). Volte ao cardapio-admin e clique em Colar e sincronizar.');};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(p).then(ok,function(){var x=document.createElement('textarea');x.value=p;x.style.position='fixed';x.style.top='0';x.style.opacity='0';document.body.appendChild(x);x.focus();x.select();try{document.execCommand('copy');document.body.removeChild(x);ok();}catch(e){document.body.removeChild(x);prompt('Copie:',p);}});}else{prompt('Copie:',p);}}catch(e){alert('Erro no bookmarklet: '+(e&&e.message||e));}})();`

export default function SyncMenudinoModal({ isOpen, onClose, restaurantSlug, onSyncComplete }) {
  const [menudinoUrl, setMenudinoUrl] = useState('')
  const [cookie, setCookie] = useState('')
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [clipboardChecked, setClipboardChecked] = useState(false)
  const [showManualPaste, setShowManualPaste] = useState(false)
  const logEndRef = useRef(null)

  // Autoscroll dos logs
  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Carrega a URL salva do restaurant doc e reset ao abrir
  useEffect(() => {
    if (!isOpen) return
    setCookie('')
    setLogs([])
    setError(null)
    setSuccess(null)
    setLoading(false)
    setClipboardChecked(false)
    setShowManualPaste(false)

    if (!restaurantSlug) return
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, 'restaurants', restaurantSlug))
        if (snap.exists()) {
          const data = snap.data()
          if (data.menudinoUrl) {
            setMenudinoUrl(data.menudinoUrl)
          } else if (data.slug || data.id) {
            // Sugestão razoável baseada no slug
            const slug = data.slug || data.id || restaurantSlug
            setMenudinoUrl(`https://${slug.replace(/-/g, '')}.menudino.com/`)
          }
        }
      } catch (e) {
        console.warn('Não conseguiu carregar menudinoUrl do restaurant doc:', e)
      }
    })()
  }, [isOpen, restaurantSlug])

  const doSync = useCallback(async (pastedData) => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setLogs([])

    try {
      const result = await syncMenudinoCardapio({
        pastedData,
        firestore: db,
        restaurantSlug,
        firestoreOps: { doc, getDoc, setDoc },
        onLog: (line) => setLogs(prev => [...prev, line])
      })

      // Salva a URL do menudino no restaurant doc pra próxima vez
      if (menudinoUrl && restaurantSlug) {
        try {
          await updateDoc(doc(db, 'restaurants', restaurantSlug), { menudinoUrl })
        } catch (e) {
          console.warn('Não salvou menudinoUrl:', e)
        }
      }

      setSuccess(result)
      if (onSyncComplete) onSyncComplete()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [restaurantSlug, menudinoUrl, onSyncComplete])

  const validarConteudo = (text) => {
    if (!text) return { ok: false, reason: 'vazio' }
    // Se começa com { é o novo payload JSON do bookmarklet
    const bp = tryParseBookmarkletPayload(text)
    if (bp) return { ok: true, kind: 'bookmarklet', totalItems: Object.values(bp.itemsByCategoryId).reduce((a, xs) => a + xs.length, 0) }
    // Legado: cookie string
    if (text.indexOf('app-access-token') !== -1) return { ok: true, kind: 'cookie' }
    return { ok: false, reason: 'nenhum formato reconhecido' }
  }

  const handlePasteFromClipboard = async () => {
    setError(null)
    setClipboardChecked(true)
    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        setError('O clipboard está vazio. Clique no bookmarklet "Sincronizar Menudino" na barra de favoritos (estando na página do Menudino) e tente de novo.')
        setShowManualPaste(true)
        return
      }
      const v = validarConteudo(text)
      if (!v.ok) {
        const preview = text.length > 200 ? text.slice(0, 200) + '…' : text
        setError(
          `Encontrei algo no clipboard mas não reconheci o formato.\n\n` +
          `Tamanho: ${text.length} caracteres\n` +
          `Início: "${preview}"\n\n` +
          `Esperado: um JSON do bookmarklet (começando com "{") ou uma string de cookie com "app-access-token=".\n\n` +
          `Certifique-se de clicar no bookmarklet ESTANDO na aba do Menudino (não no cardapio-admin) e aguardar o alert "OK! ... copiados" antes de voltar aqui.`
        )
        setShowManualPaste(true)
        setCookie(text)
        return
      }
      setCookie(text)
      await doSync(text)
    } catch (e) {
      setError(
        'Não consegui ler o clipboard automaticamente. Isto pode acontecer se:\n' +
        '• Seu browser pediu permissão e você negou/ignorou\n' +
        '• O foco não está na janela do admin (clique nesta janela antes de clicar no botão)\n' +
        '• Estamos em HTTP (precisa ser HTTPS ou localhost)\n\n' +
        `Detalhes: ${e.message || e}\n\n` +
        'Use o modo manual abaixo — cole direto no textarea.'
      )
      setShowManualPaste(true)
    }
  }

  const handleTestClipboard = async () => {
    setError(null)
    try {
      const text = await navigator.clipboard.readText()
      const preview = !text ? '(vazio)' : (text.length > 300 ? text.slice(0, 300) + '…' : text)
      const v = validarConteudo(text || '')
      const kindMsg = v.ok ? (v.kind === 'bookmarklet' ? `JSON do bookmarklet (${v.totalItems} items)` : 'Cookie string (legado)') : `Não reconhecido (${v.reason})`
      alert(
        `Clipboard (${text ? text.length : 0} chars):\n\n${preview}\n\nFormato: ${kindMsg}`
      )
    } catch (e) {
      alert('Erro ao ler o clipboard: ' + (e.message || e))
    }
  }

  const handleManualSync = () => {
    if (!cookie.trim()) return
    doSync(cookie)
  }

  const handleAbrirMenudino = () => {
    if (!menudinoUrl) return
    let url = menudinoUrl.trim()
    if (!/^https?:\/\//.test(url)) url = 'https://' + url
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!isOpen) return null

  const urlValida = menudinoUrl && menudinoUrl.includes('menudino.com')
  const cookieValido = cookie.trim().length > 20 && cookie.indexOf('app-access-token') !== -1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Sincronizar com Menudino</h2>
            <p className="text-xs text-slate-500 mt-0.5">Puxa o cardápio e horários direto do seu Menudino</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50"
            title="Fechar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {!success && (
            <>
              {/* Setup primeira vez: bookmarklet */}
              <details open className="mb-4 border border-slate-200 rounded-xl overflow-hidden group">
                <summary className="px-4 py-3 bg-slate-50 cursor-pointer text-sm font-medium text-slate-700 hover:bg-slate-100 select-none">
                  🔖 Instale o atalho (1x só)
                </summary>
                <div className="px-4 py-3 text-sm text-slate-600 space-y-2 border-t border-slate-200">
                  <p>
                    Garanta que sua <b>barra de favoritos</b> esteja visível (<kbd className="border px-1 rounded text-xs">Ctrl</kbd>+<kbd className="border px-1 rounded text-xs">Shift</kbd>+<kbd className="border px-1 rounded text-xs">B</kbd>) e depois <b>arraste</b> o botão laranja abaixo pra ela:
                  </p>
                  <div className="flex items-center gap-3 py-2">
                    {/* eslint-disable-next-line react/jsx-no-script-url */}
                    <a
                      href={BOOKMARKLET_CODE}
                      onClick={e => {
                        e.preventDefault()
                        alert('Não clique — arraste este botão para a sua barra de favoritos!')
                      }}
                      draggable
                      className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 shadow-sm select-none cursor-grab active:cursor-grabbing"
                    >
                      🍽️ Sincronizar Menudino
                    </a>
                    <span className="text-xs text-slate-500">← arraste pra barra de favoritos</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    O bookmarklet puxa categorias + items + horários do Menudino e copia tudo pro clipboard em JSON.
                  </p>
                </div>
              </details>

              {/* Input URL Menudino */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  URL do seu Menudino
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={menudinoUrl}
                    onChange={e => setMenudinoUrl(e.target.value)}
                    disabled={loading}
                    placeholder="https://seurestaurante.menudino.com/"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:border-amber-500 outline-none disabled:bg-slate-50"
                  />
                  <button
                    onClick={handleAbrirMenudino}
                    disabled={!urlValida || loading}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    title="Abrir em nova aba"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Abrir
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Será aberto numa aba nova. Clique no bookmarklet da barra de favoritos quando a página carregar.</p>
              </div>

              {/* Passos */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-slate-700">
                <div className="font-bold mb-2 text-slate-800">Depois de abrir o Menudino:</div>
                <ol className="list-decimal pl-5 space-y-1 text-slate-600">
                  <li>Aguarde a página carregar completamente</li>
                  <li>Clique no atalho <b>"🍽️ Sincronizar Menudino"</b> na sua barra de favoritos</li>
                  <li>Aguarde o alert dizer quantos items foram copiados</li>
                  <li>Volte aqui e clique em <b>"Colar e sincronizar"</b> abaixo</li>
                </ol>
              </div>

              {/* Botão principal: colar do clipboard */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={handlePasteFromClipboard}
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Colar e sincronizar
                    </>
                  )}
                </button>
                <button
                  onClick={handleTestClipboard}
                  disabled={loading}
                  title="Ver o que está atualmente no clipboard"
                  className="px-3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs disabled:opacity-50"
                >
                  🔍 Testar clipboard
                </button>
              </div>

              {/* Fallback manual */}
              {(showManualPaste || clipboardChecked) && !loading && (
                <details open={showManualPaste} className="border border-slate-200 rounded-xl overflow-hidden">
                  <summary className="px-4 py-2 bg-slate-50 cursor-pointer text-xs font-medium text-slate-600 hover:bg-slate-100 select-none">
                    Modo manual (sem clipboard)
                  </summary>
                  <div className="px-4 py-3 space-y-2">
                    <p className="text-xs text-slate-600">
                      Se o botão acima não funcionou, cole o cookie do Menudino aqui:
                    </p>
                    <textarea
                      value={cookie}
                      onChange={e => setCookie(e.target.value)}
                      placeholder="app-access-token=eyJhbGci...; merchant-summary=%257B..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono text-slate-700 focus:border-amber-500 outline-none resize-none"
                    />
                    <button
                      onClick={handleManualSync}
                      disabled={!cookieValido}
                      className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Sincronizar
                    </button>
                  </div>
                </details>
              )}
            </>
          )}

          {/* Logs */}
          {logs.length > 0 && !success && (
            <div className="mt-4 bg-slate-900 text-slate-100 rounded-xl p-3 max-h-64 overflow-y-auto font-mono text-xs">
              {logs.map((line, i) => (
                <div key={i} className={line.startsWith('===') ? 'text-amber-300 font-bold' : ''}>
                  {line || '\u00A0'}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
              <div className="font-bold mb-1">Erro</div>
              <div className="whitespace-pre-wrap break-words">{error}</div>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-900">
              <div className="font-bold mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Sincronização concluída
              </div>
              <div className="space-y-1 text-xs">
                <div>Categorias novas: <b>{success.stats.categorias_novas}</b></div>
                <div>Reorganizadas: <b>{success.stats.categorias_movidas}</b></div>
                <div>Items adicionados: <b>{success.stats.adicionados}</b></div>
                <div>Items atualizados: <b>{success.stats.atualizados}</b></div>
                <div>Items inativados: <b>{success.stats.inativados}</b></div>
              </div>
              <div className="mt-3 border-t border-green-200 pt-2">
                <div className="font-medium mb-1">Estrutura final:</div>
                {success.estruturaFinal.map((s, i) => (
                  <div key={i} className="text-xs">
                    [{s.label}] {s.nCats} categorias, {s.nItens} items
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-200 disabled:opacity-50"
          >
            {success ? 'Fechar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  )
}
