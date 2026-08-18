/**
 * lib/logger.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Logs de auditoria estruturados.
 * O Vercel captura automaticamente a saída de console.log como logs da função.
 * Acesse em: Vercel Dashboard → Project → Logs
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Extrai o IP real do visitante considerando proxies (Vercel usa Cloudflare).
 */
function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Registra uma ação de auditoria.
 * @param {string} action  - Identificador da ação (ex: 'LOGIN_SUCCESS')
 * @param {object} req     - Request para extrair IP e info
 * @param {object} [extra] - Dados adicionais opcionais
 */
export function auditLog(action, req, extra = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    ip: getIp(req),
    userAgent: req.headers['user-agent'] ?? 'unknown',
    ...extra,
  };
  // Formato JSON facilita parsing por ferramentas de monitoramento
  console.log(JSON.stringify(entry));
}
