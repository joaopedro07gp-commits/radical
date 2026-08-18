/**
 * api/events/index.js
 * GET  /api/events  → listar eventos
 * POST /api/events  → criar evento
 */
import { db } from '../../lib/firebase.js';
import { validateAuth } from '../../lib/auth.js';
import { setCorsHeaders, handlePreflight } from '../../lib/cors.js';
import { auditLog } from '../../lib/logger.js';
import { validateEventName } from '../../lib/validate.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res, 'GET, POST, OPTIONS');
  if (handlePreflight(req, res)) return;

  // Validar autenticação JWT
  if (!validateAuth(req)) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }

  // ──────────────────────────────────────────
  // GET /api/events  →  listar todos os eventos
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
  // POST /api/events  →  criar novo evento
  // ──────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const name = validateEventName(req.body?.name);

      const newEvent = {
        name,
        createdAt: new Date().toISOString(),
      };

      const ref = await db.collection('events').add(newEvent);
      auditLog('EVENT_CREATED', req, { eventId: ref.id, name });
      return res.status(201).json({ id: ref.id, ...newEvent });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      console.error('POST /api/events error:', err);
      return res.status(500).json({ error: 'Erro ao criar evento.' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
