// functions/verifyDiscord/index.js
const fetch = require('node-fetch');
const sdk = require('node-appwrite');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;      // impostalo in Environment Vars della Function
const GUILD_ID = process.env.DISCORD_GUILD_ID;       // id del tuo server Discord
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT = process.env.APPWRITE_PROJECT || "69a85edc001553a4b931";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY; // chiave server sicura impostata nella Function environment
const DB_ID = process.env.DB_ID || "69a867cc0018c0a6d700";
const USERS_TABLE_ID = process.env.USERS_TABLE_ID || "users";

const { Client, Databases, Query } = require('node-appwrite');

module.exports = async function (req, res) {
  try {
    const payload = JSON.parse(req.payload || req.body || '{}');
    const { appwrite_user_id, discord_id } = payload;

    if (!appwrite_user_id) return res.json({ ok: false, error: 'Missing appwrite_user_id' });

    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT)
      .setKey(APPWRITE_API_KEY);

    const databases = new Databases(client);

    // trova profilo per appwrite_user_id
    const profiles = await databases.listDocuments(DB_ID, USERS_TABLE_ID, [
      Query.equal('appwrite_user_id', [appwrite_user_id])
    ]);
    const profile = profiles.documents[0];
    if (!profile) return res.json({ ok: false, error: 'Profile not found' });

    const discordIdToCheck = discord_id || profile.discord_id;
    if (!discordIdToCheck) return res.json({ ok: false, error: 'No discord id to check' });

    // verifica membership nel guild
    const url = `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordIdToCheck}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });

    if (r.status === 200) {
      // aggiorna record
      await databases.updateDocument(DB_ID, USERS_TABLE_ID, profile.$id, {
        discord_id: discordIdToCheck
      });
      return res.json({ ok: true, linked: true });
    } else {
      return res.json({ ok: false, linked: false, status: r.status });
    }
  } catch (err) {
    console.error(err);
    return res.json({ ok: false, error: String(err) });
  }
};