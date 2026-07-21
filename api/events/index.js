import { db } from '../../lib/firebase.js';
import { validateAuth } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Validate Authentication Token
  if (!validateAuth(req)) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }

  // ──────────────────────────────────────────
  // GET /api/events  →  list all events
  // ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const snapshot = await db.collection('events').orderBy('createdAt').get();
      const events = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return res.status(200).json(events);
    } catch (err) {
      console.error('GET /api/events error:', err);
      return res.status(500).json({ error: 'Erro ao buscar eventos.' });
    }
  }

  // ──────────────────────────────────────────
  // POST /api/events  →  create a new event
  // ──────────────────────────────────────────
  if (req.method === 'POST') {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome do evento é obrigatório.' });
    }

    try {
      const newEvent = {
        name: name.trim(),
        createdAt: new Date().toISOString(),
      };

      const ref = await db.collection('events').add(newEvent);
      return res.status(201).json({ id: ref.id, ...newEvent });
    } catch (err) {
      console.error('POST /api/events error:', err);
      return res.status(500).json({ error: 'Erro ao criar evento.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
