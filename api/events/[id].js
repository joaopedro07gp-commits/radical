import { db } from '../../lib/firebase.js';
import { validateAuth } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Validate Authentication Token
  if (!validateAuth(req)) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }

  const { id } = req.query;

  // ──────────────────────────────────────────
  // DELETE /api/events/:id
  // Delete the event and its sales.
  // ──────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const evSnap = await db.collection('events').orderBy('createdAt').get();
      if (evSnap.empty) {
        return res.status(404).json({ error: 'Nenhum evento encontrado.' });
      }

      await db.collection('events').doc(id).delete();

      const salesSnap = await db
        .collection('sales')
        .where('eventId', '==', id)
        .get();

      if (!salesSnap.empty) {
        const batch = db.batch();
        salesSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('DELETE /api/events/:id error:', err);
      return res.status(500).json({ error: 'Erro ao excluir evento.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
