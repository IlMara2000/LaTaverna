import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Carica le variabili d'ambiente basate sul "mode" (dev, prod)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    publicDir: 'public', 
    
    resolve: {
      alias: {
        // Mappatura completa per la struttura Factory
        '@': path.resolve(__dirname, './src'),
        '@ui': path.resolve(__dirname, './src/components/ui'),
        '@layout': path.resolve(__dirname, './src/components/layout'),
        '@services': path.resolve(__dirname, './src/services'),
        '@features': path.resolve(__dirname, './src/features'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@styles': path.resolve(__dirname, './src/styles'),
      },
    },

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      minify: 'terser', // Terser produce file leggermente più piccoli per il web
      terserOptions: {
        compress: {
          drop_console: mode === 'production', // Rimuove i console.log in produzione
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          // Organizza i file in sottocartelle pulite nel build finale
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
          
          // Divide le librerie esterne (Supabase) dal codice dell'app
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@supabase')) return 'vendor-supabase';
              return 'vendor'; // Altre librerie
            }
          },
        },
      },
    },

    server: {
      host: true,
      port: 3000,
      strictPort: true, // Se la 3000 è occupata, non avviare su un'altra (evita confusione)
    },

    // Definisce costanti globali utili (opzionale)
    define: {
      __APP_VERSION__: JSON.stringify('1.1.0'),
    }
  };
});