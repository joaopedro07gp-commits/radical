import { db } from '../../lib/firebase.js';
import { validateAuth } from '../../lib/auth.js';

export default async function handler(req, res) {
  // Allow CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Validate Authentication Token
  if (!validateAuth(req)) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }

  // ──────────────────────────────────────────
  // GET /api/sales  →  list all sales
  // ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const snapshot = await db
        .collection('sales')
        .orderBy('date', 'desc')
        .get();

      const sales = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return res.status(200).json(sales);
    } catch (err) {
      console.error('GET /api/sales error:', err);
      return res.status(500).json({ error: 'Erro ao buscar vendas.' });
    }
  }

  // ──────────────────────────────────────────
  // POST /api/sales  →  create a new sale
  // ──────────────────────────────────────────
  if (req.method === 'POST') {
    const { product, value, location, payment, eventId, installments, photo } = req.body;

    if (!product || !value || !location || !payment) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes.' });
    }

    // Resolve eventId: if not provided, use the first event
    let resolvedEventId = eventId ?? null;
    if (!resolvedEventId) {
      const evSnap = await db.collection('events').orderBy('createdAt').limit(1).get();
      resolvedEventId = evSnap.empty ? null : evSnap.docs[0].id;
    }

    try {
      const newSale = {
        product,
        value: parseFloat(value),
        location,
        payment,
        installments: installments ?? null,
        eventId: resolvedEventId,
        photo: photo ?? null,
        date: new Date().toISOString(),
      };

      const ref = await db.collection('sales').add(newSale);
      return res.status(201).json({ id: ref.id, ...newSale });
    } catch (err) {
      console.error('POST /api/sales error:', err);
      return res.status(500).json({ error: 'Erro ao criar venda.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
