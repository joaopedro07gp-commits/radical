import { db } from '../lib/firebase.js';
import { hashPassword } from '../lib/auth.js';

const credentials = {
  login: hashPassword('radical4321'),
  deleteEvent: hashPassword('radical017')
};

async function migrate() {
  for (const [key, hash] of Object.entries(credentials)) {
    await db.collection('credentials').doc(key).set({ hash });
    console.log(`Credential ${key} set.`);
  }
  console.log('Credentials initialized.');
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
