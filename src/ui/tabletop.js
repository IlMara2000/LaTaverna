import { databases, client } from '../services/appwrite.js';

const DB_ID = '69a867cc0018c0a6d700';
const COL_ID = 'tokens';

/**
 * Gestisce la logica del tavolo da gioco: zoom, pan e movimento token.
 */
export function showTabletop(container, sessionId) {
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isPanning = false;
    let startX, startY;

    // Creazione dinamica degli stili per i Token (Effetto Glassed)
    const style = document.createElement('style');
    style.innerHTML = `
        .tabletop-viewport {
            width: 100%; height: 100%; position: relative;
            overflow: hidden; cursor: grab; touch-action: none;
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
            transition: transform 0.1s ease-out;
        }
        .token:active { transform: scale(1.1); z-index: 100; }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <div class="tabletop-viewport" id="viewport">
            <div class="map-layer" id="map-layer"></div>
        </div>
    `;

    const viewport = container.querySelector('#viewport');
    const mapLayer = container.querySelector('#map-layer');

    // --- LOGICA PAN & ZOOM (Mobile Friendly) ---
    viewport.onpointerdown = (e) => {
        if (e.target === viewport || e.target === mapLayer) {
            isPanning = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            viewport.style.cursor = 'grabbing';
        }
    };

    window.onpointermove = (e) => {
        if (isPanning) {
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            updateTransform();
        }
    };

    window.onpointerup = () => {
        isPanning = false;
        viewport.style.cursor = 'grab';
    };

    viewport.onwheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        scale = Math.min(Math.max(0.2, scale * delta), 3);
        updateTransform();
    };

    function updateTransform() {
        mapLayer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    // --- GESTIONE TOKEN ---
    async function loadTokens() {
        try {
            const res = await databases.listDocuments(DB_ID, COL_ID);
            res.documents.forEach(renderToken);
        } catch (err) { console.error("Errore caricamento token:", err); }
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
        if (doc.img_url) el.style.backgroundImage = `url(${doc.img_url})`;
    }

    function setupTokenDrag(el, doc) {
        let isDragging = false;

        el.onpointerdown = (e) => {
            e.stopPropagation();
            isDragging = true;
            el.setPointerCapture(e.pointerId);
        };

        el.onpointermove = (e) => {
            if (!isDragging) return;
            // Calcolo posizione relativa allo zoom
            const rect = mapLayer.getBoundingClientRect();
            const x = (e.clientX - rect.left) / scale - (el.offsetWidth / 2);
            const y = (e.clientY - rect.top) / scale - (el.offsetHeight / 2);
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
        };

        el.onpointerup = async (e) => {
            if (!isDragging) return;
            isDragging = false;
            el.releasePointerCapture(e.pointerId);
            
            await databases.updateDocument(DB_ID, COL_ID, doc.$id, {
                x: parseInt(el.style.left),
                y: parseInt(el.style.top)
            });
        };
    }

    // --- REALTIME ---
    client.subscribe(`databases.${DB_ID}.collections.${COL_ID}.documents`, res => {
        if (res.events.some(e => e.includes('.update') || e.includes('.create'))) {
            renderToken(res.payload);
        }
    });

    loadTokens();
}
