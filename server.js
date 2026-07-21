import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data', 'sales.json');
const EVENTS_FILE = path.join(__dirname, 'data', 'events.json');

// Ensure a default "Geral" event exists and that existing sales are linked to it
async function migrateData() {
  try {
    let fileExists = true;
    try {
      await fs.access(EVENTS_FILE);
    } catch {
      fileExists = false;
    }

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

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files without caching so the browser always loads the latest version
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Verify API key is available
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY environment variable is not defined in .env');
}

// Helpers for database interactions
async function readSales() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading sales file, returning empty array:', error.message);
    return [];
  }
}

async function writeSales(sales) {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(sales, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing sales file:', error.message);
  }
}

// Helpers for events storage
async function readEvents() {
  try {
    const data = await fs.readFile(EVENTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function writeEvents(events) {
  try {
    await fs.mkdir(path.dirname(EVENTS_FILE), { recursive: true });
    await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing events file:', error.message);
  }
}

// Helper to make requests to the Gemini API (text-only prompts)
async function callGemini(prompt) {
  if (!API_KEY) {
    throw new Error('API key is missing.');
  }

  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: String(prompt) }]
      }
    ],
    systemInstruction: {
      parts: [{ text: 'Você é um consultor financeiro e analista de negócios sênior especializado no mercado varejista brasileiro de motos e acessórios (como capacetes). Forneça análises assertivas, diretas e acionáveis em português do Brasil.' }]
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (Status ${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No content returned from Gemini API.');
  }

  return text;
}

// --- API ENDPOINTS ---

// 1. Fetch Sales List
app.get('/api/sales', async (req, res) => {
  const sales = await readSales();
  res.json(sales);
});

// 2. Add New Sale
app.post('/api/sales', async (req, res) => {
  const { product, value, location, payment, eventId, installments, photo } = req.body;

  if (!product || !value || !location || !payment) {
    return res.status(400).json({ error: 'Missing required sale parameters' });
  }

  const sales = await readSales();
  const events = await readEvents();
  const newId = sales.length > 0 ? Math.max(...sales.map(s => s.id)) + 1 : 1;

  // Default to the first available event if none provided
  const resolvedEventId = (eventId !== undefined && eventId !== null)
    ? eventId
    : (events[0]?.id ?? null);

  const newSale = {
    id: newId,
    product,
    value: parseFloat(value),
    location,
    payment,
    installments: installments ?? null,
    eventId: resolvedEventId,
    photo: photo ?? null,
    date: new Date().toISOString()
  };

  sales.unshift(newSale); // Add to the beginning of the list
  await writeSales(sales);

  res.status(201).json(newSale);
});

// 2b. Update Sale (edit)
app.patch('/api/sales/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { product, value, location, payment, eventId, installments, photo } = req.body;

  const sales = await readSales();
  const index = sales.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Sale not found' });
  }

  const sale = sales[index];
  if (product !== undefined) sale.product = product;
  if (value !== undefined) sale.value = parseFloat(value);
  if (location !== undefined) sale.location = location;
  if (payment !== undefined) sale.payment = payment;
  if (eventId !== undefined) sale.eventId = eventId;
  if (installments !== undefined) sale.installments = installments;
  if (photo !== undefined) sale.photo = photo;

  sales[index] = sale;
  await writeSales(sales);

  res.json(sale);
});

// 2c. Delete Sale
app.delete('/api/sales/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sales = await readSales();
  const filtered = sales.filter(s => s.id !== id);

  if (filtered.length === sales.length) {
    return res.status(404).json({ error: 'Sale not found' });
  }

  await writeSales(filtered);
  res.json({ success: true });
});

// --- EVENTS ENDPOINTS ---

// List events
app.get('/api/events', async (req, res) => {
  const events = await readEvents();
  res.json(events);
});

// Create event
app.post('/api/events', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Event name is required' });
  }

  const events = await readEvents();
  const newId = events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1;
  const newEvent = { id: newId, name: name.trim() };
  events.push(newEvent);
  await writeEvents(events);

  res.status(201).json(newEvent);
});

// Delete event (and its sales)
app.delete('/api/events/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const events = await readEvents();
  const remaining = events.filter(e => e.id !== id);

  await writeEvents(remaining);

  const sales = await readSales();
  const filtered = sales.filter(s => String(s.eventId) !== String(id));
  if (filtered.length !== sales.length) {
    await writeSales(filtered);
  }

  res.json({ success: true });
});

// Start server
migrateData().then(() => {
  app.listen(PORT, () => {
    console.log(`Radical Capacetes server running on http://localhost:${PORT}`);
  });
});
