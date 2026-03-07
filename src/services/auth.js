// src/services/auth.js
import { account, databases } from './appwrite.js';
import { CONFIG } from '../../config/env.js';

export async function register({ email, password, username, gdprAccepted }) {
  const newAcc = await account.create(
    Date.now().toString(),
    email,
    password,
    username
  );

  const doc = {
    username,
    discord_id: null,
    role: 'player',
    gdpr_accepted: !!gdprAccepted,
    gdpr_accepted_at: new Date().toISOString(),
    appwrite_user_id: newAcc.$id
  };

  try {
    await databases.createDocument(
      CONFIG.DATABASE_ID,
      CONFIG.USERS_TABLE_ID,
      newAcc.$id,
      doc
    );
  } catch (err) {
    console.warn('createDocument failed, fallback to Function', err);
  }

  await account.createSession(email, password);

  return newAcc;
}

export async function login(email, password) {
  await account.createSession(email, password);
  return account.get();
}