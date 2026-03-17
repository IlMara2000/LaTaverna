import { Client, Account, Databases, Storage, ID } from 'appwrite';

const APPWRITE_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PROJECT = '69a85edc001553a4b931';

const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export const APPWRITE_CONFIG = Object.freeze({
    dbId: '69a867cc0018c0a6d700',
    bucketId: '67d730a9003504149021',
    collections: {
        maps: '67d7304b0021b369528d', 
        tokens: '67d7305d0034a7873528',
        characters: '67d730c40026e63283a0',
        chat: '67d73070001a4e1d120a'
    }
});

export { client, ID };
console.log("⚔️ Portale Appwrite collegato.");
