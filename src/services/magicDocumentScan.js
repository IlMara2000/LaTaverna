import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

const imageData = async (source, maxSide = 1400) => {
    const bitmap = await createImageBitmap(source);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.78);
};

const canvasImageData = canvas => {
    const scale = Math.min(1, 1400 / Math.max(canvas.width, canvas.height));
    const resized = document.createElement('canvas');
    resized.width = Math.round(canvas.width * scale); resized.height = Math.round(canvas.height * scale);
    resized.getContext('2d').drawImage(canvas, 0, 0, resized.width, resized.height);
    return resized.toDataURL('image/jpeg', 0.72);
};

const groqScan = async body => {
    const response = await fetch('/api/magic/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Scansione non disponibile.');
    return payload.cards || [];
};

export async function scanMagicDocument(file, onProgress = () => {}) {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        if (pdf.numPages > 30) throw new Error('Il PDF supera il limite di 30 pagine per scansione.');
        let text = '';
        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
            const page = await pdf.getPage(pageNo), content = await page.getTextContent();
            text += `\n${content.items.map(item => item.str || '').join(' ')}`;
        }
        if (text.replace(/\s/g, '').length > 40) {
            onProgress('Interpreto la lista PDF…');
            return groqScan({ text: text.slice(0, 24000) });
        }
        const all = [];
        for (let start = 1; start <= pdf.numPages; start += 3) {
            const images = [];
            for (let pageNo = start; pageNo < Math.min(start + 3, pdf.numPages + 1); pageNo++) {
                onProgress(`Scansiono pagina ${pageNo} di ${pdf.numPages}…`);
                const page = await pdf.getPage(pageNo), viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
                await page.render({ canvas, viewport }).promise;
                images.push(canvasImageData(canvas));
            }
            all.push(...await groqScan({ images }));
        }
        return all;
    }
    if (!file.type.startsWith('image/')) throw new Error('Formato non supportato. Scegli immagini o PDF.');
    onProgress('Analizzo l’immagine con Groq…');
    return groqScan({ images: [await imageData(file)] });
}
