/**
 * api/events/[id].js
 * DELETE /api/events/:id → excluir evento e todas as suas vendas
 */
import { db } from '../../lib/firebase.js';
import { validateAuth } from '../../lib/auth.js';
import { setCorsHeaders, handlePreflight } from '../../lib/cors.js';
import { auditLog } from '../../lib/logger.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res, 'DELETE, OPTIONS');
  if (handlePreflight(req, res)) return;

  // Validar autenticação JWT
  if (!validateAuth(req)) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID do evento é obrigatório.' });
  }

  // ──────────────────────────────────────────
  // DELETE /api/events/:id
  // Exclui o evento e todas as vendas vinculadas.
  // ──────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const eventRef = db.collection('events').doc(id);
      const eventDoc = await eventRef.get();

      if (!eventDoc.exists) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }

      const eventName = eventDoc.data()?.name ?? id;

      // Deletar o evento
      await eventRef.delete();

      // Deletar todas as vendas vinculadas em batch
      const salesSnap = await db
        .collection('sales')
        .where('eventId', '==', id)
        .get();

      if (!salesSnap.empty) {
        const batch = db.batch();
        salesSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      auditLog('EVENT_DELETED', req, { eventId: id, eventName, salesDeleted: salesSnap.size });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('DELETE /api/events/:id error:', err);
      return res.status(500).json({ error: 'Erro ao excluir evento.' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
