import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix per far funzionare __dirname con "type": "module"
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // Definiamo esplicitamente la root e la cartella public per Vercel
  publicDir: 'public', 
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@services': path.resolve(__dirname, './src/services'),
    },
  },

  build: {
    outDir: 'dist',
    // Pulizia degli asset vecchi per evitare conflitti di cache
    emptyOutDir: true,
    // Ottimizzazione per caricamento veloce su mobile
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },

  // Server di sviluppo (opzionale ma utile)
  server: {
    host: true,
    port: 3000,
  }
});