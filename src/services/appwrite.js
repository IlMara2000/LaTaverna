// src/services/appwrite.js
import { Client, Account, Databases } from "appwrite";
import { CONFIG } from "@config/env.js";

const client = new Client()
  .setEndpoint(CONFIG.APPWRITE_ENDPOINT)
  .setProject(CONFIG.APPWRITE_PROJECT)
  .setSelfSigned(true); // solo per sviluppo locale

export const account = new Account(client);
export const databases = new Databases(client);

console.log("✅ Appwrite inizializzato:", CONFIG.APPWRITE_PROJECT);
