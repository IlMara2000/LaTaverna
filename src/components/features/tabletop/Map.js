import { supabase, SUPABASE_CONFIG } from '../../services/supabase.js';

const { tables } = SUPABASE_CONFIG;

/**
 * Gestisce la griglia interattiva e i token della sessione
 */
export function showTabletop(container, sessionId) {
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isPanning = false;
    let startX, startY;

    // --- 1. STILE CSS (Isolato per la Mappa) ---
    const style = document.createElement('style');
    style.innerHTML = `
        .tabletop-viewport { 
            width: 100%; height: 100%; position: absolute; inset: 0; 
            overflow: hidden; cursor: grab; touch-action: none; background: #05020a; 
        }
        .tabletop-viewport:active { cursor: grabbing; }
        .map-layer { 
            position: absolute; width: 4000px; height: 4000px; 
            transform-origin: 0 0; will-change: transform; 
            background-image: radial-gradient(rgba(157, 78, 221, 0.15) 1px, transparent 1px); 
            background-size: 50px 50px; 
        }
        .token { 
            position: absolute; width: 60px; height: 60px; z-index: 10; 
            cursor: pointer; transition: transform 0.1s; display:flex; 
            flex-direction:column; align-items:center; 
        }
        .token-img { 
            width: 100%; height: 100%; border-radius: 50%; 
            border: 3px solid var(--amethyst-bright); 
            box-shadow: 0 0 15px var(--amethyst-glow); 
            object-fit: cover; background: var(--void-black); 
        }
        .token-name { 
            position: absolute; top: -20px; background: rgba(0,0,0,0.8); 
            padding: 2px 8px; border-radius: 4px; font-size: 10px; 
            white-space: nowrap; color: white; border: 1px solid var(--glass-border); 
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <div class="tabletop-viewport" id="viewport">
            <div class="map-layer" id="map-layer"></div>
        </div>
    `;

    const viewport = container.querySelector('#viewport');
    const mapLayer = container.querySelector('#map-layer');

    // --- 2. LOGICA PAN & ZOOM ---
    const updateTransform = () => {
        mapLayer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    };

    viewport.onpointerdown = (e) => {
        if (e.target !== viewport && e.target !== mapLayer) return;
        isPanning = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
    };

    window.onpointermove = (e) => {
        if (!isPanning) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
    };

    window.onpointerup = () => isPanning = false;

    viewport.onwheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        scale = Math.min(Math.max(0.2, scale * delta), 3);
        updateTransform();
    };

    // --- 3. RENDER E DRAG DEI TOKEN ---
    function renderToken(doc) {
        let el = document.getElementById(`token-${doc.id}`);
        if (!el) {
            el = document.createElement('div');
            el.id = `token-${doc.id}`;
            el.className = 'token';
            el.innerHTML = `
                <span class="token-name">${doc.name || 'Eroe'}</span>
                <img src="${doc.img || 'https://placehold.co/100/1a0833/c77dff?text=?'}" class="token-img">
            `;
            mapLayer.appendChild(el);
            makeTokenDraggable(el, doc);
        }
        el.style.left = `${doc.x}px`;
        el.style.top = `${doc.y}px`;
    }

    function makeTokenDraggable(el, doc) {
        let dragging = false;
        el.onpointerdown = (e) => {
            e.stopPropagation();
            dragging = true;
            el.style.zIndex = 1000;
        };

        window.onpointermove = (e) => {
            if (!dragging) return;
            const rect = mapLayer.getBoundingClientRect();
            const x = (e.clientX - rect.left) / scale - 30;
            const y = (e.clientY - rect.top) / scale - 30;
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
        };

        window.onpointerup = async () => {
            if (!dragging) return;
            dragging = false;
            el.style.zIndex = 10;

            try {
                await supabase
                    .from(tables.tokens)
                    .update({ 
                        x: Math.round(parseFloat(el.style.left)), 
                        y: Math.round(parseFloat(el.style.top)) 
                    })
                    .eq('id', doc.id);
            } catch (err) { 
                console.error("Errore sync token:", err); 
            }
        };
    }

    // --- 4. REALTIME ---
    async function loadTokens() {
        const { data } = await supabase
            .from(tables.tokens)
            .select('*')
            .eq('session_id', sessionId);
        if (data) data.forEach(renderToken);
    }

    loadTokens();

    supabase.channel(`map-${sessionId}`)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: tables.tokens,
            filter: `session_id=eq.${sessionId}` 
        }, payload => {
            if (payload.eventType === 'DELETE') {
                document.getElementById(`token-${payload.old.id}`)?.remove();
            } else {
                renderToken(payload.new);
            }
        })
        .subscribe();
}