import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyD7ImWnSeSb3DTuyXTnS55gRsqkBZZv5q8",
  authDomain: "clientes-admin-a2258.firebaseapp.com",
  projectId: "clientes-admin-a2258",
  storageBucket: "clientes-admin-a2258.firebasestorage.app",
  messagingSenderId: "598293541730",
  appId: "1:598293541730:web:bdee1e314b46e5fa9ff23b"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// Criar documento do admin
const uid = '7WRsabeWjLYEnYMwoWB5nm3wBFv1'

await setDoc(doc(db, 'users', uid), {
  email: 'juliano-gema@hotmail.com',
  displayName: 'Juliano',
  role: 'admin',
  restaurantSlug: null,
  createdAt: new Date().toISOString()
})

console.log('Admin criado com sucesso!')

// Criar restaurante Marieta como exemplo
await setDoc(doc(db, 'restaurants', 'marieta-bistro'), {
  name: 'Marieta Bistrô',
  slug: 'marieta-bistro',
  ownerId: uid,
  createdAt: new Date().toISOString()
})

console.log('Restaurante Marieta Bistrô criado!')

// Seed cardápio do Marieta
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const cardapioData = JSON.parse(readFileSync(join(__dirname, '..', 'cardapio-data.json'), 'utf8'))
await setDoc(doc(db, 'restaurants', 'marieta-bistro', 'data', 'cardapio'), {
  content: cardapioData,
  updatedAt: new Date().toISOString()
})

console.log('Cardápio do Marieta populado!')

// Seed promoções do Marieta
const promocoesData = {
  "domingo": [],
  "segunda": [],
  "terca": [{ "texto": "Prato em Dobro — peça um prato principal e ganhe outro!" }],
  "quarta": [{ "texto": "Rodízio de Risoto", "destaque": true }],
  "quinta": [{ "texto": "Happy Hour — drinks com 20% de desconto até 21h" }],
  "sexta": [{ "texto": "Menu Degustação Especial do Chef" }, { "texto": "DJ ao vivo a partir das 21h" }],
  "sabado": [{ "texto": "Noite Especial — menu exclusivo com harmonização de vinhos", "destaque": true }]
}

await setDoc(doc(db, 'restaurants', 'marieta-bistro', 'data', 'promocoes'), {
  content: promocoesData,
  updatedAt: new Date().toISOString()
})

console.log('Promoções do Marieta populadas!')
console.log('\nTudo pronto! Pode fazer login no app.')
process.exit(0)
