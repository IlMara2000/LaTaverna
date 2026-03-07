// src/services/redirectDiscord.js
import { account, databases } from './appwrite.js';
import { CONFIG } from '../../config/env.js';
import { Query } from 'appwrite';

export async function checkAndRedirectDiscord() {
  const me = await account.get();
  const res = await databases.listDocuments(CONFIG.DATABASE_ID, CONFIG.USERS_TABLE_ID, [
    Query.equal('appwrite_user_id', [me.$id])
  ]);
  const profile = res.documents[0];
  if (!profile) throw new Error("Profile missing");
  if (!profile.discord_id) {
    window.location.href = `${CONFIG.APPWRITE_ENDPOINT}/account/sessions/oauth2/discord`;
  }
  return profile;
}