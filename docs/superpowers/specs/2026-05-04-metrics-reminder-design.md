# Lembrete Mensal de Métricas

**Data:** 2026-05-04  
**Status:** Aprovado

## Objetivo

Mostrar um lembrete visual no card de cada cliente ativo 1 dia antes do vencimento da fatura mensal, para lembrar o admin de enviar o relatório de métricas. O lembrete some ao ser marcado como enviado.

## Dados

### Campo novo no contrato (`contracts/{slug}`)

```js
lastMetricsSent: null  // string 'YYYY-MM' após marcar, null se nunca
```

- Gerenciado exclusivamente pelo botão inline — não aparece no formulário de contrato.
- Persiste no Firestore via `setDoc` com `merge: true`.

## Lógica

### Função `metricsReminderDue(contract)`

Retorna `true` quando TODAS as condições são verdadeiras:

1. `contract.status === 'active'`
2. Hoje é o dia `paymentDay - 1` (se `paymentDay === 1`, dia anterior = último dia do mês corrente)
3. `lastMetricsSent !== currentMonth` onde `currentMonth = 'YYYY-MM'` de hoje

```js
function metricsReminderDue(contract) {
  if (!contract || contract.status !== 'active') return false
  const today = new Date()
  const day = today.getDate()
  const payDay = contract.paymentDay
  const reminderDay = payDay === 1
    ? new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() // último dia do mês
    : payDay - 1
  if (day !== reminderDay) return false
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  return contract.lastMetricsSent !== currentMonth
}
```

### Ação "Marcar como enviado"

```js
await setDoc(doc(db, 'contracts', slug), { lastMetricsSent: currentMonth }, { merge: true })
```

Após salvar, atualiza estado local dos contratos imediatamente (sem reload).

## UI

### Botão inline no card do cliente

Local: ao lado do botão 💬 (WhatsApp) na row de ações do card.

- **Visível quando:** `metricsReminderDue(c)` = true
- **Aparência:** `w-8 h-8` amarelo/laranja — `bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200`
- **Ícone:** 📊
- **Title:** "Enviar métricas hoje"
- **Ao clicar:** salva `lastMetricsSent`, remove botão do estado local imediatamente

### Sem novos KPI cards ou seções

Segue o padrão existente do botão 💬.

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/GestaoClientesPage.jsx` | Função `metricsReminderDue`, botão 📊, handler `markMetricsSent` |

## Fora de Escopo

- Envio automático de mensagem WhatsApp com métricas
- Histórico de envios (`metricsHistory` array)
- Notificações push/email
- Novo campo no formulário de contrato
