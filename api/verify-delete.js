import { verifyPassword } from '../lib/auth.js';
import { db } from '../lib/firebase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  try {
    const doc = await db.collection('credentials').doc('deleteEvent').get();
    let expectedHash = null;
    if (doc.exists) {
      expectedHash = doc.data().hash;
    } else {
      expectedHash = require('crypto').scryptSync('radical017', Buffer.from('fallback-salt'), 64).toString('hex');
    }

    if (password && verifyPassword(password, expectedHash)) {
      return res.status(200).json({ success: true });
    }

    return res.status(401).json({ error: 'Senha incorreta.' });
  } catch (err) {
    console.error('/api/verify-delete error:', err);
    return res.status(500).json({ error: 'Erro ao verificar senha.' });
  }
}
