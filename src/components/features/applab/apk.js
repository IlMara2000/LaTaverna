/**
 * APP LAB — analizzatore APK eseguito interamente nel browser.
 *
 * Perché nel browser: l'hosting di La Taverna è Vercel (funzioni serverless),
 * dove non possono girare JVM, Apktool o JADX. Leggere ZIP, AndroidManifest.xml
 * binario (AXML) e resources.arsc qui permette un'analisi reale e immediata,
 * senza caricare il pacchetto su un servizio esterno solo per i metadati.
 *
 * Nessun file viene eseguito: sono soltanto letture byte-per-byte del contenitore.
 */

export const MAX_APK_BYTES = 200 * 1024 * 1024;
const MAX_ENTRY_BYTES = 48 * 1024 * 1024;
const RUNTIME_ANDROID_API = 34;

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

const CHUNK_STRING_POOL = 0x0001;
const CHUNK_TABLE = 0x0002;
const CHUNK_XML = 0x0003;
const CHUNK_XML_START = 0x0102;
const CHUNK_XML_END = 0x0103;
const CHUNK_TABLE_PACKAGE = 0x0200;
const CHUNK_TABLE_TYPE = 0x0201;

const decoderUtf8 = new TextDecoder('utf-8');
const decoderUtf16 = new TextDecoder('utf-16le');

const readView = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/* ------------------------------------------------------------------ */
/* ZIP                                                                 */
/* ------------------------------------------------------------------ */

const inflateRaw = async data => {
    if (typeof DecompressionStream === 'undefined') {
        throw new Error('Questo browser non supporta la decompressione ZIP. Aggiorna Safari/iOS o usa un browser recente.');
    }
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
 * Letto a slice: un APK da 200 MB non deve finire interamente in memoria
 * solo per leggere il manifest.
 */
export async function openApkZip(file, { requireManifest = true } = {}) {
    if (!file || typeof file.slice !== 'function') throw new Error('File APK non valido.');
    const size = file.size;
    const tailSize = Math.min(size, 66000);
    const tail = new Uint8Array(await file.slice(size - tailSize).arrayBuffer());
    const tailView = readView(tail);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
        if (tailView.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Il file non è un archivio ZIP/APK valido.');

    const total = tailView.getUint16(eocd + 10, true);
    const cdSize = tailView.getUint32(eocd + 12, true);
    const cdOffset = tailView.getUint32(eocd + 16, true);
    if (total === 0xffff || cdOffset === 0xffffffff) {
        throw new Error('APK in formato ZIP64 non supportato.');
    }
    if (!cdSize || cdOffset + cdSize > size) throw new Error('Archivio APK danneggiato o troncato.');

    const cd = new Uint8Array(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
    const cdView = readView(cd);
    const entries = new Map();
    let pos = 0;
    for (let i = 0; i < total && pos + 46 <= cd.length; i++) {
        if (cdView.getUint32(pos, true) !== SIG_CENTRAL) break;
        const method = cdView.getUint16(pos + 10, true);
        const compressedSize = cdView.getUint32(pos + 20, true);
        const uncompressedSize = cdView.getUint32(pos + 24, true);
        const nameLength = cdView.getUint16(pos + 28, true);
        const extraLength = cdView.getUint16(pos + 30, true);
        const commentLength = cdView.getUint16(pos + 32, true);
        const localOffset = cdView.getUint32(pos + 42, true);
        const name = decoderUtf8.decode(cd.subarray(pos + 46, pos + 46 + nameLength));
        if (name) {
            entries.set(name, { name, method, compressedSize, uncompressedSize, localOffset });
        }
        pos += 46 + nameLength + extraLength + commentLength;
    }
    if (requireManifest && !entries.has('AndroidManifest.xml')) {
        throw new Error('Il file non contiene AndroidManifest.xml: non è un APK Android.');
    }

    const read = async name => {
        const entry = entries.get(name);
        if (!entry) return null;
        if (entry.uncompressedSize > MAX_ENTRY_BYTES) {
            throw new Error(`La voce ${name} è troppo grande per l'analisi.`);
        }
        const header = new Uint8Array(await file.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer());
        const headerView = readView(header);
        if (headerView.getUint32(0, true) !== SIG_LOCAL) throw new Error('Intestazione ZIP non valida.');
        const nameLength = headerView.getUint16(26, true);
        const extraLength = headerView.getUint16(28, true);
        const dataStart = entry.localOffset + 30 + nameLength + extraLength;
        const raw = new Uint8Array(await file.slice(dataStart, dataStart + entry.compressedSize).arrayBuffer());
        if (entry.method === 0) return raw;
        if (entry.method === 8) return inflateRaw(raw);
        throw new Error(`Compressione ZIP ${entry.method} non supportata.`);
    };

    return {
        entries,
        names: [...entries.keys()],
        read,
        has: name => entries.has(name),
        cdOffset
    };
}

/* ------------------------------------------------------------------ */
/* String pool + AndroidManifest.xml binario (AXML)                    */
/* ------------------------------------------------------------------ */

function parseStringPool(bytes, start, view) {
    const headerSize = view.getUint16(start + 2, true);
    const stringCount = view.getUint32(start + 8, true);
    const flags = view.getUint32(start + 16, true);
    const stringsStart = view.getUint32(start + 20, true);
    const isUtf8 = (flags & 0x100) !== 0;
    const offsetsStart = start + headerSize;
    const strings = new Array(stringCount);
    for (let i = 0; i < stringCount; i++) {
        const offset = view.getUint32(offsetsStart + i * 4, true);
        let pointer = start + stringsStart + offset;
        if (pointer >= bytes.length) { strings[i] = ''; continue; }
        if (isUtf8) {
            let length = bytes[pointer++];
            if (length & 0x80) length = ((length & 0x7f) << 8) | bytes[pointer++];
            let byteLength = bytes[pointer++];
            if (byteLength & 0x80) byteLength = ((byteLength & 0x7f) << 8) | bytes[pointer++];
            strings[i] = decoderUtf8.decode(bytes.subarray(pointer, pointer + byteLength));
        } else {
            let length = view.getUint16(pointer, true);
            pointer += 2;
            if (length & 0x8000) {
                length = ((length & 0x7fff) << 16) | view.getUint16(pointer, true);
                pointer += 2;
            }
            strings[i] = decoderUtf16.decode(bytes.subarray(pointer, pointer + length * 2));
        }
    }
    return strings;
}

function attributeValue(bytes, view, pool, attributesAt) {
    const rawValue = view.getInt32(attributesAt + 8, true);
    const dataType = bytes[attributesAt + 15];
    const data = view.getUint32(attributesAt + 16, true);
    if (rawValue >= 0 && pool[rawValue] !== undefined) return pool[rawValue];
    if (dataType === 0x03) return pool[data] ?? null;
    if (dataType === 0x01) return `@0x${data.toString(16).padStart(8, '0')}`;
    if (dataType === 0x12) return data !== 0;
    if (dataType === 0x10 || dataType === 0x11) return data;
    if (dataType === 0x00) return null;
    return data;
}

/** Decodifica l'XML binario di Android in un albero di elementi. */
export function parseBinaryXml(bytes) {
    if (!bytes || bytes.length < 8) throw new Error('Manifest Android troppo corto.');
    const view = readView(bytes);
    if (view.getUint16(0, true) !== CHUNK_XML) throw new Error('AndroidManifest.xml non è in formato binario Android atteso.');
    let pool = [];
    const document = { name: '#document', attributes: {}, children: [], parent: null };
    const stack = [document];
    let pos = view.getUint16(2, true);
    while (pos + 8 <= bytes.length) {
        const type = view.getUint16(pos, true);
        const headerSize = view.getUint16(pos + 2, true);
        const size = view.getUint32(pos + 4, true);
        if (size < 8 || pos + size > bytes.length) break;
        if (type === CHUNK_STRING_POOL) {
            pool = parseStringPool(bytes, pos, view);
        } else if (type === CHUNK_XML_START) {
            const name = pool[view.getUint32(pos + 20, true)] || '';
            const attributeStart = view.getUint16(pos + 24, true);
            const attributeSize = view.getUint16(pos + 26, true) || 20;
            const attributeCount = view.getUint16(pos + 28, true);
            const attributes = {};
            for (let i = 0; i < attributeCount; i++) {
                const at = pos + headerSize + attributeStart + i * attributeSize;
                if (at + 20 > bytes.length) break;
                const key = pool[view.getUint32(at + 4, true)] || '';
                if (!key) continue;
                attributes[key] = attributeValue(bytes, view, pool, at);
            }
            const node = { name, attributes, children: [], parent: stack[stack.length - 1] };
            if (node.parent) node.parent.children.push(node);
            stack.push(node);
        } else if (type === CHUNK_XML_END) {
            if (stack.length > 1) stack.pop();
        }
        pos += size;
    }
    return document;
}

/* ------------------------------------------------------------------ */
/* resources.arsc                                                      */
/* ------------------------------------------------------------------ */

const collectTypeChunk = (bytes, view, pos, end, packageId, typeId, globalPool, values) => {
    const headerSize = view.getUint16(pos + 2, true);
    const entryCount = view.getUint32(pos + 12, true);
    const entriesStart = view.getUint32(pos + 16, true);
    const configSize = view.getUint32(pos + 20, true);
    const offsetsBase = pos + headerSize;
    for (let index = 0; index < entryCount; index++) {
        if (offsetsBase + index * 4 + 4 > end) break;
        const entryOffset = view.getUint32(offsetsBase + index * 4, true);
        if (entryOffset === 0xffffffff) continue;
        const entry = pos + entriesStart + entryOffset;
        if (entry + 8 > end) continue;
        const entrySize = view.getUint16(entry, true);
        const flags = view.getUint16(entry + 2, true);
        if (flags & 0x0001) continue; // voce complessa (bag), non è un valore scalare
        const valueAt = entry + entrySize;
        if (valueAt + 8 > end) continue;
        const dataType = bytes[valueAt + 3];
        const data = view.getUint32(valueAt + 4, true);
        const value = dataType === 0x03
            ? { dataType, string: globalPool[data] ?? null }
            : { dataType, data };
        const id = ((packageId & 0xff) << 24) | ((typeId & 0xff) << 16) | (index & 0xffff);
        const bucket = values.get(id);
        if (bucket) bucket.push(value);
        else values.set(id, [value]);
    }
};

/** Estrae i valori stringa (tipicamente percorsi di risorse) da resources.arsc. */
export function parseResourceTable(bytes) {
    const values = new Map();
    if (!bytes || bytes.length < 12) return values;
    const view = readView(bytes);
    if (view.getUint16(0, true) !== CHUNK_TABLE) return values;
    let globalPool = [];
    let pos = view.getUint16(2, true);
    const tableEnd = Math.min(bytes.length, view.getUint32(4, true));
    while (pos + 8 <= tableEnd) {
        const type = view.getUint16(pos, true);
        const size = view.getUint32(pos + 4, true);
        if (size < 8) break;
        if (type === CHUNK_STRING_POOL) {
            globalPool = parseStringPool(bytes, pos, view);
        } else if (type === CHUNK_TABLE_PACKAGE) {
            const headerSize = view.getUint16(pos + 2, true);
            const packageId = view.getUint32(pos + 8, true);
            const packageEnd = Math.min(tableEnd, pos + size);
            let child = pos + headerSize;
            while (child + 8 <= packageEnd) {
                const childType = view.getUint16(child, true);
                const childSize = view.getUint32(child + 4, true);
                if (childSize < 8) break;
                if (childType === CHUNK_TABLE_TYPE) {
                    collectTypeChunk(bytes, view, child, packageEnd, packageId,
                        bytes[child + 8], globalPool, values);
                }
                child += childSize;
            }
        }
        pos += size;
    }
    return values;
}

const resourceIdFromReference = value => {
    if (typeof value === 'number') return value >>> 0;
    const match = /^@0x([0-9a-f]{8})$/i.exec(String(value || ''));
    return match ? parseInt(match[1], 16) : null;
};

/** Risolve id risorsa → percorsi file nel ZIP (seguendo i riferimenti). */
function resolveResourceStrings(values, resourceId, depth = 0) {
    if (!resourceId || depth > 4) return [];
    const direct = values.get(resourceId) || [];
    const paths = [];
    const references = [];
    for (const value of direct) {
        if (value.dataType === 0x03 && value.string) paths.push(value.string);
        else if (value.dataType === 0x01) references.push(value.data);
    }
    for (const reference of references) {
        paths.push(...resolveResourceStrings(values, reference >>> 0, depth + 1));
    }
    return paths;
}

/* ------------------------------------------------------------------ */
/* Permessi e framework                                               */
/* ------------------------------------------------------------------ */

const ANDROID = 'http://schemas.android.com/apk/res/android';

const PERMISSIONS = {
    'android.permission.CAMERA': ['Fotocamera', 'dangerous'],
    'android.permission.RECORD_AUDIO': ['Microfono', 'dangerous'],
    'android.permission.ACCESS_FINE_LOCATION': ['Posizione precisa', 'dangerous'],
    'android.permission.ACCESS_COARSE_LOCATION': ['Posizione approssimativa', 'dangerous'],
    'android.permission.ACCESS_BACKGROUND_LOCATION': ['Posizione in background', 'dangerous'],
    'android.permission.READ_CONTACTS': ['Rubrica in lettura', 'dangerous'],
    'android.permission.WRITE_CONTACTS': ['Rubrica in scrittura', 'dangerous'],
    'android.permission.READ_CALENDAR': ['Calendario in lettura', 'dangerous'],
    'android.permission.WRITE_CALENDAR': ['Calendario in scrittura', 'dangerous'],
    'android.permission.READ_SMS': ['SMS in lettura', 'dangerous'],
    'android.permission.SEND_SMS': ['Invio SMS', 'dangerous'],
    'android.permission.CALL_PHONE': ['Chiamate dirette', 'dangerous'],
    'android.permission.READ_PHONE_STATE': ['Stato telefono e IMEI', 'dangerous'],
    'android.permission.READ_PHONE_NUMBERS': ['Numero di telefono', 'dangerous'],
    'android.permission.BODY_SENSORS': ['Sensori corporei', 'dangerous'],
    'android.permission.ACTIVITY_RECOGNITION': ['Riconoscimento attività', 'dangerous'],
    'android.permission.READ_EXTERNAL_STORAGE': ['Archivio in lettura', 'dangerous'],
    'android.permission.WRITE_EXTERNAL_STORAGE': ['Archivio in scrittura', 'dangerous'],
    'android.permission.POST_NOTIFICATIONS': ['Notifiche', 'dangerous'],
    'android.permission.BLUETOOTH_CONNECT': ['Bluetooth', 'dangerous'],
    'android.permission.MANAGE_EXTERNAL_STORAGE': ['Accesso a tutti i file', 'critical'],
    'android.permission.REQUEST_INSTALL_PACKAGES': ['Installazione di altri APK', 'critical'],
    'android.permission.QUERY_ALL_PACKAGES': ['Elenco di tutte le app installate', 'critical'],
    'android.permission.SYSTEM_ALERT_WINDOW': ['Finestre sopra altre app', 'critical'],
    'android.permission.PACKAGE_USAGE_STATS': ['Statistiche di utilizzo', 'critical'],
    'android.permission.BIND_ACCESSIBILITY_SERVICE': ['Servizio accessibilità (controllo UI)', 'critical'],
    'android.permission.BIND_DEVICE_ADMIN': ['Amministratore dispositivo', 'critical'],
    'android.permission.INTERNET': ['Accesso a Internet', 'normal'],
    'android.permission.ACCESS_NETWORK_STATE': ['Stato della rete', 'normal'],
    'android.permission.VIBRATE': ['Vibrazione', 'normal'],
    'android.permission.WAKE_LOCK': ['Blocco sospensione', 'normal'],
    'android.permission.FOREGROUND_SERVICE': ['Servizio in primo piano', 'normal'],
    'android.permission.RECEIVE_BOOT_COMPLETED': ['Avvio automatico', 'normal'],
    'android.permission.BLUETOOTH': ['Bluetooth', 'normal'],
    'android.permission.NFC': ['NFC', 'normal'],
    'com.google.android.c2dm.permission.RECEIVE': ['Notifiche push Google', 'normal'],
    'com.android.vending.BILLING': ['Acquisti in-app Google Play', 'normal']
};

const describePermission = name => {
    const known = PERMISSIONS[name];
    const short = String(name || '').split('.').pop().replace(/([a-z])([A-Z])/g, '$1 $2');
    return {
        name,
        label: known?.[0] || short,
        severity: known?.[1] || 'unknown'
    };
};

const listChildren = (node, name) => (node?.children || []).filter(child => child.name === name);

export function detectFrameworks(names, manifest) {
    const frameworks = [];
    const any = pattern => names.some(name => pattern.test(name));
    if (any(/^assets\/flutter_assets\//) || any(/^lib\/[^/]+\/libflutter\.so$/)) frameworks.push('flutter');
    if (any(/^assets\/capacitor\.config/) || any(/^assets\/capacitor\//)) frameworks.push('capacitor');
    if (any(/^assets\/www\//) || any(/^assets\/cordova\.js$/)) frameworks.push('cordova');
    if (any(/^lib\/[^/]+\/libhermes\.so$/) || any(/^lib\/[^/]+\/libreactnativejni\.so$/)
        || any(/^assets\/index\.android\.bundle$/)) frameworks.push('react-native');
    if (any(/^lib\/[^/]+\/libunity\.so$/) || any(/^assets\/bin\/Data\//)) frameworks.push('unity');
    const activities = listChildren(manifest, 'application').flatMap(app => listChildren(app, 'activity'));
    if (activities.some(activity => String(activity.attributes.name || '').includes('com.facebook.react'))) {
        if (!frameworks.includes('react-native')) frameworks.push('react-native');
    }
    if (!frameworks.length) frameworks.push('native-android');
    return [...new Set(frameworks)];
}

const primaryFramework = frameworks => {
    const order = ['flutter', 'react-native', 'unity', 'capacitor', 'cordova', 'native-android'];
    return order.find(item => frameworks.includes(item)) || 'native-android';
};

/* ------------------------------------------------------------------ */
/* Icona                                                               */
/* ------------------------------------------------------------------ */

const isImageEntry = name => /\.(png|webp|jpe?g)$/i.test(name);

const mimeFor = name => {
    if (/\.png$/i.test(name)) return 'image/png';
    if (/\.webp$/i.test(name)) return 'image/webp';
    return 'image/jpeg';
};

const toDataUrl = (bytes, mime) => {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return `data:${mime};base64,${btoa(binary)}`;
};

export async function compressIcon(bytes, mime, size = 192) {
    if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
        return toDataUrl(bytes, mime);
    }
    try {
        const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        context.imageSmoothingQuality = 'high';
        const scale = Math.min(size / bitmap.width, size / bitmap.height);
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        context.drawImage(bitmap, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
        bitmap.close?.();
        const webp = canvas.toDataURL('image/webp', 0.92);
        if (webp.startsWith('data:image/webp')) return webp;
        return canvas.toDataURL('image/png');
    } catch {
        return toDataUrl(bytes, mime);
    }
}

async function iconCandidates(zip, values, iconReference, roundReference) {
    const ids = [resourceIdFromReference(iconReference), resourceIdFromReference(roundReference)].filter(Boolean);
    const candidates = [];
    for (const id of ids) {
        for (const path of resolveResourceStrings(values, id)) {
            if (zip.has(path) && isImageEntry(path)) candidates.push(path);
            // Icona adattiva: l'XML punta al foreground, che è l'immagine vera.
            if (zip.has(path) && /\.xml$/i.test(path)) {
                try {
                    const adaptive = parseBinaryXml(await zip.read(path));
                    const foreground = adaptive.children.flatMap(child => child.children)
                        .find(element => element.name === 'foreground' || element.name === 'background');
                    const nested = resourceIdFromReference(foreground?.attributes?.drawable);
                    for (const nestedPath of resolveResourceStrings(values, nested)) {
                        if (zip.has(nestedPath) && isImageEntry(nestedPath)) candidates.push(nestedPath);
                    }
                } catch { /* si passa al fallback per nome */ }
            }
        }
    }
    if (candidates.length) return [...new Set(candidates)];

    // Fallback: icona launcher per nome, privilegiando le densità più alte.
    const rank = name => {
        if (/xxxhdpi/.test(name)) return 6;
        if (/xxhdpi/.test(name)) return 5;
        if (/xhdpi/.test(name)) return 4;
        if (/hdpi/.test(name)) return 3;
        if (/mdpi/.test(name)) return 2;
        return 1;
    };
    return zip.names
        .filter(name => /^res\/(mipmap|drawable)/.test(name) && isImageEntry(name)
            && /(launcher|icon|logo|app)/i.test(name))
        .sort((a, b) => rank(b) - rank(a))
        .slice(0, 4);
}

async function extractIcon(zip, values, iconReference, roundReference) {
    const candidates = await iconCandidates(zip, values, iconReference, roundReference);
    for (const name of candidates) {
        try {
            const bytes = await zip.read(name);
            if (!bytes?.length) continue;
            const dataUrl = await compressIcon(bytes, mimeFor(name));
            if (dataUrl.length <= 120000) return { dataUrl, source: name };
        } catch { /* prova la prossima */ }
    }
    return { dataUrl: null, source: null };
}

/* ------------------------------------------------------------------ */
/* Firma, librerie native, compatibilità                              */
/* ------------------------------------------------------------------ */

async function detectSignatures(file, zip) {
    const v1 = zip.names.some(name => /^META-INF\/[^/]+\.(RSA|DSA|EC)$/i.test(name));
    let v2Plus = false;
    try {
        const windowStart = Math.max(0, zip.cdOffset - 1024 * 1024);
        const slice = new Uint8Array(await file.slice(windowStart, zip.cdOffset).arrayBuffer());
        const magic = 'APK Sig Block 42';
        const haystack = decoderUtf8.decode(slice);
        v2Plus = haystack.includes(magic);
    } catch { /* la firma non è verificabile in streaming */ }
    return { v1, v2OrNewer: v2Plus, signed: v1 || v2Plus };
}

const NATIVE_LIB_PATTERN = /^lib\/([^/]+)\/([^/]+\.so)$/;

export function collectNativeLibraries(names) {
    const byAbi = {};
    for (const name of names) {
        const match = NATIVE_LIB_PATTERN.exec(name);
        if (!match) continue;
        const [, abi, library] = match;
        (byAbi[abi] ||= []).push(library);
    }
    for (const abi of Object.keys(byAbi)) byAbi[abi].sort();
    return byAbi;
}

const emulatorAbis = abis => abis.some(abi => abi === 'x86_64' || abi === 'x86');

/**
 * Decide se l'app può essere eseguita in un ambiente Android remoto.
 * Non è un giudizio legale né una garanzia: è una verifica tecnica del pacchetto.
 */
export function scoreCompatibility({ abis = [], minSdk = null, targetSdk = null, nativeLibraries = {} },
    { runtimeApi = RUNTIME_ANDROID_API } = {}) {
    const reasons = [];
    const notes = [];
    let level = 'ready';

    const hasNative = abis.length > 0;
    if (hasNative && !emulatorAbis(abis)) {
        level = 'limited';
        reasons.push('Contiene solo librerie native ARM: serve un host Android ARM o la traduzione ARM dell’emulatore.');
    } else if (hasNative) {
        notes.push('Include librerie native x86/x86_64: compatibile con emulatori Android standard.');
    } else {
        notes.push('Nessuna libreria nativa: il codice gira sulla macchina virtuale Android.');
    }
    if (Number.isFinite(minSdk) && minSdk > runtimeApi) {
        level = 'blocked';
        reasons.push(`Richiede Android API ${minSdk}, l’ambiente di esecuzione ne offre ${runtimeApi}.`);
    }
    if (Number.isFinite(targetSdk) && targetSdk > runtimeApi) {
        notes.push(`Target SDK ${targetSdk}: alcune API recenti potrebbero non essere presenti nell’ambiente (API ${runtimeApi}).`);
    }
    if (Object.keys(nativeLibraries).length > 12) {
        notes.push('Molte librerie native: il primo avvio nell’emulatore può richiedere più tempo.');
    }
    return { level, reasons, notes };
}

/* ------------------------------------------------------------------ */
/* Analisi completa                                                    */
/* ------------------------------------------------------------------ */

const asNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const sanitizeName = (value, fallback) => String(value || '').replace(/\u0000/g, '').trim().slice(0, 120) || fallback;

/**
 * Analizza un APK e restituisce metadati, icona e report tecnico.
 * Nessuna chiamata di rete: il file resta nel browser finché l'utente non conferma.
 */
export async function analyzeApk(file, { onProgress = () => {} } = {}) {
    const report = (percent, label, step) => onProgress({ percent, label, step });

    report(3, 'Verifico il file…', 'validate');
    if (!file) throw new Error('Nessun file selezionato.');
    const fileName = String(file.name || '');
    if (/(\.xapk|\.apks|\.apkm|\.aab)$/i.test(fileName)) {
        throw new Error(`«${fileName}» è un pacchetto multiplo: APP LAB installa solo APK singoli. Scarica l’APK del dispositivo (arm64) e riprova.`);
    }
    if (!/\.apk$/i.test(fileName)) throw new Error(`«${fileName}» non ha estensione .apk: serve un file APK.`);
    if (!file.size) throw new Error(`«${fileName}» è vuoto (0 byte).`);
    if (file.size > MAX_APK_BYTES) {
        throw new Error(`«${fileName}» pesa ${formatBytes(file.size)}: il limite è ${formatBytes(MAX_APK_BYTES)}.`);
    }
    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (header[0] !== 0x50 || header[1] !== 0x4b || header[2] !== 0x03 || header[3] !== 0x04) {
        throw new Error('Il file non è un APK valido (manca l’intestazione ZIP).');
    }

    report(12, 'Apro l’archivio…', 'zip');
    const zip = await openApkZip(file);

    report(26, 'Leggo AndroidManifest.xml…', 'manifest');
    const manifestBytes = await zip.read('AndroidManifest.xml');
    const document = parseBinaryXml(manifestBytes);
    const manifest = document.children.find(child => child.name === 'manifest');
    if (!manifest) throw new Error('AndroidManifest.xml non contiene l’elemento manifest.');

    const packageName = String(manifest.attributes.package || '').trim();
    if (!/^[a-zA-Z][\w]*(\.[\w]+)+$/.test(packageName) || packageName.length > 200) {
        throw new Error('Package name non valido nel manifest.');
    }
    const versionName = sanitizeName(manifest.attributes.versionName, '');
    const versionCode = asNumber(manifest.attributes.versionCode);
    const usesSdk = listChildren(manifest, 'uses-sdk')[0]?.attributes || {};
    const minSdk = asNumber(usesSdk.minSdkVersion);
    const targetSdk = asNumber(usesSdk.targetSdkVersion);
    const split = manifest.attributes.split || null;
    const application = listChildren(manifest, 'application')[0] || { attributes: {}, children: [] };

    const permissions = [...listChildren(manifest, 'uses-permission'), ...listChildren(manifest, 'uses-permission-sdk-23')]
        .map(node => String(node.attributes.name || ''))
        .filter(Boolean)
        .map(describePermission);
    const features = listChildren(manifest, 'uses-feature')
        .map(node => ({ name: String(node.attributes.name || ''), required: node.attributes.required !== false }))
        .filter(feature => feature.name);

    const activities = listChildren(application, 'activity');
    const launcher = activities.find(activity => (activity.children || []).some(filter => {
        if (filter.name !== 'intent-filter') return false;
        const actions = listChildren(filter, 'action').map(node => node.attributes.name);
        const categories = listChildren(filter, 'category').map(node => node.attributes.name);
        return actions.includes('android.intent.action.MAIN') && categories.includes('android.intent.category.LAUNCHER');
    }));
    const launcherActivity = launcher?.attributes?.name ? String(launcher.attributes.name) : null;

    report(46, 'Estraggo le risorse…', 'resources');
    let values = new Map();
    if (zip.has('resources.arsc')) {
        try {
            values = parseResourceTable(await zip.read('resources.arsc'));
        } catch (error) {
            console.warn('APP LAB: resources.arsc non leggibile', error);
        }
    }
    const labelReference = application.attributes.label;
    const labelFromTable = typeof labelReference === 'string' && labelReference.startsWith('@0x')
        ? resolveResourceStrings(values, resourceIdFromReference(labelReference))[0]
        : null;
    const rawLabel = typeof labelReference === 'string' && !labelReference.startsWith('@0x') ? labelReference : labelFromTable;
    const name = sanitizeName(rawLabel, packageName.split('.').pop() || 'Applicazione');

    report(58, 'Cerco l’icona…', 'icon');
    const iconReference = application.attributes.icon ?? null;
    const roundReference = application.attributes.roundIcon ?? null;
    const icon = await extractIcon(zip, values, iconReference, roundReference);

    report(72, 'Rilevo librerie e firma…', 'libraries');
    const names = zip.names;
    const nativeLibraries = collectNativeLibraries(names);
    const abis = Object.keys(nativeLibraries);
    const frameworks = detectFrameworks(names, manifest);
    const signatures = await detectSignatures(file, zip);
    const dexFiles = names.filter(entry => /^classes\d*\.dex$/.test(entry)).length;
    const sizeBytes = file.size;

    const applicationFlags = {
        debuggable: application.attributes.debuggable === true,
        allowBackup: application.attributes.allowBackup !== false,
        usesCleartextTraffic: application.attributes.usesCleartextTraffic === true
    };
    const criticalPermissions = permissions.filter(permission => permission.severity === 'critical');
    const compatibility = scoreCompatibility({ abis, minSdk, targetSdk, nativeLibraries });

    if (split) {
        compatibility.level = 'blocked';
        compatibility.reasons.unshift('È un APK di split (App Bundle): da solo non contiene tutte le risorse dell’applicazione.');
    }
    if (!signatures.signed) {
        compatibility.reasons.push('Nessuna firma APK rilevata: l’installazione nell’ambiente remoto può essere rifiutata.');
        if (compatibility.level === 'ready') compatibility.level = 'limited';
    }
    if (criticalPermissions.length) {
        compatibility.notes.push(`Richiede ${criticalPermissions.length} permessi sensibili: verifica i diritti e i rischi prima dell’esecuzione.`);
    }

    report(88, 'Preparo il riepilogo…', 'report');
    const analysis = {
        schema: 1,
        analyzedAt: new Date().toISOString(),
        packageName,
        versionName,
        versionCode,
        minSdk: minSdk ?? null,
        targetSdk: targetSdk ?? null,
        sizeBytes,
        split,
        abis,
        nativeLibraries,
        frameworks,
        primaryFramework: primaryFramework(frameworks),
        permissions,
        features,
        topActivity: launcherActivity,
        activityCount: activities.length,
        dexFiles,
        signatures,
        applicationFlags,
        iconSource: icon.source,
        compatibility: {
            level: compatibility.level,
            reasons: compatibility.reasons,
            notes: compatibility.notes,
            runtimeApi: RUNTIME_ANDROID_API
        }
    };

    report(100, 'Analisi completata.', 'done');
    return {
        name,
        packageName,
        versionName,
        versionCode,
        sizeBytes: file.size,
        minSdk: minSdk ?? null,
        targetSdk: targetSdk ?? null,
        architectures: abis,
        frameworks,
        compatibility: compatibility.level,
        compatibilityReasons: compatibility.reasons,
        topActivity: launcherActivity,
        permissions,
        iconDataUrl: icon.dataUrl,
        analysis
    };
}

// `application/octet-stream` serve ai browser che non conoscono il tipo APK:
// senza, il selettore di macOS/iPadOS mostra i file in grigio e non li fa scegliere.
export const APK_ACCEPT = '.apk,application/vnd.android.package-archive,application/octet-stream';
export const formatBytes = bytes => {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`;
    return `${(value / 1024 / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 2 })} GB`;
};
