// src/services/appwrite.js
import { Client, Account, Databases } from "appwrite";

// Inizializziamo il client direttamente con i tuoi dati
const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT);

export const account = new Account(client);
export const databases = new Databases(client);

// Esportiamo anche il client se dovesse servire in altri servizi
export { client };

console.log("✅ Appwrite inizializzato correttamente.");
