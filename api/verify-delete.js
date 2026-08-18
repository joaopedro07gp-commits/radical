/**
 * api/verify-delete.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Verifica a senha de confirmação antes de deletar um evento.
 * Requer autenticação (Bearer token) + senha de deleção separada.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { validateAuth } from '../lib/auth.js';
import { setCorsHeaders, handlePreflight } from '../lib/cors.js';
import { auditLog } from '../lib/logger.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res, 'POST, OPTIONS');
  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // Verificar autenticação principal (JWT)
  if (!validateAuth(req)) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  // Verificar se ADMIN_DELETE_PASSWORD está configurado
  const deletePassword = process.env.ADMIN_DELETE_PASSWORD;
  if (!deletePassword) {
    console.error('ADMIN_DELETE_PASSWORD não está configurada nas variáveis de ambiente.');
    return res.status(500).json({ error: 'Configuração de servidor inválida.' });
  }

  const { password } = req.body || {};

  if (!password || typeof password !== 'string') {
    auditLog('DELETE_VERIFY_FAILED', req, { reason: 'missing_password' });
    return res.status(400).json({ error: 'Senha é obrigatória.' });
  }

  if (password !== deletePassword) {
    auditLog('DELETE_VERIFY_FAILED', req, { reason: 'wrong_password' });
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  auditLog('DELETE_VERIFY_SUCCESS', req);
  return res.status(200).json({ success: true });
}
