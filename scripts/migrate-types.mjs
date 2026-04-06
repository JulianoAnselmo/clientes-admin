import { initializeApp } from 'firebase/app'
import { getFirestore, doc, updateDoc, setDoc } from 'firebase/firestore'

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

// 1. Atualizar Marieta para type "restaurante"
console.log('Atualizando Marieta Bistrô...')
await updateDoc(doc(db, 'restaurants', 'marieta-bistro'), {
  type: 'restaurante'
})
console.log('✅ Marieta Bistrô → type: restaurante')

// 2. Criar Quejinho Veículos como garagem
console.log('Criando Quejinho Veículos...')
await setDoc(doc(db, 'restaurants', 'quejinho-veiculos'), {
  name: 'Quejinho Veículos',
  slug: 'quejinho-veiculos',
  type: 'garagem',
  createdAt: new Date().toISOString()
})

// Inicializar veículos vazio
await setDoc(doc(db, 'restaurants', 'quejinho-veiculos', 'data', 'veiculos'), {
  content: [],
  updatedAt: new Date().toISOString()
})

// Inicializar businessInfo com dados do Quejinho
await setDoc(doc(db, 'restaurants', 'quejinho-veiculos', 'data', 'businessInfo'), {
  content: {
    name: "Quejinho Veículos",
    city: "Taquaritinga - SP",
    slogan: "Confiança que te leva mais longe",
    tagline: "Compra, Venda, Troca e Financiamento de Veículos",
    whatsapp: "(16) 99635-5566",
    whatsappNumber: "5516996355566",
    phone: "(16) 99635-5566",
    address: "Rua a confirmar, 000",
    neighborhood: "Centro",
    cityState: "Taquaritinga - SP",
    cep: "15900-000",
    hours: {
      weekdays: "Segunda a Sexta: 08:30 às 18:00",
      saturday: "Sábado: 08:30 às 12:00"
    },
    instagram: "https://instagram.com/quejinhoveiculostaquaritinga",
    facebook: "https://facebook.com/quejinhoveiculos",
    googleMapsEmbed: "https://www.google.com/maps?q=Taquaritinga+SP&output=embed",
    googleMapsLink: "https://www.google.com/maps/search/Quejinho+Ve%C3%ADculos+Taquaritinga+SP"
  },
  updatedAt: new Date().toISOString()
})

console.log('✅ Quejinho Veículos criado → type: garagem')
console.log('')
console.log('Migração concluída!')
console.log('Agora abra o admin e cadastre os veículos com fotos.')

process.exit(0)
