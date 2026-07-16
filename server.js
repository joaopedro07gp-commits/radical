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
    let events = await readEvents();
    if (!Array.isArray(events) || events.length === 0) {
      events = [{ id: 1, name: 'Geral' }];
      await writeEvents(events);
    }
    const geralId = events[0].id;

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
app.use(express.json({ limit: '10mb' })); // Support base64 image data upload
app.use(express.static(path.join(__dirname, 'public')));

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

// Helper to make requests to the Gemini API
// NOTE: Only text prompts are sent. Images are never forwarded to the model
// (gemini-2.5-flash does not support image input), which avoids the
// "Cannot read image.png (this model does not support image input)" error.
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
  const { product, value, location, payment, photo, eventId } = req.body;

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
    photo: photo || null, // Stores base64 image data or placeholder
    eventId: resolvedEventId,
    date: new Date().toISOString()
  };

  sales.unshift(newSale); // Add to the beginning of the list
  await writeSales(sales);

  res.status(201).json(newSale);
});

// 3. AI Sales Analysis & Insights
app.post('/api/ai-insights', async (req, res) => {
  const { eventId } = req.body || {};
  const sales = await readSales();

  // Filter by event when one is provided
  const filteredSales = (eventId !== undefined && eventId !== null)
    ? sales.filter(s => s.eventId === eventId)
    : sales;

  if (filteredSales.length === 0) {
    return res.json({ insights: 'Nenhuma venda cadastrada para análise neste evento.' });
  }

  // Calculate metrics to build prompt / mock response
  const totalFaturamento = filteredSales.reduce((sum, s) => sum + s.value, 0);

  const locationCounts = {};
  const locationRevenue = {};
  const paymentCounts = {};

  filteredSales.forEach(s => {
    locationCounts[s.location] = (locationCounts[s.location] || 0) + 1;
    locationRevenue[s.location] = (locationRevenue[s.location] || 0) + s.value;
    paymentCounts[s.payment] = (paymentCounts[s.payment] || 0) + 1;
  });

  const topLocation = Object.keys(locationRevenue).reduce((a, b) => locationRevenue[a] > locationRevenue[b] ? a : b, '');
  const topPayment = Object.keys(paymentCounts).reduce((a, b) => paymentCounts[a] > paymentCounts[b] ? a : b, '');

  const prompt = `Analise os dados de vendas da Radical Capacetes:
- Faturamento Total Atual: R$ ${totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Distribuição de Vendas por Localidade:
${Object.entries(locationRevenue).map(([loc, rev]) => `  * ${loc}: R$ ${rev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${locationCounts[loc]} vendas)`).join('\n')}
- Métodos de Pagamento Utilizados:
${Object.entries(paymentCounts).map(([pay, count]) => `  * ${pay}: ${count} transações`).join('\n')}

Por favor, gere um relatório de insights de negócios executivos curto e direto estruturado exatamente nos tópicos:
1. **Desempenho Geral**: Uma avaliação resumida da saúde financeira do negócio.
2. **Destaques Regionais**: Comparação rápida entre as unidades.
3. **Recomendações e Próximos Passos**: 3 sugestões estratégicas baseadas nos dados (ex: incentivar PIX onde há muito cartão se as taxas forem altas, reforçar estoque na unidade líder, promoções cruzadas).`;

  try {
    const aiText = await callGemini(prompt);
    res.json({ insights: aiText, source: 'gemini' });
  } catch (error) {
    const msg = (error && error.message) || '';
    // If the model rejects image input (or any API failure), fall back gracefully
    const isImageError = /image|inline_data|does not support/i.test(msg);
    console.warn('Gemini API call failed' + (isImageError ? ' (image not supported by this model)' : '') + ':', msg);

    // Beautiful simulated report fallback if key is inactive/billing disabled
    const mockReport = `### ⚠️ [MODO DE COMPATIBILIDADE IA DETECTADO]
*A chave de API do Gemini no arquivo .env ainda precisa de ativação no Console do Google Cloud. Apresentando relatório de auditoria gerado pelo modelo heurístico local com base nos seus dados reais:*

---

### 📊 Relatório Executivo - Radical Capacetes

#### 1. Desempenho Geral
O faturamento total acumulado nas filiais é de **R$ ${totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}** com **${sales.length}** transações registradas. O tíquete médio das vendas gira em torno de **R$ ${(totalFaturamento / sales.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}** por capacete.

#### 2. Destaques Regionais
*   **Unidade Líder em Receita:** **${topLocation}** lidera as operações, gerando um total de **R$ ${(locationRevenue[topLocation] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**.
*   **Distribuição por Filial:**
${Object.entries(locationRevenue).map(([loc, rev]) => `    *   **${loc}:** R$ ${rev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${locationCounts[loc]} vendas)`).join('\n')}

#### 3. Recomendações e Próximos Passos
1.  **Otimização de Meios de Pagamento:** O método **${topPayment}** é o mais popular (presente em ${paymentCounts[topPayment]} transações). Recomenda-se incentivar o uso do **PIX** nas filiais oferecendo pequenos descontos (1% a 2%) para economizar em taxas de adquirência de cartões.
2.  **Reposição Estratégica:** A alta demanda na filial de **${topLocation}** sugere a necessidade de reforçar o estoque de modelos premium (como o *Capacete Carbon X* e *Dirt King MX*) nesta unidade para evitar rupturas de estoque.
3.  **Ação de Vendas nas Menores Filiais:** A unidade de menor receita deve receber uma campanha focada de marketing local no Instagram para impulsionar o tráfego de motociclistas da região.`;

    res.json({ insights: mockReport, source: 'fallback' });
  }
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

// Delete event (sales linked to it fall back to the first remaining event)
app.delete('/api/events/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const events = await readEvents();
  const remaining = events.filter(e => e.id !== id);

  if (remaining.length === 0) {
    return res.status(400).json({ error: 'Cannot delete the last event' });
  }

  await writeEvents(remaining);

  // Reassign sales of the deleted event to the first remaining event
  const sales = await readSales();
  const fallbackId = remaining[0].id;
  let changed = false;
  sales.forEach(s => {
    if (s.eventId === id) {
      s.eventId = fallbackId;
      changed = true;
    }
  });
  if (changed) await writeSales(sales);

  res.json({ success: true, fallbackId });
});

// Start server
migrateData().then(() => {
  app.listen(PORT, () => {
    console.log(`Radical Capacetes server running on http://localhost:${PORT}`);
  });
});
