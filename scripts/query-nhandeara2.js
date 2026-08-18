/**
 * query-nhandeara2.js — usa o arquivo JSON de service account diretamente
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  readFileSync(path.join('C:\\Users\\lusin\\Downloads\\radical-62bfc-firebase-adminsdk-fbsvc-dec9bdedac.json'), 'utf-8')
);

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function query() {
  // 1. Buscar todos os eventos
  const eventsSnap = await db.collection('events').get();
  const allEvents = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`\n📋 Total de eventos no banco: ${allEvents.length}`);
  allEvents.forEach(e => console.log(`  - [${e.id}] ${e.name} (criado: ${e.createdAt ?? 'sem data'})`));

  // 2. Filtrar eventos de Nhandeara
  const nhandearaEvents = allEvents.filter(e =>
    e.name?.toLowerCase().includes('nhandeara')
  );

  if (nhandearaEvents.length === 0) {
    console.log('\n❌ Nenhum evento com "Nhandeara" encontrado.');
    process.exit(0);
  }

  // Ordenar pelo mais recente
  const sorted = nhandearaEvents.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
    return dateB - dateA;
  });

  const targetEvent = sorted[0];
  console.log(`\n🎪 Último evento Nhandeara: "${targetEvent.name}" (ID: ${targetEvent.id})`);

  // 3. Buscar vendas do evento
  const salesSnap = await db.collection('sales')
    .where('eventId', '==', targetEvent.id)
    .get();

  const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  sales.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (sales.length === 0) {
    console.log('\n📭 Nenhuma venda registrada nesse evento.');
    process.exit(0);
  }

  let total = 0;
  const byLocation = {};
  const byPayment = {};
  const byProduct = {};

  console.log(`\n💰 ${sales.length} venda(s):\n`);
  sales.forEach((s, i) => {
    const valor = typeof s.value === 'number' ? s.value : 0;
    total += valor;
    byLocation[s.location] = (byLocation[s.location] || 0) + valor;
    byPayment[s.payment]   = (byPayment[s.payment]   || 0) + valor;
    byProduct[s.product]   = (byProduct[s.product]   || 0) + 1;

    console.log(`  ${i + 1}. ${s.product} — R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`     Local: ${s.location} | Pgto: ${s.payment}${s.installments ? ` (${s.installments}x)` : ''}`);
    console.log(`     Data: ${new Date(s.date).toLocaleString('pt-BR')}`);
    if (s.notes) console.log(`     Obs: ${s.notes}`);
    console.log('');
  });

  console.log('─'.repeat(55));
  console.log(`💵 TOTAL: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`📦 Qtd de vendas: ${sales.length}`);

  console.log('\n📍 Por localidade:');
  Object.entries(byLocation).sort((a,b) => b[1]-a[1]).forEach(([loc, val]) =>
    console.log(`   ${loc}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
  );

  console.log('\n💳 Por forma de pagamento:');
  Object.entries(byPayment).sort((a,b) => b[1]-a[1]).forEach(([pay, val]) =>
    console.log(`   ${pay}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
  );

  console.log('\n🪖 Produtos mais vendidos:');
  Object.entries(byProduct).sort((a,b) => b[1]-a[1]).forEach(([prod, qty]) =>
    console.log(`   ${prod}: ${qty}x`)
  );

  process.exit(0);
}

query().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
