import { db } from '../../lib/firebase.js';
import { validateAuth } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Validate Authentication Token
  if (!validateAuth(req)) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }

  // The document ID comes from the URL parameter [id]
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID da venda é obrigatório.' });
  }

  const docRef = db.collection('sales').doc(id);

  // ──────────────────────────────────────────
  // PATCH /api/sales/:id  →  update a sale
  // ──────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { product, value, location, payment, eventId, installments, photo } = req.body;

    try {
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Venda não encontrada.' });
      }

      const updates = {};
      if (product !== undefined)      updates.product = product;
      if (value !== undefined)        updates.value = parseFloat(value);
      if (location !== undefined)     updates.location = location;
      if (payment !== undefined)      updates.payment = payment;
      if (eventId !== undefined)      updates.eventId = eventId;
      if (installments !== undefined) updates.installments = installments;
      if (photo !== undefined)        updates.photo = photo;

      await docRef.update(updates);

      const updated = { id, ...doc.data(), ...updates };
      return res.status(200).json(updated);
    } catch (err) {
      console.error('PATCH /api/sales/:id error:', err);
      return res.status(500).json({ error: 'Erro ao atualizar venda.' });
    }
  }

  // ──────────────────────────────────────────
  // DELETE /api/sales/:id  →  delete a sale
  // ──────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Venda não encontrada.' });
      }

      await docRef.delete();
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('DELETE /api/sales/:id error:', err);
      return res.status(500).json({ error: 'Erro ao excluir venda.' });
    }
  }

  // ──────────────────────────────────────────
  // SSE /api/sales/stream  →  real-time updates
  // Usage: /api/sales/stream?eventId=...
  // ──────────────────────────────────────────
  if (req.url.includes('/stream')) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const eventId = url.searchParams.get('eventId');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      let q = db.collection('sales').orderBy('date', 'desc');
      if (eventId) q = q.where('eventId', '==', eventId);

      const unsubscribe = q.onSnapshot((snapshot) => {
        const sales = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        res.write(`data: ${JSON.stringify(sales)}\n\n`);
      });

      req.on('close', () => {
        unsubscribe();
        res.end();
      });
    } catch (err) {
      console.error('SSE /api/sales/stream error:', err);
      res.status(500).end();
    }
    return;
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
