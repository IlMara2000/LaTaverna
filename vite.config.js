import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix per far funzionare __dirname con "type": "module"
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@services': path.resolve(__dirname, './src/services'),
    },
  },
  build: {
    outDir: 'dist', // Cartella di output per Vercel
  }
});
