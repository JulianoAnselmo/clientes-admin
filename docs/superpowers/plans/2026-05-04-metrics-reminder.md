# Metrics Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar botão 📊 inline no card de cada cliente ativo 1 dia antes do vencimento da fatura; clique marca como enviado e some até o mês seguinte.

**Architecture:** Toda lógica fica em `GestaoClientesPage.jsx`. A função `metricsReminderDue` calcula se o lembrete deve aparecer. O handler `markMetricsSent` escreve `lastMetricsSent: 'YYYY-MM'` no Firestore e atualiza estado local imediatamente. Reutiliza o helper `currentMonth()` já existente no arquivo.

**Tech Stack:** React, Firebase Firestore (`setDoc` com `merge: true`), Tailwind CSS.

---

### Task 1: Adicionar função `metricsReminderDue`

**Files:**
- Modify: `src/pages/GestaoClientesPage.jsx` — bloco de helpers (após linha ~34, junto com `daysUntilDomainRenewal`)

- [ ] **Step 1: Adicionar a função após `daysUntilDomainRenewal`**

Abrir `src/pages/GestaoClientesPage.jsx`. Após a função `daysUntilDomainRenewal` (linha ~34), inserir:

```js
function metricsReminderDue(contract) {
  if (!contract || contract.status !== 'active') return false
  const today = new Date()
  const day = today.getDate()
  const payDay = contract.paymentDay
  const reminderDay = payDay === 1
    ? new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    : payDay - 1
  if (day !== reminderDay) return false
  return contract.lastMetricsSent !== currentMonth()
}
```

- [ ] **Step 2: Verificar que `currentMonth()` já existe no arquivo**

`currentMonth` está definido na linha 9 de `GestaoClientesPage.jsx` — não duplicar.

- [ ] **Step 3: Commit**

```bash
git add src/pages/GestaoClientesPage.jsx
git commit -m "feat(metrics): adiciona metricsReminderDue"
```

---

### Task 2: Adicionar handler `markMetricsSent`

**Files:**
- Modify: `src/pages/GestaoClientesPage.jsx` — dentro do componente `GestaoClientesPage`, após `handleMarkPaid` (~linha 474)

- [ ] **Step 1: Adicionar o handler dentro do componente**

Após a função `handleMarkPaid`, inserir:

```js
async function markMetricsSent(slug) {
  const month = currentMonth()
  await setDoc(doc(db, 'contracts', slug), { lastMetricsSent: month }, { merge: true })
  setContracts(prev => ({
    ...prev,
    [slug]: { ...prev[slug], lastMetricsSent: month }
  }))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/GestaoClientesPage.jsx
git commit -m "feat(metrics): adiciona markMetricsSent handler"
```

---

### Task 3: Adicionar botão 📊 inline no card do cliente

**Files:**
- Modify: `src/pages/GestaoClientesPage.jsx` — dentro do `.map(r => ...)`, ao lado do botão 💬 (~linha 687)

- [ ] **Step 1: Inserir botão antes do botão 💬**

Localizar o bloco do botão 💬 (WhatsApp):

```jsx
{hasContract && (
  <a
    href={whatsappLink(r.phone, r.name, c.contractValue, c.paymentDay)}
    target="_blank"
    rel="noopener noreferrer"
    title="Lembrete via WhatsApp"
    className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 w-8 h-8 rounded-lg transition flex items-center justify-center"
  >
    💬
  </a>
)}
```

Inserir **antes** desse bloco:

```jsx
{hasContract && metricsReminderDue(c) && (
  <button
    onClick={() => markMetricsSent(r.slug)}
    title="Enviar métricas hoje"
    className="text-xs bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 w-8 h-8 rounded-lg transition flex items-center justify-center"
  >
    📊
  </button>
)}
```

- [ ] **Step 2: Testar manualmente**

Para testar sem esperar o dia correto, temporariamente trocar `if (day !== reminderDay) return false` por `if (false) return false` em `metricsReminderDue`, verificar que o botão 📊 aparece nos clientes ativos com contrato, clicar no botão, verificar que some imediatamente, e reverter a mudança temporária.

- [ ] **Step 3: Commit final**

```bash
git add src/pages/GestaoClientesPage.jsx
git commit -m "feat(metrics): botão lembrete de métricas inline no card do cliente"
```

---

### Task 4: Push

- [ ] **Step 1: Push para origin**

```bash
git push
```
