// src/services/appwrite.js
import { Client, Account, Databases } from "appwrite";

// Inizializziamo il client direttamente con i tuoi dati
const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1') // L'endpoint standard di Appwrite Cloud
  .setProject('IL_TUO_PROJECT_ID')           // <--- INCOLLA QUI IL TUO PROJECT ID DI APPWRITE
  .setSelfSigned(true); 

export const account = new Account(client);
export const databases = new Databases(client);

// Esportiamo anche il client se dovesse servire in altri servizi
export { client };

console.log("✅ Appwrite inizializzato correttamente.");
