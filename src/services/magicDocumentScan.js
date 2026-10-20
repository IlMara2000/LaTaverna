import {oracleHeaders} from './oracleClient.js';
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
const OCR_CONNECTORS = new Set(['a', 'al', 'an', 'and', 'at', 'da', 'de', 'del', 'della', 'delle', 'dei', 'degli', 'di', 'do', 'e', 'ed', 'il', 'in', 'la', 'le', 'lo', 'of', 'or', 'the', 'to', 'un', 'una']);
const cleanOcrTitle = value => {
    const words = String(value || '').replace(/[^\p{L}\p{N}'’., -]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ');
    const cleaned = [];
    for (const word of words) {
        const alpha = word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').replace(/\bI(?=['’])/g, 'l');
        if (!alpha || /^\d+$/.test(alpha) || (/^[A-Z]{2,5}$/.test(alpha))) continue;
        const normalized = alpha.toLocaleLowerCase();
        if (alpha.length <= 2 && !OCR_CONNECTORS.has(normalized)) continue;
        if (cleaned.at(-1)?.toLocaleLowerCase() === normalized) continue;
        cleaned.push(alpha);
    }
    return cleaned.join(' ');
};

const extractProxySheetNames = async (canvas, worker) => {
    await worker.setParameters({ tessedit_pageseg_mode: '3' });
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    const words = (data.blocks || []).flatMap(block => block.paragraphs || [])
        .flatMap(paragraph => paragraph.lines || []).flatMap(line => line.words || []);
    const width = canvas.width, height = canvas.height;
    const columns = [[0.055, 0.35], [0.355, 0.65], [0.655, 0.96]];
    const rows = [[0.06, 0.096], [0.36, 0.396], [0.66, 0.696]];
    const names = [];
    await worker.setParameters({ tessedit_pageseg_mode: '3' });
    for (let row = 0; row < rows.length; row++) for (let column = 0; column < columns.length; column++) {
        const [top] = rows[row], [left, right] = columns[column];
        const sourceX = Math.round(left * width), sourceY = Math.round(top * height);
        const sourceWidth = Math.round((right - left) * width), sourceHeight = Math.round(0.035 * height);
        const crop = document.createElement('canvas');
        crop.width = sourceWidth * 3; crop.height = sourceHeight * 3;
        crop.getContext('2d').drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, crop.width, crop.height);
        const { data: cropData } = await worker.recognize(crop, {}, { blocks: true });
        const cropWords = (cropData.blocks || []).flatMap(block => block.paragraphs || [])
            .flatMap(paragraph => paragraph.lines || []).flatMap(line => line.words || []);
        const primary = cropWords.filter(word => {
            const x = (word.bbox.x0 + word.bbox.x1) / 2 / crop.width;
            const y = (word.bbox.y0 + word.bbox.y1) / 2 / crop.height;
            return x >= 0.05 && x <= 0.78 && y >= 0.12 && y <= 0.88
                && word.confidence >= 25 && /[\p{L}\p{N}]/u.test(word.text);
        }).sort((a, b) => a.bbox.x0 - b.bbox.x0).map(word =>
            (word.text.match(/[\p{L}][\p{L}'’.-]{1,}/gu) || []).join(' ')
        ).filter(Boolean).join(' ');

        const [topBand, bottomBand] = rows[row], [leftBand, rightBand] = columns[column];
        const fallback = words.filter(word => {
            const x = (word.bbox.x0 + word.bbox.x1) / 2 / width;
            const y = (word.bbox.y0 + word.bbox.y1) / 2 / height;
            return x >= leftBand && x <= leftBand + (rightBand - leftBand) * 0.79
                && y >= topBand && y <= bottomBand && word.confidence >= 10 && /[\p{L}\p{N}]/u.test(word.text);
        }).sort((a, b) => a.bbox.x0 - b.bbox.x0).map(word => {
            const parts = word.text.match(/[\p{L}][\p{L}'’.-]{1,}/gu) || [];
            return word.confidence < 35 ? (parts.at(-1) || '') : parts.join(' ');
        }).filter(Boolean).join(' ');
        const primaryName = cleanOcrTitle(primary), fallbackName = cleanOcrTitle(fallback);
        const name = primaryName.length >= 3 ? primaryName : fallbackName;
        if (name.length >= 3 && name.length <= 100 && !isSectionHeading(name)) names.push({
            name,
            quantity: 1,
            alternatives: fallbackName && fallbackName.toLocaleLowerCase() !== name.toLocaleLowerCase() ? [fallbackName] : []
        });
    }
    const merged = new Map();
    for (const candidate of names) {
        const key = candidate.name.toLocaleLowerCase();
        const entry = merged.get(key) || { ...candidate, quantity: 0, alternatives: [] };
        entry.quantity++;
        for (const alternative of candidate.alternatives) {
            if (!entry.alternatives.some(value => value.toLocaleLowerCase() === alternative.toLocaleLowerCase())) entry.alternatives.push(alternative);
        }
        merged.set(key, entry);
    }
    return [...merged.values()];
};

const groqScanRequest = async (body, onProgress) => {
    for (let attempt = 0; attempt < 3; attempt++) {
        const cooldown = Math.max(0, nextGroqRequestAt - Date.now());
        if (cooldown) await wait(cooldown);
        // Groq's free vision tier counts each image as 2,048 input tokens. Leave
        // a full minute after multi-page requests to stay under its TPM ceiling.
        nextGroqRequestAt = Date.now() + ((body.images?.length || 0) > 1 ? 60000 : 20000);
        const response = await fetch('/api/magic/scan', { method: 'POST', headers: await oracleHeaders(), body: JSON.stringify(body) });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) return (payload.cards || []).filter(card => !isSectionHeading(card?.name));
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
const isSectionHeading = value => {
    const title = String(value || '').replace(/\s+/g, ' ').trim();
    return /^(?:artifact|creature|enchantment|instant|sorcer(?:y|ies)|land|plane(?:swalker)?|battle|commander|mainboard|sideboard|maybeboard|companion|token)s?(?:\s*\(\s*\d+\s*(?:cards?)?\s*\)|\s+\d+\s*(?:cards?)?)?\s*:?$/i.test(title);
};

export function parseMagicCardList(source) {
    const quantities = new Map();
    const rows = String(source || '').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    let matched = 0;
    for (const row of rows) {
        if (/^(?:sideboard|maybeboard|considering)\b/i.test(row) || SKIP_LIST_LINES.test(row) || isSectionHeading(row)) continue;
        const match = row.match(/^(?:(\d{1,3})\s*[x×]?\s+)?(.+?)(?:\s+[x×]\s*(\d{1,3}))?$/i);
        if (!match) continue;
        let name = (match[2] || '').trim().replace(/\s+\([A-Z0-9]{2,8}\)\s+[A-Z0-9-]+(?:\s+\*?[A-Z]?\*?)?$/i, '').replace(/\s+#.*$/, '').trim();
        if (name.length < 2 || name.length > 120 || SKIP_LIST_LINES.test(name) || isSectionHeading(name) || /^\d+$/.test(name)) continue;
        const quantity = Math.min(99, Math.max(1, Number(match[1] || match[3] || 1)));
        quantities.set(name, Math.min(99, (quantities.get(name) || 0) + quantity));
        matched++;
    }
    return { cards: [...quantities].map(([name, quantity]) => ({ name, quantity })), ratio: rows.length ? matched / rows.length : 0 };
}

async function readDocx(file) {
    if (file.size > 10 * 1024 * 1024) throw new Error('Il DOCX supera il limite di 10 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const decoder = new TextDecoder();
    for (let directory = 0; directory + 46 < bytes.length;) {
        if (view.getUint32(directory, true) !== 0x02014b50) { directory++; continue; }
        const method = view.getUint16(directory + 10, true), compressedSize = view.getUint32(directory + 20, true);
        const nameLength = view.getUint16(directory + 28, true), extraLength = view.getUint16(directory + 30, true);
        const commentLength = view.getUint16(directory + 32, true), localOffset = view.getUint32(directory + 42, true);
        const nameStart = directory + 46;
        const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
        if (name === 'word/document.xml') {
            const localNameLength = view.getUint16(localOffset + 26, true), localExtraLength = view.getUint16(localOffset + 28, true);
            const dataStart = localOffset + 30 + localNameLength + localExtraLength;
            const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
            let xmlBytes;
            if (method === 0) xmlBytes = compressed;
            else if (method === 8 && typeof DecompressionStream !== 'undefined') {
                const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
                xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
            } else throw new Error('Questo DOCX usa una compressione non supportata dal browser.');
            const xml = new DOMParser().parseFromString(decoder.decode(xmlBytes), 'application/xml');
            if (xml.querySelector('parsererror')) throw new Error('Il documento DOCX non è valido.');
            return [...xml.getElementsByTagNameNS('*', 'p')].map(paragraph =>
                [...paragraph.getElementsByTagNameNS('*', 't')].map(node => node.textContent || '').join('')
            ).filter(Boolean).join('\n');
        }
        directory = nameStart + nameLength + extraLength + commentLength;
    }
    throw new Error('Nel DOCX non ho trovato il testo del documento.');
}

export async function scanMagicDocument(file, onProgress = () => {}) {
    if (file.name.toLowerCase().endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const source = await readDocx(file);
        const parsed = parseMagicCardList(source);
        if (!parsed.cards.length) throw new Error('Non ho trovato nomi di carte nel DOCX. Usa una carta per riga, per esempio “1 Sol Ring”.');
        onProgress(`Trovate ${parsed.cards.length} carte nel DOCX, senza usare Groq.`);
        return parsed.cards;
    }
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
            text += `\n${content.items.map(item => `${item.str || ''}${item.hasEOL ? '\n' : ' '}`).join('')}`;
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
            for (const card of all) {
                const key = card.name.toLocaleLowerCase();
                const entry = unique.get(key) || { name: card.name, quantity: 0, alternatives: [] };
                entry.quantity += card.quantity || 1;
                for (const alternative of card.alternatives || []) {
                    if (!entry.alternatives.some(value => value.toLocaleLowerCase() === alternative.toLocaleLowerCase())) entry.alternatives.push(alternative);
                }
                unique.set(key, entry);
            }
            const cards = [...unique.values()];
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
