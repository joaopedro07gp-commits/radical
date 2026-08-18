import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

// ── Funções de hash de senha ──────────────────────────────────────────────────
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `v1:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('v1:')) return false;
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

// ── JWT helpers ───────────────────────────────────────────────────────────────
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET não configurado ou muito curto no .env.local');
  }
  return secret;
}

function generateToken() {
  return jwt.sign({ sub: 'admin' }, getJwtSecret(), {
    expiresIn: process.env.TOKEN_EXPIRY || '8h',
  });
}

function validateJwt(token) {
  try {
    jwt.verify(token, getJwtSecret());
    return true;
  } catch {
    return false;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// ── Paths ─────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DATA_FILE        = path.join(__dirname, 'data', 'sales.json');
const EVENTS_FILE      = path.join(__dirname, 'data', 'events.json');
const CREDENTIALS_FILE = path.join(__dirname, 'data', 'credentials.json');

// ── Migração de dados ─────────────────────────────────────────────────────────
async function migrateData() {
  try {
    let fileExists = true;
    try { await fs.access(EVENTS_FILE); } catch { fileExists = false; }

    let events = await readEvents();
    if (!fileExists && (!Array.isArray(events) || events.length === 0)) {
      events = [{ id: 1, name: 'Geral' }];
      await writeEvents(events);
    }
    const geralId = events.length > 0 ? events[0].id : null;

    const sales = await readSales();
    let changed = false;
    sales.forEach(s => {
      if (s.eventId === undefined || s.eventId === null) {
        s.eventId = geralId;
        changed = true;
      }
    });
    if (changed) await writeSales(sales);
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

// ── Middlewares ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.ALLOWED_ORIGIN,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (ex: curl, Postman em dev)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Origem não permitida pelo CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' })); // Limitar tamanho do payload

// Servir estáticos sem cache em desenvolvimento
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // Headers de segurança básicos mesmo em dev
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
  },
}));

// ── Verificar variáveis de ambiente críticas ──────────────────────────────────
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) console.warn('⚠ GEMINI_API_KEY não definida.');
try { getJwtSecret(); } catch (e) { console.warn('⚠', e.message); }
if (!process.env.ADMIN_PASSWORD) console.warn('⚠ ADMIN_PASSWORD não definida — autenticação desabilitada em modo local.');

// ── Middleware de autenticação para todas as rotas /api/* ─────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (validateJwt(token)) return next();
  }
  // Fallback SSE: token na query string
  const urlToken = new URL(req.url, 'http://localhost').searchParams.get('token');
  if (urlToken && validateJwt(urlToken)) return next();

  return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
}

// ── Rate Limiting para /api/auth ──────────────────────────────────────────────
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS    = 15 * 60 * 1000;

function rateLimit(req, res, next) {
  const ip  = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { count: 0, resetAt: now + WINDOW_MS };

  if (now >= rec.resetAt) { rec.count = 0; rec.resetAt = now + WINDOW_MS; }
  if (rec.count >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
  }
  rec.count++;
  loginAttempts.set(ip, rec);
  next();
}

// ── Helpers de armazenamento em JSON ─────────────────────────────────────────
async function readSales() {
  try { return JSON.parse(await fs.readFile(DATA_FILE, 'utf-8')); }
  catch { return []; }
}

async function writeSales(sales) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(sales, null, 2), 'utf-8');
}

async function readEvents() {
  try { return JSON.parse(await fs.readFile(EVENTS_FILE, 'utf-8')); }
  catch { return []; }
}

async function writeEvents(events) {
  await fs.mkdir(path.dirname(EVENTS_FILE), { recursive: true });
  await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf-8');
}

async function readCredentials() {
  try { return JSON.parse(await fs.readFile(CREDENTIALS_FILE, 'utf-8')); }
  catch {
    const initial = {
      login: hashPassword(process.env.ADMIN_PASSWORD || 'radical4321'),
      deleteEvent: hashPassword(process.env.ADMIN_DELETE_PASSWORD || 'radical017'),
    };
    await writeCredentials(initial);
    return initial;
  }
}

async function writeCredentials(credentials) {
  await fs.mkdir(path.dirname(CREDENTIALS_FILE), { recursive: true });
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), 'utf-8');
}

// ── Gemini API ────────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  if (!API_KEY) throw new Error('GEMINI_API_KEY não configurada.');

  const model = 'gemini-2.5-flash';
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: String(prompt) }] }],
    systemInstruction: {
      parts: [{ text: 'Você é um consultor financeiro e analista de negócios sênior especializado no mercado varejista brasileiro de motos e acessórios (como capacetes). Forneça análises assertivas, diretas e acionáveis em português do Brasil.' }],
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (Status ${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Nenhum conteúdo retornado pela API Gemini.');
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROTAS DE API
// ─────────────────────────────────────────────────────────────────────────────

// Autenticação (com rate limiting, sem autenticação prévia)
app.post('/api/auth', rateLimit, async (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD não configurada.' });
  }

  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Senha é obrigatória.' });
  }

  if (password !== adminPassword) {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), action: 'LOGIN_FAILED', ip: req.ip }));
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  try {
    const token = generateToken();
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), action: 'LOGIN_SUCCESS', ip: req.ip }));
    return res.status(200).json({ success: true, token });
  } catch (err) {
    console.error('Erro ao gerar token:', err.message);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// Verificação de senha de deleção
app.post('/api/verify-delete', requireAuth, async (req, res) => {
  const deletePassword = process.env.ADMIN_DELETE_PASSWORD;
  if (!deletePassword) {
    return res.status(500).json({ error: 'ADMIN_DELETE_PASSWORD não configurada.' });
  }

  const { password } = req.body || {};
  if (!password || password !== deletePassword) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  return res.status(200).json({ success: true });
});

// Aplicar autenticação em todas as rotas /api/sales e /api/events
app.use('/api/sales', requireAuth);
app.use('/api/events', requireAuth);

// Vendas
app.get('/api/sales', async (req, res) => {
  const { eventId } = req.query;
  let sales = await readSales();
  if (eventId && eventId !== 'all') {
    sales = sales.filter(s => String(s.eventId) === String(eventId));
  }
  res.json(sales);
});

app.post('/api/sales', async (req, res) => {
  const { product, value, location, payment, eventId, installments, photo, notes } = req.body;

  if (!product || !value || !location || !payment) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes.' });
  }

  // Validar valor
  const numValue = parseFloat(value);
  if (!isFinite(numValue) || numValue <= 0 || numValue > 10_000_000) {
    return res.status(400).json({ error: 'Valor inválido.' });
  }

  // Validar foto se presente
  if (photo) {
    const VALID_PREFIXES = ['data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,'];
    if (!VALID_PREFIXES.some(p => photo.startsWith(p)) || photo.length > 700_000) {
      return res.status(400).json({ error: 'Imagem inválida ou muito grande.' });
    }
  }

  const sales  = await readSales();
  const events = await readEvents();
  const newId  = sales.length > 0 ? Math.max(...sales.map(s => s.id)) + 1 : 1;
  const resolvedEventId = (eventId !== undefined && eventId !== null)
    ? eventId
    : (events[0]?.id ?? null);

  const newSale = {
    id: newId,
    product: String(product).slice(0, 300),
    value: numValue,
    location,
    payment,
    installments: installments ?? null,
    eventId: resolvedEventId,
    photo: photo ?? null,
    notes: String(notes ?? '').slice(0, 2000),
    date: new Date().toISOString(),
  };

  sales.unshift(newSale);
  await writeSales(sales);
  res.status(201).json(newSale);
});

app.patch('/api/sales/:id', async (req, res) => {
  const id     = parseInt(req.params.id, 10);
  const { product, value, location, payment, eventId, installments, photo, notes } = req.body;

  const sales = await readSales();
  const index = sales.findIndex(s => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'Venda não encontrada.' });

  const sale = sales[index];
  if (product !== undefined) sale.product = String(product).slice(0, 300);
  if (value !== undefined)   sale.value   = parseFloat(value);
  if (location !== undefined)    sale.location    = location;
  if (payment !== undefined)     sale.payment     = payment;
  if (eventId !== undefined)     sale.eventId     = eventId;
  if (installments !== undefined) sale.installments = installments;
  if (photo !== undefined)       sale.photo       = photo;
  if (notes !== undefined)       sale.notes       = String(notes).slice(0, 2000);

  sales[index] = sale;
  await writeSales(sales);
  res.json(sale);
});

app.delete('/api/sales/:id', async (req, res) => {
  const id       = parseInt(req.params.id, 10);
  const sales    = await readSales();
  const filtered = sales.filter(s => s.id !== id);
  if (filtered.length === sales.length) return res.status(404).json({ error: 'Venda não encontrada.' });
  await writeSales(filtered);
  res.json({ success: true });
});

// Eventos
app.get('/api/events', async (req, res) => {
  res.json(await readEvents());
});

app.post('/api/events', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim() || name.trim().length > 200) {
    return res.status(400).json({ error: 'Nome do evento inválido.' });
  }

  const events = await readEvents();
  const newId  = events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1;
  const newEvent = { id: newId, name: name.trim() };
  events.push(newEvent);
  await writeEvents(events);
  res.status(201).json(newEvent);
});

app.delete('/api/events/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const events   = await readEvents();
  const remaining = events.filter(e => e.id !== id);
  await writeEvents(remaining);

  const sales   = await readSales();
  const filtered = sales.filter(s => String(s.eventId) !== String(id));
  if (filtered.length !== sales.length) await writeSales(filtered);

  res.json({ success: true });
});

// ── Inicialização ─────────────────────────────────────────────────────────────
migrateData().then(() => {
  app.listen(PORT, () => {
    console.log(`Radical Capacetes server running on http://localhost:${PORT}`);
  });
});
