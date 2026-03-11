import { Client, Account, Databases, Storage, ID, Query } from 'appwrite';

const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1') 
    .setProject('IL_TUO_PROJECT_ID'); // <--- SOSTITUISCI

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { client, ID, Query };
