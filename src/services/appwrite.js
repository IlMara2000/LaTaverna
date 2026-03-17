import { Client, Account, Databases, Storage, ID } from 'appwrite';

/**
 * CONFIG BASE APPWRITE
 */
const APPWRITE_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PROJECT = '69a85edc001553a4b931';

/**
 * CLIENT PRINCIPALE
 */
const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT);
    // Nota: .setSelfSigned(false) non è necessario per la versione cloud ufficiale

/**
 * SERVIZI ESPORTATI
 */
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

/**
 * CONFIG CENTRALIZZATA
 */
export const APPWRITE_CONFIG = Object.freeze({
    dbId: '69a867cc0018c0a6d700',

    // CRITICITÀ FIXATA: Assicurati di inserire qui l'ID numerico del Bucket 
    // che trovi nella dashboard Appwrite > Storage.
    bucketId: '67d730a9003504149021', // <-- Esempio: Sostituisci con l'ID reale!

    collections: {
        // Se hai creato le collezioni lasciando gli ID automatici, 
        // devono essere stringhe come '69a8...' e non 'maps' o 'tokens'.
        maps: '67d7304b0021b369528d', 
        tokens: '67d7305d0034a7873528',
        characters: '67d730c40026e63283a0', // Aggiunta per showCharacters.js
        chat: '67d73070001a4e1d120a'
    }
});

/**
 * EXPORT UTILI
 */
export { client, ID };

/**
 * DEBUG
 */
console.log("Appwrite configurato per il progetto:", APPWRITE_PROJECT);