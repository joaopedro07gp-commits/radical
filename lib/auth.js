// lib/auth.js
import { createHash } from 'crypto';

/**
 * Gera um token simples e determinístico baseado na senha do administrador.
 * Como o ambiente da Vercel recria as instâncias, usar a própria senha como semente do hash
 * elimina a necessidade de um banco de sessões mantendo o processo seguro e stateless.
 */
export function getExpectedToken() {
  const password = process.env.ADMIN_PASSWORD || '1234';
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Middleware para validar o token enviado no cabeçalho Authorization ou query param.
 */
export function validateAuth(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token) return token === getExpectedToken();
  }

  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  if (token) return token === getExpectedToken();

  return false;
}
