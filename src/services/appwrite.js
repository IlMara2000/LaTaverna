import { Client, Account, Databases, Storage } from 'appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('66ed6258003666f5492d'); // <-- CAMBIA QUESTO

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { client };
