/**
 * migrate-to-firestore.js
 * ─────────────────────────────────────────────────────────────
 * Script one-time para importar os dados existentes dos arquivos
 * JSON locais para o Firebase Firestore.
 *
 * Como usar:
 *   1. Configure seu arquivo .env.local com as variáveis do Firebase
 *   2. Execute: node scripts/migrate-to-firestore.js
 * ─────────────────────────────────────────────────────────────
 */

import { readFile } from 'fs/promises';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env.local first, fallback to .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Init Firebase ──────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────
async function readJSON(filePath) {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    console.warn(`⚠  Arquivo não encontrado ou inválido: ${filePath}`);
    return [];
  }
}

// ── Migration ──────────────────────────────────────────────────
async function migrate() {
  console.log('🔥 Iniciando migração para o Firestore...\n');

  // 1. Migrate events
  const eventsPath = path.join(__dirname, '..', 'data', 'events.json');
  const events = await readJSON(eventsPath);

  // Map from old numeric ID → new Firestore doc ID
  const eventIdMap = {};

  if (events.length === 0) {
    // Create a default "Geral" event if none exist
    console.log('⚡ Nenhum evento encontrado — criando evento padrão "Geral"...');
    const ref = await db.collection('events').add({
      name: 'Geral',
      createdAt: new Date().toISOString(),
    });
    eventIdMap[1] = ref.id;
    console.log(`   ✓ Evento "Geral" criado com ID: ${ref.id}`);
  } else {
    console.log(`📅 Migrando ${events.length} evento(s)...`);
    for (const ev of events) {
      const ref = await db.collection('events').add({
        name: ev.name,
        createdAt: new Date().toISOString(),
      });
      eventIdMap[ev.id] = ref.id;
      console.log(`   ✓ Evento "${ev.name}" → ${ref.id}`);
    }
  }

  // 2. Migrate sales
  const salesPath = path.join(__dirname, '..', 'data', 'sales.json');
  const sales = await readJSON(salesPath);

  if (sales.length === 0) {
    console.log('\n⚠  Nenhuma venda encontrada para migrar.');
  } else {
    console.log(`\n🛒 Migrando ${sales.length} venda(s)...`);

    const batch = db.batch();
    for (const sale of sales) {
      // Map old numeric eventId to new Firestore ID
      const newEventId = eventIdMap[sale.eventId] ?? Object.values(eventIdMap)[0] ?? null;

      const saleRef = db.collection('sales').doc();
      batch.set(saleRef, {
        product: sale.product ?? '',
        value: typeof sale.value === 'number' ? sale.value : 0,
        location: sale.location ?? '',
        payment: sale.payment ?? '',
        installments: sale.installments ?? null,
        eventId: newEventId,
        date: sale.date ?? new Date().toISOString(),
      });
    }

    await batch.commit();
    console.log(`   ✓ ${sales.length} vendas importadas com sucesso!`);
  }

  console.log('\n🎉 Migração concluída!');
  console.log('💡 Acesse o Firebase Console para verificar os dados:');
  console.log(`   https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID}/firestore`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Erro durante a migração:', err);
  process.exit(1);
});
