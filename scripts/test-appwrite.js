/**
 * Verifica la connessione ad Appwrite (endpoint e, se possibile, progetto/database).
 * Esegui: node scripts/test-appwrite.js
 * Richiede: .env con VITE_APPWRITE_ENDPOINT e VITE_APPWRITE_PROJECT
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT;
const PROJECT = process.env.VITE_APPWRITE_PROJECT || process.env.APPWRITE_PROJECT;
const DATABASE_ID = process.env.VITE_DATABASE_ID || process.env.DATABASE_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

async function main() {
  console.log('\n--- Test connessione Appwrite ---\n');
  console.log('Endpoint:', ENDPOINT || '(mancante)');
  console.log('Project ID:', PROJECT || '(mancante)');
  console.log('Database ID:', DATABASE_ID || '(mancante)\n');

  if (!ENDPOINT) {
    console.error('❌ Imposta VITE_APPWRITE_ENDPOINT nel file .env');
    process.exit(1);
  }

  const base = ENDPOINT.replace(/\/$/, '');

  // 1) Health check (pubblico)
  try {
    const healthRes = await fetch(`${base}/health/version`);
    const health = await healthRes.json().catch(() => ({}));
    console.log('✅ Endpoint raggiungibile:', healthRes.ok ? 'OK' : healthRes.status);
    if (health.version) console.log('   Versione:', health.version);
  } catch (err) {
    console.error('❌ Endpoint non raggiungibile:', err.message);
    process.exit(1);
  }

  // 2) Progetto (richiede API key)
  if (PROJECT && API_KEY) {
    try {
      const projRes = await fetch(`${base}/projects/${PROJECT}`, {
        headers: { 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': API_KEY },
      });
      if (projRes.ok) {
        const proj = await projRes.json();
        console.log('✅ Progetto trovato:', proj.name || PROJECT);
      } else {
        console.log('⚠️ Progetto: risposta', projRes.status, '(verifica API key)');
      }
    } catch (err) {
      console.log('⚠️ Progetto: errore', err.message);
    }
  } else if (PROJECT) {
    console.log('ℹ️ Per testare il progetto, aggiungi APPWRITE_API_KEY in .env (solo in locale, mai in frontend)');
  }

  // 3) Database/collection (opzionale, con API key)
  if (DATABASE_ID && API_KEY && PROJECT) {
    try {
      const dbRes = await fetch(`${base}/databases/${DATABASE_ID}`, {
        headers: { 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': API_KEY },
      });
      if (dbRes.ok) {
        const db = await dbRes.json();
        console.log('✅ Database trovato:', db.name || DATABASE_ID);
      } else {
        console.log('⚠️ Database: risposta', dbRes.status);
      }
    } catch (err) {
      console.log('⚠️ Database: errore', err.message);
    }
  }

  console.log('\n--- Fine test ---\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
