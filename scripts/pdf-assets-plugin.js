import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// Keep PDF decoding resources local, versioned with the installed PDF.js package.
export function pdfAssetsPlugin() {
    const root = path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
    const files = new Map();
    for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs', 'web/images']) {
        for (const name of readdirSync(path.join(root, folder))) {
            files.set(`pdfjs-assets/${folder}/${name}`, path.join(root, folder, name));
        }
    }
    files.set('pdfjs-assets/LICENSE', path.join(root, 'LICENSE'));
    return {
        name: 'local-pdf-resources',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const file = files.get((req.url || '').split('?')[0].replace(/^\//, ''));
                if (!file) return next();
                const type = file.endsWith('.wasm') ? 'application/wasm' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
                res.setHeader('Content-Type', type);
                res.end(readFileSync(file));
            });
        },
        generateBundle() {
            for (const [fileName, file] of files) this.emitFile({ type: 'asset', fileName, source: readFileSync(file) });
        }
    };
}
