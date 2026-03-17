import { databases, client, APPWRITE_CONFIG } from '../services/appwrite.js';

const DB_ID = APPWRITE_CONFIG.dbId;
const COL_ID = APPWRITE_CONFIG.collections.tokens; // Assicurati che sia corretta nel config

export function showTabletop(container, sessionId) {
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isPanning = false;
    let startX, startY;

    // 1. STILI OTTIMIZZATI (Hardware Accelerated)
    const style = document.createElement('style');
    style.innerHTML = `
        .tabletop-viewport {
            width: 100%; height: 100%; position: absolute; inset: 0;
            overflow: hidden; cursor: grab; touch-action: none;
            background: #0f0617;
        }
        .map-layer {
            position: absolute; width: 3000px; height: 3000px;
            background-image: 
                radial-gradient(rgba(169, 83, 236, 0.15) 1px, transparent 1px),
                linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px);
            background-size: 40px 40px, 40px 40px, 40px 40px;
            transform-origin: 0 0;
            will-change: transform;
        }
        .token {
            position: absolute; width: 60px; height: 60px;
            border-radius: 50%; border: 3px solid var(--accent);
            background-size: cover; background-position: center;
            box-shadow: 0 0 15px var(--accent-glow);
            cursor: move; touch-action: none; z-index: 10;
        }
        .token.dragging { opacity: 0.8; z-index: 1000; transform: scale(1.1); }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <div class="tabletop-viewport" id="viewport">
            <div class="map-layer" id="map-layer"></div>
        </div>
    `;

    const viewport = container.querySelector('#viewport');
    const mapLayer = container.querySelector('#map-layer');

    // --- 2. LOGICA PAN & ZOOM (Corretta per Mobile) ---
    viewport.onpointerdown = (e) => {
        if (e.target === viewport || e.target === mapLayer) {
            isPanning = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            viewport.style.cursor = 'grabbing';
            viewport.setPointerCapture(e.pointerId);
        }
    };

    viewport.onpointermove = (e) => {
        if (isPanning) {
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            updateTransform();
        }
    };

    viewport.onpointerup = (e) => {
        isPanning = false;
        viewport.style.cursor = 'grab';
        viewport.releasePointerCapture(e.pointerId);
    };

    // Zoom fluido (funziona con mouse wheel e pinch-to-zoom simulato)
    viewport.onwheel = (e) => {
        e.preventDefault();
        const zoomSpeed = 0.001;
        const delta = -e.deltaY;
        const oldScale = scale;
        scale = Math.min(Math.max(0.2, scale + delta * zoomSpeed), 3);
        
        // Opzionale: Zoom verso il cursore (più complesso, per ora manteniamo centrale)
        updateTransform();
    };

    function updateTransform() {
        mapLayer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    // --- 3. GESTIONE TOKEN (Math Fix) ---
    async function loadTokens() {
        try {
            const res = await databases.listDocuments(DB_ID, COL_ID);
            res.documents.forEach(renderToken);
        } catch (err) { console.error("Errore caricamento:", err); }
    }

    function renderToken(doc) {
        let el = document.getElementById(`token-${doc.$id}`);
        if (!el) {
            el = document.createElement('div');
            el.id = `token-${doc.$id}`;
            el.className = 'token';
            mapLayer.appendChild(el);
            setupTokenDrag(el, doc);
        }
        el.style.left = `${doc.x}px`;
        el.style.top = `${doc.y}px`;
        // Supporto sia per URL esterni che per storage Appwrite
        if (doc.img_url) el.style.backgroundImage = `url(${doc.img_url})`;
    }

    function setupTokenDrag(el, doc) {
        let isDragging = false;

        el.onpointerdown = (e) => {
            e.stopPropagation();
            isDragging = true;
            el.classList.add('dragging');
            el.setPointerCapture(e.pointerId);
        };

        el.onpointermove = (e) => {
            if (!isDragging) return;

            // FIX MATEMATICO: Calcoliamo la posizione ignorando il CSS transform del genitore
            const rect = mapLayer.getBoundingClientRect();
            
            // Togliamo l'offset della mappa e dividiamo per lo scale attuale
            const x = (e.clientX - rect.left) / scale - 30; // 30 è metà larghezza token
            const y = (e.clientY - rect.top) / scale - 30;

            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
        };

        el.onpointerup = async (e) => {
            if (!isDragging) return;
            isDragging = false;
            el.classList.remove('dragging');
            el.releasePointerCapture(e.pointerId);
            
            try {
                await databases.updateDocument(DB_ID, COL_ID, doc.$id, {
                    x: Math.round(parseFloat(el.style.left)),
                    y: Math.round(parseFloat(el.style.top))
                });
            } catch (err) { console.error("Update fallito:", err); }
        };
    }

    // --- 4. REALTIME ---
    // Importante: Assicurati che l'ID del database nel client.subscribe sia corretto
    client.subscribe(`databases.${DB_ID}.collections.${COL_ID}.documents`, res => {
        const events = [
            `databases.${DB_ID}.collections.${COL_ID}.documents.*.update`,
            `databases.${DB_ID}.collections.${COL_ID}.documents.*.create`
        ];
        
        if (events.some(e => res.events.includes(e))) {
            renderToken(res.payload);
        }
    });

    loadTokens();
}