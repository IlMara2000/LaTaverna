import { Client, Account, Databases, Storage } from 'appwrite';

const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('66ed6258003666f5492d'); // Assicurati che questo ID sia corretto

export const account = new Account(client);
export const databases = new Databases(client);
// QUESTO ERA IL PEZZO MANCANTE CHE BLOCCAVA VERCEL:
export const storage = new Storage(client); 

export { client };
