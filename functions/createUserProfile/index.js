// functions/createUserProfile/index.js
const sdk = require('node-appwrite');

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT = process.env.APPWRITE_PROJECT || "69a85edc001553a4b931";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.DB_ID || "69a867cc0018c0a6d700";
const USERS_TABLE_ID = process.env.USERS_TABLE_ID || "users";

const { Client, Databases } = require('node-appwrite');

module.exports = async function(req, res) {
  try {
    const payload = JSON.parse(req.payload || '{}');
    const { appwrite_user_id, username, gdprAccepted } = payload;

    if (!appwrite_user_id || !username || gdprAccepted === undefined) {
      return res.json({ ok: false, message: 'Missing required fields' });
    }

    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT)
      .setKey(APPWRITE_API_KEY);

    const databases = new Databases(client);

    // crea documento usando lo stesso id dell'account Appwrite
    const userDoc = {
      username,
      discord_id: null,
      role: 'player',
      gdpr_accepted: !!gdprAccepted,
      gdpr_accepted_at: new Date().toISOString(),
      appwrite_user_id
    };

    const created = await databases.createDocument(DB_ID, USERS_TABLE_ID, appwrite_user_id, userDoc);
    return res.json({ ok: true, user: created });
  } catch (err) {
    console.error(err);
    return res.json({ ok: false, error: String(err) });
  }
};