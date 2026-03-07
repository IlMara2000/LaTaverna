// src/main.js
import { initAppwrite } from './services/appwrite.js';
import { showLogin } from './ui/login.js';

initAppwrite(); // inizializza client Appwrite
showLogin(document.getElementById('ui'));