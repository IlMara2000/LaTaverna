import { Client, Account, Databases, Storage, ID } from 'appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('66ed6258003666f5492d'); 
    // ^^^ SE IL VIDEO TI DÀ ANCORA 404, QUESTO ID È SBAGLIATO. 
    // Verificalo nella sezione "Settings" della tua console Appwrite.

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { client, ID };
