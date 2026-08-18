/**
 * lib/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Autenticação com JWT (JSON Web Tokens) de expiração configurável.
 *
 * Variáveis de ambiente necessárias:
 *   JWT_SECRET   — string longa e aleatória (mínimo 32 caracteres)
 *   TOKEN_EXPIRY — opcional, padrão "8h"
 * ─────────────────────────────────────────────────────────────────────────────
 */
import jwt from 'jsonwebtoken';
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

// ── JWT helpers ───────────────────────────────────────────────────────────────

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET não configurado ou muito curto. ' +
      'Defina uma string aleatória de ≥ 32 caracteres no .env.local e no Vercel.'
    );
  }
  return secret;
}

/**
 * Gera um token JWT assinado válido por TOKEN_EXPIRY (padrão: 8h).
 */
export function generateToken() {
  const secret = getJwtSecret();
  const expiry = process.env.TOKEN_EXPIRY || '8h';
  return jwt.sign({ sub: 'admin' }, secret, { expiresIn: expiry });
}

/**
 * Middleware: valida o token JWT enviado no header Authorization ou query param.
 * Retorna true se válido, false caso contrário.
 *
 * @param {object} req - Request do Express / Vercel
 */
export function validateAuth(req) {
  let secret;
  try {
    secret = getJwtSecret();
  } catch {
    return false;
  }

  // 1. Verificar header Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      jwt.verify(token, secret);
      return true;
    } catch {
      return false;
    }
  }

  // 2. Fallback para SSE: token na query string (?token=...)
  try {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (token) {
      jwt.verify(token, secret);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

// ── Password hashing (scrypt) ─────────────────────────────────────────────────

/**
 * Gera hash seguro da senha usando scrypt.
 */
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `v1:${salt}:${hash}`;
}

/**
 * Verifica senha contra hash armazenado.
 * Usa timingSafeEqual para evitar timing attacks.
 */
export function verifyPassword(password, stored) {
  if (!stored?.startsWith('v1:')) return false;
  const parts = stored.split(':');
  if (parts.length !== 3) return false;
  const [, salt, expectedHash] = parts;
  try {
    const computed = scryptSync(password, salt, 64).toString('hex');
    return timingSafeEqual(Buffer.from(computed), Buffer.from(expectedHash));
  } catch {
    return false;
  }
}
