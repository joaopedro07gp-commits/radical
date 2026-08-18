/**
 * api/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Endpoint de autenticação com:
 *   - Rate limiting: máx. 5 tentativas por IP a cada 15 minutos
 *   - Sem senhas hardcoded — usa exclusivamente ADMIN_PASSWORD do ambiente
 *   - Logs de auditoria para sucesso e falha
 *   - Resposta com JWT assinado (expiração configurável via TOKEN_EXPIRY)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { generateToken } from '../lib/auth.js';
import { setCorsHeaders, handlePreflight } from '../lib/cors.js';
import { auditLog } from '../lib/logger.js';

// ── Rate Limiting (in-memory, por instância Vercel) ────────────────────────
// Persiste enquanto a instância está "quente". Eficaz contra força bruta básica.
const attempts = new Map(); // ip → { count: number, resetAt: number }

const MAX_ATTEMPTS   = 5;
const WINDOW_MS      = 15 * 60 * 1000; // 15 minutos
const BLOCK_RESPONSE = 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.';

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

function isRateLimited(ip) {
  const now  = Date.now();
  const rec  = attempts.get(ip);

  if (!rec || now >= rec.resetAt) {
    // Primeira tentativa ou janela expirada → iniciar nova janela
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (rec.count >= MAX_ATTEMPTS) return true;

  rec.count++;
  return false;
}

function clearAttempts(ip) {
  attempts.delete(ip);
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCorsHeaders(req, res, 'POST, OPTIONS');
  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const ip = getClientIp(req);

  // ── Rate limiting ──────────────────────────────────────────────────────
  if (isRateLimited(ip)) {
    auditLog('LOGIN_BLOCKED', req, { reason: 'rate_limit' });
    return res.status(429).json({ error: BLOCK_RESPONSE });
  }

  // ── Verificar se ADMIN_PASSWORD está configurado ───────────────────────
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('ADMIN_PASSWORD não está configurada nas variáveis de ambiente.');
    return res.status(500).json({ error: 'Configuração de servidor inválida.' });
  }

  const { password } = req.body || {};

  if (!password || typeof password !== 'string') {
    auditLog('LOGIN_FAILED', req, { reason: 'missing_password' });
    return res.status(400).json({ error: 'Senha é obrigatória.' });
  }

  // ── Comparação de senha ────────────────────────────────────────────────
  if (password !== adminPassword) {
    auditLog('LOGIN_FAILED', req, { reason: 'wrong_password' });
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  // ── Login bem-sucedido ─────────────────────────────────────────────────
  try {
    const token = generateToken();
    clearAttempts(ip); // Resetar tentativas após sucesso
    auditLog('LOGIN_SUCCESS', req);
    return res.status(200).json({ success: true, token });
  } catch (err) {
    console.error('Erro ao gerar token:', err.message);
    return res.status(500).json({ error: 'Erro interno ao autenticar.' });
  }
}
