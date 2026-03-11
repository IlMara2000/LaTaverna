import fetch from "node-fetch";
import { Client, Databases } from "node-appwrite";

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT = process.env.APPWRITE_PROJECT;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.DATABASE_ID;
const USERS_COLLECTION_ID = process.env.USERS_COLLECTION_ID;

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

async function getDiscordToken(code) {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: DISCORD_REDIRECT_URI
  });

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  if (!response.ok) throw new Error(`Token error: ${response.status}`);
  return response.json();
}

async function getDiscordUser(access_token) {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  if (!response.ok) throw new Error(`User info error: ${response.status}`);
  return response.json();
}

export default async function (req) {
  try {
    const body = req.payload ? JSON.parse(req.payload) : {};
    const { code } = body;
    if (!code) throw new Error("Missing code parameter");

    const tokenData = await getDiscordToken(code);
    const accessToken = tokenData.access_token;

    const discordUser = await getDiscordUser(accessToken);
    const discordId = discordUser.id;
    const username = discordUser.username;

    const users = await databases.listDocuments(DATABASE_ID, USERS_COLLECTION_ID, [
      `discord_id="${discordId}"`
    ]);

    let userId;
    if (users.total > 0) {
      userId = users.documents[0].$id;
      await databases.updateDocument(DATABASE_ID, USERS_COLLECTION_ID, userId, { username, discord_id: discordId });
    } else {
      const newUser = await databases.createDocument(DATABASE_ID, USERS_COLLECTION_ID, "unique()", { discord_id: discordId, username, role: "player" });
      userId = newUser.$id;
    }

    return JSON.stringify({ userId, discord_id: discordId, username });

  } catch (err) {
    console.error("verifyDiscord error:", err);
    return JSON.stringify({ error: err.message });
  }
}
