import { supabase, SUPABASE_CONFIG } from '../../../services/supabase.js';
import { dndLocalStore } from '../../../services/dndLocalStore.js';

const TOKEN_TABLE = SUPABASE_CONFIG?.tables?.tokens || 'dnd_tokens';

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const isMissingColumnError = (error) => {
    const message = String(error?.message || '');
    return error?.code === '42703'
        || message.includes('does not exist')
        || message.includes('Could not find')
        || message.includes('schema cache');
};

async function insertToken(payload) {
    const attempts = [
        payload,
        Object.fromEntries(Object.entries(payload).filter(([key]) => !['character_id', 'data'].includes(key)))
    ];

    let lastResult = null;
    for (const nextPayload of attempts) {
        lastResult = await supabase.from(TOKEN_TABLE).insert([nextPayload]).select('*').single();
        if (!lastResult.error || !isMissingColumnError(lastResult.error)) return lastResult;
    }
    return lastResult;
}

const isPdfMap = (url = '') => {
    const cleanUrl = String(url).split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.pdf') || String(url).toLowerCase().includes('application/pdf');
};

export function showTabletop(container, sessionId, options = {}) {
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let fogEnabled = options.fogEnabled !== false;
    let gridVisible = options.gridVisible !== false;
    let gridSize = Number(options.gridSize || 50);
    let knownTokens = [];
    const localMode = Boolean(options.localMode);
    const localStore = options.localStore || dndLocalStore;

    container.innerHTML = `
        <div class="tabletop-viewport" id="viewport">
            <div class="map-layer" id="map-layer">
                ${options.mapUrl ? (
                    isPdfMap(options.mapUrl)
                        ? `<iframe class="map-pdf" src="${escapeHTML(options.mapUrl)}" title="Mappa PDF"></iframe>`
                        : `<img class="map-image" src="${escapeHTML(options.mapUrl)}" alt="">`
                ) : '<div class="map-empty"><strong>Nessuna mappa</strong><span>Carica una mappa nella configurazione sessione o usa la griglia come tavolo libero.</span></div>'}
                <div class="map-grid ${gridVisible ? '' : 'is-hidden'}" id="map-grid"></div>
                <div class="map-fog ${fogEnabled ? 'active' : ''}" id="map-fog"></div>
            </div>
        </div>
    `;

    const viewport = container.querySelector('#viewport');
    const mapLayer = container.querySelector('#map-layer');
    const fog = container.querySelector('#map-fog');
    const grid = container.querySelector('#map-grid');

    const updateTransform = () => {
        mapLayer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    };

    const updateGrid = () => {
        grid.style.backgroundSize = `${gridSize}px ${gridSize}px`;
        grid.classList.toggle('is-hidden', !gridVisible);
    };

    const notifyTokens = () => {
        if (typeof options.onTokensChange === 'function') {
            options.onTokensChange([...knownTokens]);
        }
    };

    const upsertKnownToken = (doc) => {
        if (!doc?.id) return;
        knownTokens = knownTokens.filter(token => String(token.id) !== String(doc.id));
        knownTokens.push(doc);
        knownTokens.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        notifyTokens();
    };

    const removeKnownToken = (id) => {
        knownTokens = knownTokens.filter(token => String(token.id) !== String(id));
        notifyTokens();
    };

    const setScale = (nextScale) => {
        scale = Math.min(Math.max(0.35, nextScale), 3);
        updateTransform();
    };

    const setFog = (nextValue) => {
        fogEnabled = Boolean(nextValue);
        fog.classList.toggle('active', fogEnabled);
        return fogEnabled;
    };

    const setGridVisible = (nextValue) => {
        gridVisible = Boolean(nextValue);
        updateGrid();
        return gridVisible;
    };

    const pingAt = (x, y) => {
        const marker = document.createElement('div');
        marker.className = 'map-ping';
        marker.style.left = `${Math.round(x)}px`;
        marker.style.top = `${Math.round(y)}px`;
        mapLayer.appendChild(marker);
        window.setTimeout(() => marker.remove(), 1400);
    };

    const pingCenter = () => {
        const rect = viewport.getBoundingClientRect();
        const x = (rect.width / 2 - translateX) / scale;
        const y = (rect.height / 2 - translateY) / scale;
        pingAt(x, y);
    };

    updateTransform();
    updateGrid();

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
        setScale(scale * delta);
    }, { passive: false });

    const renderToken = (doc) => {
        if (!doc?.id) return;
        upsertKnownToken(doc);
        let el = mapLayer.querySelector(`#token-${CSS.escape(String(doc.id))}`);
        const hp = Number(doc.data?.hp ?? 0);
        const hpMax = Number(doc.data?.hp_max ?? 0);
        const hpPct = hpMax > 0 ? Math.max(0, Math.min(100, Math.round((hp / hpMax) * 100))) : 0;
        if (!el) {
            el = document.createElement('div');
            el.id = `token-${doc.id}`;
            el.className = 'token';
            el.dataset.tokenId = doc.id;
            el.innerHTML = `
                <span class="token-name">${escapeHTML(doc.name || 'Token')}</span>
                <div class="token-img" style="border-color:${escapeHTML(doc.color || '#c77dff')}">
                    ${doc.img ? `<img src="${escapeHTML(doc.img)}" alt="">` : `<span>${escapeHTML((doc.name || '?').charAt(0).toUpperCase())}</span>`}
                </div>
                <div class="token-hp ${hpMax > 0 ? '' : 'is-hidden'}"><span style="width:${hpPct}%"></span></div>
            `;
            mapLayer.appendChild(el);
            makeTokenDraggable(el, doc);
        } else {
            el.querySelector('.token-name').textContent = doc.name || 'Token';
            const img = el.querySelector('.token-img');
            img.style.borderColor = doc.color || '#c77dff';
            img.innerHTML = doc.img
                ? `<img src="${escapeHTML(doc.img)}" alt="">`
                : `<span>${escapeHTML((doc.name || '?').charAt(0).toUpperCase())}</span>`;
            const hpBar = el.querySelector('.token-hp');
            hpBar.classList.toggle('is-hidden', hpMax <= 0);
            hpBar.querySelector('span').style.width = `${hpPct}%`;
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
                    const patch = {
                        x: Math.round(parseFloat(el.style.left)),
                        y: Math.round(parseFloat(el.style.top))
                    };
                    if (localMode) {
                        localStore.tokens.update(doc.id, patch);
                    } else {
                        await supabase
                            .from(TOKEN_TABLE)
                            .update(patch)
                            .eq('id', doc.id);
                    }
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
            const { data, error } = localMode
                ? localStore.tokens.list(sessionId)
                : await supabase
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
    if (!localMode) {
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
                        removeKnownToken(payload.old.id);
                    } else {
                        renderToken(payload.new);
                    }
                })
                .subscribe();
        } catch (err) {
            console.warn('Realtime mappa non disponibile:', err);
        }
    }

    window.__dndMapApi = {
        getTokens: () => [...knownTokens],
        addToken: async (token) => {
            const payload = {
                session_id: sessionId,
                name: token.name || 'Token',
                img: token.img || '',
                color: token.color || '#c77dff',
                x: 420,
                y: 420,
                character_id: token.character_id || null,
                data: token.data || {}
            };
            const { data, error } = localMode
                ? localStore.tokens.insert(payload)
                : await insertToken(payload);
            if (error) throw error;
            renderToken(data || payload);
        },
        updateToken: async (id, patch) => {
            const current = knownTokens.find(token => String(token.id) === String(id)) || {};
            const payload = {
                ...patch,
                data: patch.data ? { ...(current.data || {}), ...patch.data } : current.data
            };
            const { data, error } = localMode
                ? localStore.tokens.update(id, payload)
                : await supabase
                    .from(TOKEN_TABLE)
                    .update(payload)
                    .eq('id', id)
                    .select('*')
                    .single();
            if (error) throw error;
            renderToken(data || { ...current, ...payload });
            return data;
        },
        deleteToken: async (id) => {
            const { error } = localMode
                ? localStore.tokens.delete(id)
                : await supabase.from(TOKEN_TABLE).delete().eq('id', id);
            if (error) throw error;
            mapLayer.querySelector(`#token-${CSS.escape(String(id))}`)?.remove();
            removeKnownToken(id);
        },
        focusToken: (id) => {
            const token = knownTokens.find(item => String(item.id) === String(id));
            if (!token) return;
            const rect = viewport.getBoundingClientRect();
            translateX = rect.width / 2 - Number(token.x || 0) * scale;
            translateY = rect.height / 2 - Number(token.y || 0) * scale;
            updateTransform();
            const tokenEl = mapLayer.querySelector(`#token-${CSS.escape(String(id))}`);
            if (tokenEl) {
                tokenEl.classList.add('focused');
                window.setTimeout(() => tokenEl.classList.remove('focused'), 1200);
            }
        },
        zoomIn: () => setScale(scale * 1.15),
        zoomOut: () => setScale(scale * 0.85),
        resetView: () => {
            scale = 1;
            translateX = 0;
            translateY = 0;
            updateTransform();
        },
        toggleFog: () => {
            return setFog(!fogEnabled);
        },
        toggleGrid: () => {
            return setGridVisible(!gridVisible);
        },
        setFog,
        setGridVisible,
        setGridSize: (size) => {
            gridSize = Math.min(Math.max(Number(size) || 50, 20), 200);
            updateGrid();
            return gridSize;
        },
        pingCenter,
        cleanup: () => {
            if (mapSubscription && supabase.removeChannel) supabase.removeChannel(mapSubscription);
        }
    };
}

export function initMap() {
    const canvas = document.getElementById('map-canvas');
    if (canvas) showTabletop(canvas, canvas.dataset.sessionId || 'default');
}
