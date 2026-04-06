// CORRETTO: 3 livelli per uscire da tabletop -> features -> components
import { supabase, SUPABASE_CONFIG } from '../../../services/supabase.js';

// Fallback se SUPABASE_CONFIG non fosse disponibile
const tables = SUPABASE_CONFIG?.tables || { tokens: 'tokens' };

/**
 * Gestisce la griglia interattiva e i token della sessione
 */
export function showTabletop(container, sessionId) {
    let scale = 1;
    let translateX = 0;
    let translateY = 0;

    // --- 1. SETUP STRUTTURA E STILE ---
    container.innerHTML = `
        <style>
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
                cursor: pointer; display:flex; flex-direction:column; align-items:center; 
                /* Rimuoviamo la transition di transform per un drag in tempo reale più fluido */
                transition: box-shadow 0.2s;
            }
            
            .token.dragging {
                z-index: 1000 !important;
                filter: brightness(1.2);
            }
            
            .token-img { 
                width: 100%; height: 100%; border-radius: 50%; 
                border: 3px solid var(--amethyst-bright); 
                box-shadow: 0 0 15px rgba(157, 78, 221, 0.5); 
                object-fit: cover; background: #0a0a0f; 
                pointer-events: none; /* Evita conflitti col drag */
            }
            
            .token-name { 
                position: absolute; top: -22px; background: rgba(5, 2, 10, 0.9); 
                padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800;
                white-space: nowrap; color: white; border: 1px solid rgba(157,78,221,0.3); 
                pointer-events: none; backdrop-filter: blur(5px);
            }
        </style>
        
        <div class="tabletop-viewport" id="viewport">
            <div class="map-layer" id="map-layer"></div>
        </div>
    `;

    const viewport = container.querySelector('#viewport');
    const mapLayer = container.querySelector('#map-layer');

    const updateTransform = () => {
        mapLayer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    };
    updateTransform(); // Applica i valori iniziali

    // --- 2. LOGICA PANNING (Movimento telecamera) ---
    viewport.addEventListener('pointerdown', (e) => {
        // Se clicchiamo su un token, non muoviamo la mappa
        if (e.target.closest('.token')) return;

        viewport.setPointerCapture(e.pointerId);
        const startX = e.clientX - translateX;
        const startY = e.clientY - translateY;

        const onMove = (ev) => {
            translateX = ev.clientX - startX;
            translateY = ev.clientY - startY;
            updateTransform();
        };

        const onUp = (ev) => {
            viewport.releasePointerCapture(ev.pointerId);
            viewport.removeEventListener('pointermove', onMove);
            viewport.removeEventListener('pointerup', onUp);
        };

        viewport.addEventListener('pointermove', onMove);
        viewport.addEventListener('pointerup', onUp);
    });

    // --- 3. LOGICA ZOOM ---
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1; // 0.9 rimpicciolisce, 1.1 ingrandisce
        scale = Math.min(Math.max(0.3, scale * delta), 3); // Limite zoom: 30% - 300%
        updateTransform();
    }, { passive: false });

    // --- 4. LOGICA TOKEN (Render e Drag) ---
    function renderToken(doc) {
        let el = document.getElementById(`token-${doc.id}`);
        
        if (!el) {
            // Crea il token se non esiste
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
        
        // Se qualcuno sta muovendo QUESTO token sul proprio schermo, non lo aggiorniamo
        // con i dati in entrata finché non ha finito (evita scatti fastidiosi).
        if (!el.classList.contains('dragging')) {
            el.style.left = `${doc.x}px`;
            el.style.top = `${doc.y}px`;
        }
    }

    function makeTokenDraggable(el, doc) {
        el.addEventListener('pointerdown', (e) => {
            e.stopPropagation(); // Ferma il click prima che arrivi alla mappa
            el.setPointerCapture(e.pointerId);
            el.classList.add('dragging');

            // Calcoliamo l'offset per evitare che il token "salti" al centro del dito
            const rect = el.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const offsetY = e.clientY - rect.top;

            const onMove = (ev) => {
                const mapRect = mapLayer.getBoundingClientRect();
                // Calcolo della posizione esatta scalata e aggiustata per l'offset
                const x = (ev.clientX - mapRect.left - offsetX) / scale;
                const y = (ev.clientY - mapRect.top - offsetY) / scale;
                
                el.style.left = `${x}px`;
                el.style.top = `${y}px`;
            };

            const onUp = async (ev) => {
                el.releasePointerCapture(ev.pointerId);
                el.removeEventListener('pointermove', onMove);
                el.removeEventListener('pointerup', onUp);
                el.classList.remove('dragging');

                // Salvataggio nel database a fine trascinamento
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

            el.addEventListener('pointermove', onMove);
            el.addEventListener('pointerup', onUp);
        });
    }

    // --- 5. CARICAMENTO INIZIALE E SYNC REALTIME ---
    async function loadTokens() {
        try {
            const { data } = await supabase
                .from(tables.tokens)
                .select('*')
                .eq('session_id', sessionId);
            
            if (data) data.forEach(renderToken);
        } catch(err) {
            console.error("Errore caricamento token iniziali:", err);
        }
    }

    loadTokens();

    const mapSubscription = supabase.channel(`map-${sessionId}`)
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

    // CLEANUP (Opzionale: se uscirai distruggendo il container)
    // Se un domani implementerai una logica di smontaggio, ricordati di fare:
    // supabase.removeChannel(mapSubscription);
}

// Supporto per l'inizializzazione da main.js (Mantenuto intatto)
export function initMap() {
    const canvas = document.getElementById('map-canvas');
    if (canvas) {
        showTabletop(canvas, canvas.dataset.sessionId || 'default');
    }
}
