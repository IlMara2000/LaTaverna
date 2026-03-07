// src/services/appwrite.js
import { Client, Account, Databases } from 'appwrite';
import { CONFIG } from '../../config/env.js';

let client = null;
export let account = null;
export let databases = null;

export function initAppwrite() {
  client = new Client()
    .setEndpoint(CONFIG.APPWRITE_ENDPOINT)
    .setProject(CONFIG.APPWRITE_PROJECT);

  account = new Account(client);
  databases = new Databases(client);
}