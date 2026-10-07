import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';

GlobalWorkerOptions.workerSrc = pdfWorker;
let scanQueue = Promise.resolve();
let nextGroqRequestAt = 0;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const toCompressedJpeg = source => {
    let encoded = '';
    for (const [maxSide, quality] of [[1200, 0.62], [1050, 0.56], [900, 0.5], [760, 0.44]]) {
        const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(source.width * scale));
        canvas.height = Math.max(1, Math.round(source.height * scale));
        canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
        encoded = canvas.toDataURL('image/jpeg', quality);
        if (encoded.length <= 3_200_000) break;
    }
    return encoded;
};

const imageData = async (source, maxSide = 1200) => {
    const bitmap = await createImageBitmap(source);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return toCompressedJpeg(canvas);
};

const canvasImageData = canvas => toCompressedJpeg(canvas);

const extractProxySheetNames = async (canvas, worker) => {
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    const words = (data.blocks || []).flatMap(block => block.paragraphs || [])
        .flatMap(paragraph => paragraph.lines || []).flatMap(line => line.words || []);
    const width = canvas.width, height = canvas.height;
    const columns = [[0.055, 0.35], [0.355, 0.65], [0.655, 0.96]];
    const rows = [[0.06, 0.096], [0.36, 0.396], [0.66, 0.696]];
    const names = [];
    for (const [top, bottom] of rows) for (const [left, right] of columns) {
        const title = words.filter(word => {
            const x = (word.bbox.x0 + word.bbox.x1) / 2 / width;
            const y = (word.bbox.y0 + word.bbox.y1) / 2 / height;
            return x >= left && x <= right && y >= top && y <= bottom && /[\p{L}\p{N}]/u.test(word.text);
        }).sort((a, b) => a.bbox.x0 - b.bbox.x0).map(word => {
            const parts = word.text.match(/[\p{L}][\p{L}'’.-]{1,}/gu) || [];
            return word.confidence < 35 ? (parts.at(-1) || '') : parts.join(' ');
        }).filter(Boolean).join(' ')
            .replace(/[^\p{L}\p{N}'’., -]/gu, ' ').replace(/\s+/g, ' ').trim();
        if (title.length >= 3 && title.length <= 100) names.push({ name: title, quantity: 1 });
    }
    const merged = new Map();
    for (const { name } of names) merged.set(name, (merged.get(name) || 0) + 1);
    return [...merged].map(([name, quantity]) => ({ name, quantity }));
};

const groqScanRequest = async (body, onProgress) => {
    for (let attempt = 0; attempt < 3; attempt++) {
        const cooldown = Math.max(0, nextGroqRequestAt - Date.now());
        if (cooldown) await wait(cooldown);
        // Groq's free vision tier counts each image as 2,048 input tokens. Leave
        // a full minute after multi-page requests to stay under its TPM ceiling.
        nextGroqRequestAt = Date.now() + ((body.images?.length || 0) > 1 ? 60000 : 20000);
        const response = await fetch('/api/magic/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) return payload.cards || [];
        if (response.status !== 429 || attempt === 2) throw new Error(payload.error || 'Scansione non disponibile.');
        const headerDelay = Number(response.headers.get('Retry-After')) * 1000;
        const delay = Math.max(Number.isFinite(headerDelay) ? headerDelay : 0, payload.retryAfterMs || 0, 2500 * (2 ** attempt));
        if (delay > 15000) {
            const minutes = Math.max(1, Math.ceil(delay / 60000));
            throw new Error(`Limite temporaneo di Groq raggiunto. Riprova tra circa ${minutes} min.`);
        }
        onProgress('Groq è momentaneamente occupato. Riprovo tra ' + Math.ceil(delay / 1000) + ' secondi…');
        await wait(delay);
    }
    return [];
};

const groqScan = (body, onProgress = () => {}) => {
    const next = scanQueue.then(() => groqScanRequest(body, onProgress));
    scanQueue = next.catch(() => {});
    return next;
};

const groqScanImages = async (images, onProgress) => {
    // Keep below the serverless request-body limit, splitting only unusually large scans.
    const body = { images };
    if (JSON.stringify(body).length <= 3_500_000 || images.length <= 1) return groqScan(body, onProgress);
    const midpoint = Math.ceil(images.length / 2);
    return [
        ...await groqScanImages(images.slice(0, midpoint), onProgress),
        ...await groqScanImages(images.slice(midpoint), onProgress)
    ];
};

const SKIP_LIST_LINES = /^(?:commander|mainboard|sideboard|maybeboard|considering|deck|cards?|terre|creature|instant|sorcery|enchantment|artifact|planeswalker|battle|total|quantità|quantita|name|nome)$/i;
export function parseMagicCardList(source) {
    const quantities = new Map();
    const rows = String(source || '').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    let matched = 0;
    for (const row of rows) {
        if (/^(?:sideboard|maybeboard|considering)\b/i.test(row) || SKIP_LIST_LINES.test(row)) continue;
        const match = row.match(/^(?:(\d{1,3})\s*[x×]?\s+)?(.+?)(?:\s+[x×]\s*(\d{1,3}))?$/i);
        if (!match) continue;
        let name = (match[2] || '').trim().replace(/\s+\([A-Z0-9]{2,8}\)\s+[A-Z0-9-]+(?:\s+\*?[A-Z]?\*?)?$/i, '').replace(/\s+#.*$/, '').trim();
        if (name.length < 2 || name.length > 120 || SKIP_LIST_LINES.test(name) || /^\d+$/.test(name)) continue;
        const quantity = Math.min(99, Math.max(1, Number(match[1] || match[3] || 1)));
        quantities.set(name, Math.min(99, (quantities.get(name) || 0) + quantity));
        matched++;
    }
    return { cards: [...quantities].map(([name, quantity]) => ({ name, quantity })), ratio: rows.length ? matched / rows.length : 0 };
}

export async function scanMagicDocument(file, onProgress = () => {}) {
    if (file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain') {
        if (file.size > 2 * 1024 * 1024) throw new Error('Il file di testo supera il limite di 2 MB.');
        const parsed = parseMagicCardList(await file.text());
        if (!parsed.cards.length) throw new Error('Non ho trovato nomi di carte. Usa una carta per riga, per esempio “1 Sol Ring”.');
        onProgress(`Trovate ${parsed.cards.length} carte dalla lista, senza usare Groq.`);
        return parsed.cards;
    }
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        if (pdf.numPages > 30) throw new Error('Il PDF supera il limite di 30 pagine per scansione.');
        let text = '';
        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
            const page = await pdf.getPage(pageNo), content = await page.getTextContent();
            text += `\n${content.items.map(item => item.str || '').join(' ')}`;
        }
        if (text.replace(/\s/g, '').length > 40) {
            const parsed = parseMagicCardList(text);
            if (parsed.cards.length && parsed.ratio >= 0.5) {
                onProgress(`Trovate ${parsed.cards.length} carte nel testo del PDF, senza usare Groq.`);
                return parsed.cards;
            }
            onProgress('Interpreto la lista PDF…');
            return groqScan({ text: text.slice(0, 24000) }, onProgress);
        }
        onProgress('Leggo localmente i titoli delle carte…');
        const worker = await createWorker('eng');
        const all = [];
        try {
            for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
                onProgress(`Riconosco i nomi nella pagina ${pageNo} di ${pdf.numPages}…`);
                const page = await pdf.getPage(pageNo), viewport = page.getViewport({ scale: 2 });
                const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
                await page.render({ canvas, viewport }).promise;
                all.push(...await extractProxySheetNames(canvas, worker));
            }
        } finally {
            await worker.terminate();
        }
        if (all.length) {
            const unique = new Map();
            for (const { name, quantity } of all) unique.set(name, (unique.get(name) || 0) + quantity);
            const cards = [...unique].map(([name, quantity]) => ({ name, quantity }));
            onProgress(`Riconosciute ${cards.length} carte in locale, senza inviare le pagine a Groq.`);
            return cards;
        }
        onProgress('OCR locale senza risultati; provo la scansione AI di una pagina alla volta…');
        const images = [];
        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
            const page = await pdf.getPage(pageNo), viewport = page.getViewport({ scale: 1.25 });
            const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
            await page.render({ canvas, viewport }).promise;
            images.push(canvasImageData(canvas));
        }
        return groqScanImages(images, onProgress);
    }
    if (!file.type.startsWith('image/')) throw new Error('Formato non supportato. Scegli immagini o PDF.');
    onProgress('Analizzo l’immagine con Groq…');
    return groqScan({ images: [await imageData(file)] }, onProgress);
}
