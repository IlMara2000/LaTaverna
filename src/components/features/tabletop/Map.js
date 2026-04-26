import { supabase } from '../../../services/supabase.js';

const TOKEN_TABLE = 'dnd_tokens';

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export function showTabletop(container, sessionId, options = {}) {
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let fogEnabled = options.fogEnabled !== false;

    container.innerHTML = `
        <div class="tabletop-viewport" id="viewport">
            <div class="map-layer" id="map-layer">
                ${options.mapUrl ? `<img class="map-image" src="${escapeHTML(options.mapUrl)}" alt="">` : ''}
                <div class="map-grid"></div>
                <div class="map-fog ${fogEnabled ? 'active' : ''}" id="map-fog"></div>
            </div>
        </div>
    `;

    const viewport = container.querySelector('#viewport');
    const mapLayer = container.querySelector('#map-layer');
    const fog = container.querySelector('#map-fog');

    const updateTransform = () => {
        mapLayer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    };
    updateTransform();

    viewport.addEventListener('pointerdown', (e) => {
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

    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        scale = Math.min(Math.max(0.35, scale * delta), 3);
        updateTransform();
    }, { passive: false });

    const renderToken = (doc) => {
        if (!doc?.id) return;
        let el = mapLayer.querySelector(`#token-${CSS.escape(String(doc.id))}`);
        if (!el) {
            el = document.createElement('div');
            el.id = `token-${doc.id}`;
            el.className = 'token';
            el.innerHTML = `
                <span class="token-name">${escapeHTML(doc.name || 'Token')}</span>
                <div class="token-img" style="border-color:${escapeHTML(doc.color || '#c77dff')}">
                    ${doc.img ? `<img src="${escapeHTML(doc.img)}" alt="">` : `<span>${escapeHTML((doc.name || '?').charAt(0).toUpperCase())}</span>`}
                </div>
            `;
            mapLayer.appendChild(el);
            makeTokenDraggable(el, doc);
        }

        if (!el.classList.contains('dragging')) {
            el.style.left = `${doc.x || 300}px`;
            el.style.top = `${doc.y || 300}px`;
        }
    };

    const makeTokenDraggable = (el, doc) => {
        el.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            el.setPointerCapture(e.pointerId);
            el.classList.add('dragging');
            const rect = el.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const offsetY = e.clientY - rect.top;

            const onMove = (ev) => {
                const mapRect = mapLayer.getBoundingClientRect();
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
                try {
                    await supabase
                        .from(TOKEN_TABLE)
                        .update({
                            x: Math.round(parseFloat(el.style.left)),
                            y: Math.round(parseFloat(el.style.top))
                        })
                        .eq('id', doc.id);
                } catch (err) {
                    console.error('Errore sync token:', err);
                }
            };

            el.addEventListener('pointermove', onMove);
            el.addEventListener('pointerup', onUp);
        });
    };

    const loadTokens = async () => {
        try {
            const { data, error } = await supabase
                .from(TOKEN_TABLE)
                .select('*')
                .eq('session_id', sessionId);
            if (error) throw error;
            (data || []).forEach(renderToken);
        } catch (err) {
            console.error('Errore caricamento token:', err);
        }
    };

    loadTokens();

    let mapSubscription = null;
    try {
        mapSubscription = supabase.channel(`dnd-map-${sessionId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: TOKEN_TABLE,
                filter: `session_id=eq.${sessionId}`
            }, payload => {
                if (payload.eventType === 'DELETE') {
                    mapLayer.querySelector(`#token-${CSS.escape(String(payload.old.id))}`)?.remove();
                } else {
                    renderToken(payload.new);
                }
            })
            .subscribe();
    } catch (err) {
        console.warn('Realtime mappa non disponibile:', err);
    }

    window.__dndMapApi = {
        addToken: async (token) => {
            const payload = {
                session_id: sessionId,
                name: token.name || 'Token',
                img: token.img || '',
                color: token.color || '#c77dff',
                x: 420,
                y: 420
            };
            const { data, error } = await supabase.from(TOKEN_TABLE).insert([payload]).select('*').single();
            if (error) throw error;
            renderToken(data || payload);
        },
        toggleFog: () => {
            fogEnabled = !fogEnabled;
            fog.classList.toggle('active', fogEnabled);
            return fogEnabled;
        },
        cleanup: () => {
            if (mapSubscription && supabase.removeChannel) supabase.removeChannel(mapSubscription);
        }
    };
}

export function initMap() {
    const canvas = document.getElementById('map-canvas');
    if (canvas) showTabletop(canvas, canvas.dataset.sessionId || 'default');
}
