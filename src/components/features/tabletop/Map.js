import { supabase, SUPABASE_CONFIG } from '../../../services/supabase.js';
import { dndLocalStore } from '../../../services/dndLocalStore.js';
import { clientToMapPoint, snapTokenToGrid } from './gridMath.js';
import { getCachedAppPreference } from '../../../services/appPreferences.js';

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

const WEATHER_TYPES = new Set(['clear', 'rain', 'storm', 'snow', 'mist']);

const weatherParticles = (weather) => {
    if (weather === 'rain' || weather === 'storm') {
        return Array.from({ length: weather === 'storm' ? 44 : 32 }, (_, index) => `
            <i style="--x:${(index * 37) % 103}%;--delay:${-(index % 13) * 0.17}s;--speed:${0.72 + (index % 7) * 0.055}s"></i>
        `).join('');
    }
    if (weather === 'snow') {
        return Array.from({ length: 30 }, (_, index) => `
            <i style="--x:${(index * 43) % 101}%;--delay:${-(index % 15) * 0.32}s;--speed:${3.6 + (index % 8) * 0.38}s;--size:${4 + (index % 4) * 2}px"></i>
        `).join('');
    }
    if (weather === 'mist') {
        return Array.from({ length: 7 }, (_, index) => `
            <i style="--y:${8 + index * 14}%;--delay:${-index * 1.3}s;--speed:${12 + index * 1.2}s"></i>
        `).join('');
    }
    return '';
};

export function showTabletop(container, sessionId, options = {}) {
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let timeOfDay = options.timeOfDay === 'night' || options.fogEnabled === true ? 'night' : 'day';
    let weather = WEATHER_TYPES.has(options.weather) ? options.weather : 'clear';
    let gridVisible = options.gridVisible !== false;
    let gridSize = Number(options.gridSize || 50);
    const snapToGrid = getCachedAppPreference('tabletop.snap_to_grid', true) !== false;
    const weatherEffectsEnabled = getCachedAppPreference('tabletop.weather_effects', true) !== false;
    let knownTokens = [];
    const localMode = Boolean(options.localMode);
    const localStore = options.localStore || dndLocalStore;
    const activePointers = new Map();
    let panState = null;
    let pinchState = null;

    container.innerHTML = `
        <div class="tabletop-viewport" id="viewport" tabindex="0" aria-label="Mappa di gioco interattiva">
            <div class="map-layer" id="map-layer">
                ${options.mapUrl ? (
                    isPdfMap(options.mapUrl)
                        ? `<iframe class="map-pdf" src="${escapeHTML(options.mapUrl)}" title="Mappa PDF"></iframe>`
                        : `<img class="map-image" src="${escapeHTML(options.mapUrl)}" alt="">`
                ) : '<div class="map-empty"><strong>Nessuna mappa</strong><span>Carica una mappa nella configurazione sessione o usa la griglia come tavolo libero.</span></div>'}
                <div class="map-grid ${gridVisible ? '' : 'is-hidden'}" id="map-grid"></div>
            </div>
            <div class="map-day-night" id="map-day-night" data-time="${timeOfDay}" aria-hidden="true"></div>
            <div class="map-weather" id="map-weather" data-weather="${weather}" aria-hidden="true">${weatherEffectsEnabled ? weatherParticles(weather) : ''}</div>
        </div>
    `;

    const viewport = container.querySelector('#viewport');
    const mapLayer = container.querySelector('#map-layer');
    const dayNightLayer = container.querySelector('#map-day-night');
    const weatherLayer = container.querySelector('#map-weather');
    const grid = container.querySelector('#map-grid');

    const updateTransform = () => {
        mapLayer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    };

    const updateGrid = () => {
        grid.style.backgroundSize = `${gridSize}px ${gridSize}px`;
        grid.classList.toggle('is-hidden', !gridVisible);
    };

    const snapTokenPosition = (x, y, tokenElement) => {
        if (!snapToGrid) return { x: Number(x) || 0, y: Number(y) || 0 };
        return snapTokenToGrid({
            x,
            y,
            gridSize,
            tokenWidth: tokenElement?.offsetWidth || 62,
            tokenHeight: tokenElement?.offsetHeight || 62
        });
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

    const clampScale = (nextScale) => Math.min(Math.max(0.2, nextScale), 5);

    const setScale = (nextScale, anchorClientX, anchorClientY) => {
        const next = clampScale(nextScale);
        const rect = viewport.getBoundingClientRect();
        const anchorX = Number.isFinite(anchorClientX) ? anchorClientX - rect.left : rect.width / 2;
        const anchorY = Number.isFinite(anchorClientY) ? anchorClientY - rect.top : rect.height / 2;
        const mapX = (anchorX - translateX) / scale;
        const mapY = (anchorY - translateY) / scale;

        scale = next;
        translateX = anchorX - mapX * scale;
        translateY = anchorY - mapY * scale;
        updateTransform();
    };

    const zoomBy = (factor, clientX, clientY) => setScale(scale * factor, clientX, clientY);

    const panBy = (deltaX = 0, deltaY = 0) => {
        translateX += deltaX;
        translateY += deltaY;
        updateTransform();
    };

    const setTimeOfDay = (nextValue) => {
        timeOfDay = nextValue === 'night' ? 'night' : 'day';
        dayNightLayer.dataset.time = timeOfDay;
        return timeOfDay;
    };

    const setWeather = (nextValue) => {
        weather = WEATHER_TYPES.has(nextValue) ? nextValue : 'clear';
        weatherLayer.dataset.weather = weather;
        weatherLayer.innerHTML = weatherEffectsEnabled ? weatherParticles(weather) : '';
        return weather;
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
    requestAnimationFrame(() => viewport.focus({ preventScroll: true }));

    const getPinchInfo = () => {
        const points = [...activePointers.values()];
        if (points.length < 2) return null;
        const [a, b] = points;
        const dx = b.clientX - a.clientX;
        const dy = b.clientY - a.clientY;
        return {
            distance: Math.hypot(dx, dy) || 1,
            centerX: (a.clientX + b.clientX) / 2,
            centerY: (a.clientY + b.clientY) / 2
        };
    };

    const beginPanFromPointer = (pointer) => {
        if (!pointer) {
            panState = null;
            return;
        }
        panState = {
            pointerId: pointer.pointerId,
            startX: pointer.clientX - translateX,
            startY: pointer.clientY - translateY
        };
    };

    const beginPinch = () => {
        const pinch = getPinchInfo();
        if (!pinch) return;
        const rect = viewport.getBoundingClientRect();
        const anchorX = pinch.centerX - rect.left;
        const anchorY = pinch.centerY - rect.top;
        pinchState = {
            startDistance: pinch.distance,
            startScale: scale,
            mapX: (anchorX - translateX) / scale,
            mapY: (anchorY - translateY) / scale
        };
        panState = null;
    };

    viewport.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.token')) return;
        viewport.focus({ preventScroll: true });
        viewport.setPointerCapture(e.pointerId);
        activePointers.set(e.pointerId, {
            pointerId: e.pointerId,
            clientX: e.clientX,
            clientY: e.clientY
        });

        if (activePointers.size === 1) {
            beginPanFromPointer(activePointers.get(e.pointerId));
        } else {
            beginPinch();
        }
    });

    const onViewportPointerMove = (e) => {
        if (!activePointers.has(e.pointerId)) return;
        activePointers.set(e.pointerId, {
            pointerId: e.pointerId,
            clientX: e.clientX,
            clientY: e.clientY
        });

        if (activePointers.size >= 2 && pinchState) {
            const pinch = getPinchInfo();
            if (!pinch) return;
            const nextScale = clampScale(pinchState.startScale * (pinch.distance / pinchState.startDistance));
            const rect = viewport.getBoundingClientRect();
            const anchorX = pinch.centerX - rect.left;
            const anchorY = pinch.centerY - rect.top;

            scale = nextScale;
            translateX = anchorX - pinchState.mapX * scale;
            translateY = anchorY - pinchState.mapY * scale;
            updateTransform();
            return;
        }

        if (panState && panState.pointerId === e.pointerId) {
            translateX = e.clientX - panState.startX;
            translateY = e.clientY - panState.startY;
            updateTransform();
        }
    };

    const endViewportPointer = (e) => {
        if (activePointers.has(e.pointerId)) activePointers.delete(e.pointerId);
        try {
            viewport.releasePointerCapture(e.pointerId);
        } catch {
            // Pointer capture may already be released by the browser.
        }

        if (activePointers.size >= 2) {
            beginPinch();
        } else if (activePointers.size === 1) {
            pinchState = null;
            beginPanFromPointer([...activePointers.values()][0]);
        } else {
            panState = null;
            pinchState = null;
        }
    };

    viewport.addEventListener('pointermove', onViewportPointerMove);
    viewport.addEventListener('pointerup', endViewportPointer);
    viewport.addEventListener('pointercancel', endViewportPointer);

    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    }, { passive: false });

    viewport.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        const zoomKey = key === '+' || key === '=' || key === '-' || key === '_' || key === '0';
        const panKey = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key);
        if (!zoomKey && !panKey) return;

        e.preventDefault();
        if (key === '+' || key === '=') zoomBy(1.15);
        if (key === '-' || key === '_') zoomBy(0.85);
        if (key === '0') {
            scale = 1;
            translateX = 0;
            translateY = 0;
            updateTransform();
        }
        if (key === 'arrowup') panBy(0, 48);
        if (key === 'arrowdown') panBy(0, -48);
        if (key === 'arrowleft') panBy(48, 0);
        if (key === 'arrowright') panBy(-48, 0);
    });

    const renderToken = (doc) => {
        if (!doc?.id) return;
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
            const snapped = snapTokenPosition(doc.x ?? 300, doc.y ?? 300, el);
            Object.assign(doc, snapped);
            el.style.left = `${snapped.x}px`;
            el.style.top = `${snapped.y}px`;
        }
        upsertKnownToken(doc);
    };

    const makeTokenDraggable = (el, doc) => {
        el.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            el.setPointerCapture(e.pointerId);
            el.classList.add('dragging');
            const mapRect = mapLayer.getBoundingClientRect();
            const startX = Number.parseFloat(el.style.left) || 0;
            const startY = Number.parseFloat(el.style.top) || 0;
            const pointerStart = clientToMapPoint({
                clientX: e.clientX,
                clientY: e.clientY,
                mapLeft: mapRect.left,
                mapTop: mapRect.top,
                scale
            });
            const offsetX = pointerStart.x - startX;
            const offsetY = pointerStart.y - startY;

            const onMove = (ev) => {
                const currentMapRect = mapLayer.getBoundingClientRect();
                const nextPoint = clientToMapPoint({
                    clientX: ev.clientX,
                    clientY: ev.clientY,
                    mapLeft: currentMapRect.left,
                    mapTop: currentMapRect.top,
                    scale,
                    offsetX,
                    offsetY
                });
                el.style.left = `${nextPoint.x}px`;
                el.style.top = `${nextPoint.y}px`;
            };

            let dragFinished = false;
            const finishDrag = async (ev) => {
                if (dragFinished) return;
                dragFinished = true;
                el.removeEventListener('pointermove', onMove);
                el.removeEventListener('pointerup', finishDrag);
                el.removeEventListener('pointercancel', finishDrag);
                el.removeEventListener('lostpointercapture', finishDrag);
                try {
                    if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
                } catch {
                    // Pointer capture may already be released on touch cancellation.
                }
                el.classList.remove('dragging');

                const patch = snapTokenPosition(
                    Number.parseFloat(el.style.left),
                    Number.parseFloat(el.style.top),
                    el
                );
                el.classList.add('snapping');
                el.style.left = `${patch.x}px`;
                el.style.top = `${patch.y}px`;
                window.setTimeout(() => el.classList.remove('snapping'), 180);

                Object.assign(doc, patch);
                const currentToken = knownTokens.find(token => String(token.id) === String(doc.id));
                upsertKnownToken({ ...(currentToken || doc), ...patch });
                try {
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
            el.addEventListener('pointerup', finishDrag);
            el.addEventListener('pointercancel', finishDrag);
            el.addEventListener('lostpointercapture', finishDrag);
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
            const initialPosition = snapTokenPosition(420, 420);
            const payload = {
                session_id: sessionId,
                name: token.name || 'Token',
                img: token.img || '',
                color: token.color || '#c77dff',
                x: initialPosition.x,
                y: initialPosition.y,
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
        zoomIn: () => zoomBy(1.15),
        zoomOut: () => zoomBy(0.85),
        resetView: () => {
            scale = 1;
            translateX = 0;
            translateY = 0;
            updateTransform();
        },
        toggleDayNight: () => setTimeOfDay(timeOfDay === 'day' ? 'night' : 'day'),
        toggleGrid: () => {
            return setGridVisible(!gridVisible);
        },
        setTimeOfDay,
        setWeather,
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
