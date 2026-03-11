// src/services/auth.js

import { account, databases } from '@services/appwrite.js';
import { CONFIG } from '@config/env.js';

/**
 * Registra un nuovo utente su Appwrite e lo inserisce nella collection users
 * @param {Object} param0
 * @param {string} param0.email
 * @param {string} param0.password
 * @param {string} param0.username
 * @param {boolean} param0.gdprAccepted
 */
export async function register({ email, password, username, gdprAccepted }) {
  try {
    // Genera userId valido (max 36 caratteri, solo a-zA-Z0-9.-_)
    const userId = Date.now().toString().slice(-12);
    // Crea l’utente su Appwrite
    const newAcc = await account.create(userId, email, password, username);

    // Documento da inserire nella collection users
    const doc = {
      username,
      discord_id: null,
      role: 'player',
      gdpr_accepted: !!gdprAccepted,
      gdpr_accepted_at: new Date().toISOString(),
      appwrite_user_id: newAcc.$id
    };

    // Inserisci documento nella collection users
    try {
      await databases.createDocument(
        CONFIG.DATABASE_ID,
        CONFIG.USERS_COLLECTION_ID,
        newAcc.$id,
        doc
      );
    } catch (err) {
      console.warn('createDocument fallito, fallback a funzione Appwrite', err);
    }

    // Login automatico solo se non esiste già una sessione
    try {
      const sessions = await account.getSessions();
      if (!sessions?.total) {
        await account.createSession(email, password);
      }
    } catch (err) {
      console.warn("Controllo sessione fallito:", err.message);
    }

    return newAcc;

  } catch (err) {
    if (err.message.includes("already exists")) {
      throw new Error("Questa email è già registrata.");
    }
    if (err.message.includes("password")) {
      throw new Error("Password non valida. Deve essere lunga almeno 8 caratteri.");
    }
    if (err.message.includes("email")) {
      throw new Error("Email non valida.");
    }
    throw err;
  }
}

/**
 * Effettua il login di un utente e ritorna l’account
 * @param {string} email
 * @param {string} password
 */
export async function login(email, password) {
  try {
    await account.createSession(email, password);
    return await account.get();
  } catch (err) {
    if (err.message.includes("credentials")) {
      throw new Error("Email o password errati.");
    }
    if (err.message.includes("rate limit")) {
      throw new Error("Troppi tentativi. Riprova tra qualche minuto.");
    }
    throw err;
  }
}
