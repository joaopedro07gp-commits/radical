/**
 * api/sales/index.js
 * GET  /api/sales  → lista todas as vendas
 * POST /api/sales  → cria nova venda
 */
import { db } from '../../lib/firebase.js';
import { validateAuth } from '../../lib/auth.js';
import { setCorsHeaders, handlePreflight } from '../../lib/cors.js';
import { auditLog } from '../../lib/logger.js';
import { validateSale } from '../../lib/validate.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res, 'GET, POST, OPTIONS');
  if (handlePreflight(req, res)) return;

  // Validar autenticação JWT
  if (!validateAuth(req)) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }

  // ──────────────────────────────────────────
  // GET /api/sales  →  listar vendas (filtradas por evento se informado)
  // ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url, 'http://localhost');
      const eventId = req.query?.eventId || url.searchParams.get('eventId');

      let snapshot;
      if (eventId && eventId !== 'all') {
        const numId = Number(eventId);
        const candidates = [String(eventId)];
        if (!isNaN(numId) && String(numId) === String(eventId)) {
          candidates.push(numId);
        }
        snapshot = await db.collection('sales').where('eventId', 'in', candidates).get();
      } else {
        snapshot = await db.collection('sales').get();
      }

      let sales = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Ordenar por data mais recente
      sales.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      return res.status(200).json(sales);
    } catch (err) {
      console.error('GET /api/sales error:', err);
      return res.status(500).json({ error: 'Erro ao buscar vendas.' });
    }
  }

  // ──────────────────────────────────────────
  // POST /api/sales  →  criar nova venda
  // ──────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      // Validação e sanitização do payload
      const validated = validateSale(req.body, true);
      const { product, value, location, payment, installments, photo, notes } = validated;

      // Resolver eventId
      let resolvedEventId = req.body.eventId ?? null;
      if (!resolvedEventId) {
        const evSnap = await db.collection('events').orderBy('createdAt').limit(1).get();
        resolvedEventId = evSnap.empty ? null : evSnap.docs[0].id;
      }

      const newSale = {
        product,
        value,
        location,
        payment,
        installments: installments ?? null,
        eventId: resolvedEventId,
        photo: photo ?? null,
        notes: notes ?? '',
        date: new Date().toISOString(),
      };

      const ref = await db.collection('sales').add(newSale);
      auditLog('SALE_CREATED', req, { saleId: ref.id, product, value });
      return res.status(201).json({ id: ref.id, ...newSale });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      console.error('POST /api/sales error:', err);
      return res.status(500).json({ error: 'Erro ao criar venda.' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
