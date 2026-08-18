/**
 * api/sales/[id].js
 * PATCH  /api/sales/:id  → editar venda
 * DELETE /api/sales/:id  → excluir venda
 */
import { db } from '../../lib/firebase.js';
import { validateAuth } from '../../lib/auth.js';
import { setCorsHeaders, handlePreflight } from '../../lib/cors.js';
import { auditLog } from '../../lib/logger.js';
import { validateSale } from '../../lib/validate.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res, 'PATCH, DELETE, OPTIONS');
  if (handlePreflight(req, res)) return;

  // Validar autenticação JWT
  if (!validateAuth(req)) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID da venda é obrigatório.' });
  }

  const docRef = db.collection('sales').doc(id);

  // ──────────────────────────────────────────
  // PATCH /api/sales/:id  →  atualizar venda
  // ──────────────────────────────────────────
  if (req.method === 'PATCH') {
    try {
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Venda não encontrada.' });
      }

      // Validar apenas os campos enviados (requireAll = false)
      const updates = validateSale(req.body, false);

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Nenhum campo válido para atualizar.' });
      }

      await docRef.update(updates);
      auditLog('SALE_UPDATED', req, { saleId: id, fields: Object.keys(updates) });

      const updated = { id, ...doc.data(), ...updates };
      return res.status(200).json(updated);
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      console.error('PATCH /api/sales/:id error:', err);
      return res.status(500).json({ error: 'Erro ao atualizar venda.' });
    }
  }

  // ──────────────────────────────────────────
  // DELETE /api/sales/:id  →  excluir venda
  // ──────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      await docRef.delete();
      auditLog('SALE_DELETED', req, { saleId: id });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('DELETE /api/sales/:id error:', err);
      return res.status(500).json({ error: 'Erro ao excluir venda.' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
