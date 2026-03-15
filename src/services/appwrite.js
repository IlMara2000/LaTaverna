// src/services/appwrite.js
import { Client, Account, Databases, Storage } from 'appwrite';

/**
 * Inizializzazione del Client Appwrite
 * Sostituisci il Project ID se ne crei uno nuovo nella console.
 */
const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1') // Endpoint ufficiale Cloud
    .setProject('66ed6258003666f5492d');         // Il tuo Project ID

// Esportazione dei servizi principali
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

// Esportiamo il client stesso per gestire i Realtime (es. nel Tabletop)
export { client };

console.log("⚔️ Sistema Appwrite Inizializzato");
