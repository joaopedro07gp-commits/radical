/**
 * lib/cors.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Helper CORS com whitelist de origens.
 *
 * Configure a variável de ambiente ALLOWED_ORIGIN com a URL do seu app
 * no Vercel (ex: https://radical-capacetes.vercel.app).
 * Em desenvolvimento local, http://localhost:3000 é sempre permitida.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const buildAllowedOrigins = () => {
  const origins = [];
  if (process.env.ALLOWED_ORIGIN) origins.push(process.env.ALLOWED_ORIGIN);
  if (process.env.NODE_ENV !== 'production') origins.push('http://localhost:3000');
  return origins;
};

/**
 * Define os cabeçalhos CORS na resposta.
 * @param {object} req  - Request do Express / Vercel
 * @param {object} res  - Response do Express / Vercel
 * @param {string} methods - Métodos HTTP permitidos
 */
export function setCorsHeaders(req, res, methods = 'GET, POST, OPTIONS') {
  const allowedOrigins = buildAllowedOrigins();
  const origin = req.headers.origin;

  if (allowedOrigins.length === 0) {
    // Nenhuma origem configurada: permitir apenas same-origin
    // (no Vercel, as funções são same-origin com o frontend)
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

/**
 * Responde ao preflight OPTIONS e retorna true se foi respondido.
 */
export function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
