/**
 * lib/validate.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Validação de schema para as entradas do usuário.
 * Lança um Error com mensagem descritiva se a validação falhar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_LOCATIONS = ['Jales', 'Votuporanga', 'Rio Preto'];
const VALID_PAYMENTS  = ['PIX', 'DÉBITO', 'CRÉDITO', 'PARCELADO', 'DINHEIRO', 'Débito', 'Crédito', 'Parcelado', 'Cartão', 'Dinheiro'];
const MAX_PHOTO_BYTES = 700_000;   // ~500 KB em base64
const VALID_PHOTO_PREFIXES = [
  'data:image/jpeg;base64,',
  'data:image/jpg;base64,',
  'data:image/png;base64,',
  'data:image/webp;base64,',
  'data:image/gif;base64,',
];

/**
 * Valida os campos de uma venda (POST ou PATCH).
 * Retorna o objeto sanitizado ou lança um Error.
 *
 * @param {object} body - req.body
 * @param {boolean} requireAll - true para POST (todos obrigatórios), false para PATCH
 */
export function validateSale(body, requireAll = true) {
  const { product, value, location, payment, notes, installments, photo, eventId } = body;

  if (requireAll) {
    if (!product || !value || !location || !payment) {
      throw Object.assign(new Error('Parâmetros obrigatórios ausentes.'), { status: 400 });
    }
  }

  const out = {};

  if (product !== undefined) {
    if (typeof product !== 'string' || product.trim().length === 0 || product.length > 300) {
      throw Object.assign(new Error('Nome do produto inválido (máximo 300 caracteres).'), { status: 400 });
    }
    out.product = product.trim();
  }

  if (value !== undefined) {
    const num = parseFloat(value);
    if (!isFinite(num) || num <= 0 || num > 10_000_000) {
      throw Object.assign(new Error('Valor da venda inválido. Deve ser entre R$ 0,01 e R$ 10.000.000.'), { status: 400 });
    }
    out.value = num;
  }

  if (location !== undefined) {
    if (!VALID_LOCATIONS.includes(location)) {
      throw Object.assign(new Error(`Filial inválida. Valores aceitos: ${VALID_LOCATIONS.join(', ')}.`), { status: 400 });
    }
    out.location = location;
  }

  if (payment !== undefined) {
    if (!VALID_PAYMENTS.includes(payment)) {
      throw Object.assign(new Error(`Meio de pagamento inválido.`), { status: 400 });
    }
    out.payment = payment;
  }

  if (installments !== undefined) {
    if (installments !== null) {
      const inst = parseInt(installments, 10);
      if (!Number.isInteger(inst) || inst < 2 || inst > 12) {
        throw Object.assign(new Error('Número de parcelas inválido. Deve ser entre 2 e 12.'), { status: 400 });
      }
      out.installments = inst;
    } else {
      out.installments = null;
    }
  }

  if (notes !== undefined) {
    if (typeof notes !== 'string' || notes.length > 2000) {
      throw Object.assign(new Error('Observações muito longas (máximo 2000 caracteres).'), { status: 400 });
    }
    out.notes = notes.trim();
  }

  if (photo !== undefined) {
    if (photo !== null) {
      if (typeof photo !== 'string') {
        throw Object.assign(new Error('Formato de imagem inválido.'), { status: 400 });
      }
      const hasValidPrefix = VALID_PHOTO_PREFIXES.some(p => photo.startsWith(p));
      if (!hasValidPrefix) {
        throw Object.assign(new Error('Tipo de imagem não suportado. Use JPEG, PNG, WebP ou GIF.'), { status: 400 });
      }
      if (photo.length > MAX_PHOTO_BYTES) {
        throw Object.assign(new Error('Imagem muito grande. Máximo permitido: 500 KB.'), { status: 400 });
      }
      out.photo = photo;
    } else {
      out.photo = null;
    }
  }

  if (eventId !== undefined) {
    out.eventId = eventId;
  }

  return out;
}

/**
 * Valida o nome de um evento.
 */
export function validateEventName(name) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw Object.assign(new Error('Nome do evento é obrigatório.'), { status: 400 });
  }
  if (name.trim().length > 200) {
    throw Object.assign(new Error('Nome do evento muito longo (máximo 200 caracteres).'), { status: 400 });
  }
  return name.trim();
}
