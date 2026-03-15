import { Client, Account, Databases, Storage, ID } from 'appwrite';

// Inizializzazione del Client
const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1') 
    .setProject('66ed6258003666f5492d'); 
    // ^^^ ATTENZIONE: Se nel video vedi ancora "Project not found", 
    // devi entrare nella console di Appwrite e verificare che questo ID 
    // sia esattamente quello del tuo progetto attuale.

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

// Esportiamo ID così lo puoi usare in register.js per ID.unique()
export { client, ID };
