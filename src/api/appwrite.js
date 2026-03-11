import { Client, Account, Databases, Storage, ID, Query } from 'appwrite';

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export const DB_CONFIG = {
    dbId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    colMaps: process.env.NEXT_PUBLIC_APPWRITE_MAPS_COLLECTION,
    colTokens: process.env.NEXT_PUBLIC_APPWRITE_TOKENS_COLLECTION,
    colMessages: process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION,
};

export { client, ID, Query };
