import { Client, Account, Databases, Storage, ID } from 'appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1') // Dati forniti da te
    .setProject('69a85edc001553a4b931');           // Dati forniti da te

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

// Variabili database esportate correttamente
export const DB_ID = '69a867cc0018c0a6d700';
export const COLLECTIONS = {
    MAPS: 'maps',
    TOKENS: 'tokens',
    CHAT: 'chat_messages',
    USERS: 'users'
};

export { client, ID };
