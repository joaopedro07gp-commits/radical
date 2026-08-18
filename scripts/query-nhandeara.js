/**
 * query-nhandeara.js
 * Busca o último evento de Nhandeara e todas as suas vendas no Firestore.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function query() {
  // Buscar todos os eventos
  const eventsSnap = await db.collection('events').get();
  const allEvents = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Filtrar eventos que contenham "nhandeara" (case-insensitive)
  const nhandearaEvents = allEvents.filter(e =>
    e.name?.toLowerCase().includes('nhandeara')
  );

  if (nhandearaEvents.length === 0) {
    console.log('\n❌ Nenhum evento com "Nhandeara" encontrado.');
    console.log('\nEventos disponíveis:');
    allEvents.forEach(e => console.log(`  - [${e.id}] ${e.name}`));
    process.exit(0);
  }

  // Pegar o mais recente (pelo campo createdAt ou pelo último da lista)
  const sorted = nhandearaEvents.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
    return dateB - dateA;
  });

  const targetEvent = sorted[0];
  console.log(`\n🎪 Evento encontrado: "${targetEvent.name}" (ID: ${targetEvent.id})`);
  if (targetEvent.createdAt) console.log(`   Criado em: ${targetEvent.createdAt}`);

  // Buscar todas as vendas desse evento
  const salesSnap = await db.collection('sales')
    .where('eventId', '==', targetEvent.id)
    .get();

  const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Ordenar por data
  sales.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (sales.length === 0) {
    console.log('\n📭 Nenhuma venda registrada nesse evento.');
    process.exit(0);
  }

  console.log(`\n💰 ${sales.length} venda(s) registrada(s):\n`);

  let total = 0;
  const byLocation = {};
  const byPayment = {};

  sales.forEach((s, i) => {
    const valor = typeof s.value === 'number' ? s.value : 0;
    total += valor;

    byLocation[s.location] = (byLocation[s.location] || 0) + valor;
    byPayment[s.payment]   = (byPayment[s.payment] || 0) + valor;

    console.log(`  ${i + 1}. ${s.product}`);
    console.log(`     Valor: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`     Local: ${s.location}  |  Pagamento: ${s.payment}${s.installments ? ` (${s.installments}x)` : ''}`);
    console.log(`     Data: ${new Date(s.date).toLocaleString('pt-BR')}`);
    if (s.notes) console.log(`     Obs: ${s.notes}`);
    console.log('');
  });

  console.log('─'.repeat(50));
  console.log(`💵 TOTAL GERAL: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  console.log('\n📍 Total por localidade:');
  Object.entries(byLocation).sort((a,b) => b[1]-a[1]).forEach(([loc, val]) => {
    console.log(`   ${loc}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  });

  console.log('\n💳 Total por forma de pagamento:');
  Object.entries(byPayment).sort((a,b) => b[1]-a[1]).forEach(([pay, val]) => {
    console.log(`   ${pay}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  });

  process.exit(0);
}

query().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
