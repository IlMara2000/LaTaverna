import { generateDungeon, dungeonSvg, dungeonNotes, escapeMarkup as escape } from './dungeonEngine.js';
import catalog from './donjonCatalog.json';

const STORAGE_KEY = 'taverna.dungeon-workshop.v1';
const download = (content, type, filename) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
async function mapPng(svg) {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
        const image = new Image(); image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        canvas.getContext('2d').drawImage(image, 0, 0);
        return canvas.toDataURL('image/png');
    } finally { URL.revokeObjectURL(url); }
}

export function renderDungeonWorkshop(root, { onBack, onPrepareSession } = {}) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { /* optional storage */ }
    const initial = { seed: String(Date.now()), rooms: 12, name: 'Il sotterraneo dimenticato', doors: 'mixed', corridors: 'horizontal', ...saved };
    root.innerHTML = `<section class="dnd-tool-view">
        <header class="dnd-tool-view-head"><button type="button" class="dnd-tool-back" data-back aria-label="Torna agli strumenti">←</button><div><small>Cartografia · generatore locale</small><h2>Officina dei dungeon</h2><p>Stanze collegate, porte, scale e appunti del Master. Lo stesso seed e le stesse opzioni ricreano la stessa mappa.</p></div></header>
        <div class="dnd-workshop-layout">
            <form class="dnd-workshop-controls">
                <label>Nome del dungeon<input name="name" maxlength="100" value="${escape(initial.name)}" required></label>
                <label>Seed<input name="seed" maxlength="100" value="${escape(initial.seed)}" required></label>
                <label>Stanze (5–36)<input name="rooms" type="number" min="5" max="36" value="${escape(initial.rooms)}" required></label>
                <label>Corridoi<select name="corridors"><option value="horizontal">Orizzontale prima</option><option value="vertical">Verticale prima</option></select></label>
                <label>Porte<select name="doors"><option value="mixed">Miste, segrete e trappole</option><option value="normal">Normali</option><option value="none">Passaggi aperti</option></select></label>
                <label><input type="checkbox" name="loops" ${initial.loops ? 'checked' : ''}> Percorsi alternativi</label>
                <label><input type="checkbox" name="stairs" ${initial.stairs === false ? '' : 'checked'}> Scale di ingresso e uscita</label>
                <button type="submit" class="primary">GENERA DUNGEON</button>
                <button type="button" data-random>NUOVO SEED E GENERA</button>
                <p>Contenuti narrativi originali della Taverna. Le trappole e gli incontri vanno adattati al gruppo.</p>
                <a href="https://donjon.bin.sh/5e/dungeon/" target="_blank" rel="noopener noreferrer">Generatore completo Donjon ↗</a>
            </form>
            <section class="dnd-workshop-result" aria-label="Dungeon generato">
                <div class="dnd-workshop-options"><label><input type="checkbox" data-player> Vista giocatori</label><label><input type="checkbox" data-grid checked> Griglia</label><label>Stile<select data-style><option value="parchment">Pergamena</option><option value="amethyst">Ametista</option></select></label></div>
                <div class="dnd-workshop-map" data-map></div>
                <p data-legend>Numeri: stanze · Bianco: porta · Rosso: porta speciale · Tre linee: scale</p>
                <div class="dnd-tool-actions"><button type="button" data-svg>SCARICA SVG</button><button type="button" data-png>SCARICA PNG</button><button type="button" data-json>ESPORTA DATI MASTER</button><button type="button" data-notes>SCARICA APPUNTI MASTER</button>${onPrepareSession ? '<button type="button" class="primary" data-prepare>PREPARA SESSIONE</button>' : ''}</div>
                <p role="status" data-status aria-live="polite"></p>
                <details data-room-notes><summary>Appunti riservati al Master</summary><div data-rooms></div></details>
            </section>
        </div>
    </section>`;
    root.querySelector('[data-back]').onclick = onBack;
    const form = root.querySelector('form');
    form.elements.corridors.value = initial.corridors === 'vertical' ? 'vertical' : 'horizontal';
    form.elements.doors.value = ['mixed', 'normal', 'none'].includes(initial.doors) ? initial.doors : 'mixed';
    let dungeon;
    const status = message => { root.querySelector('[data-status]').textContent = message; };
    const options = () => ({ player: root.querySelector('[data-player]').checked, grid: root.querySelector('[data-grid]').checked, style: root.querySelector('[data-style]').value });
    const svg = () => dungeonSvg(dungeon, options());
    const preview = () => {
        root.querySelector('[data-map]').innerHTML = svg();
        const player = options().player;
        root.querySelector('[data-room-notes]').hidden = player;
        root.querySelector('[data-json]').hidden = player;
        root.querySelector('[data-notes]').hidden = player;
        root.querySelector('[data-legend]').textContent = player ? 'Vista giocatori: numeri, porte segrete e appunti nascosti.' : 'Numeri: stanze · Bianco: porta · Rosso: porta speciale · Tre linee: scale';
    };
    const generate = () => {
        if (!form.reportValidity()) return;
        const settings = { ...Object.fromEntries(new FormData(form)), loops: form.elements.loops.checked, stairs: form.elements.stairs.checked };
        dungeon = generateDungeon(settings);
        root.querySelector('[data-rooms]').innerHTML = dungeon.rooms.map(r => `<article><h3>${r.id}. ${escape(r.name)}</h3><p>${escape(r.detail)}</p><p><strong>Segreto:</strong> ${escape(r.secret)}</p></article>`).join('');
        preview();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); status(`${dungeon.rooms.length} stanze generate. Configurazione salvata su questo dispositivo.`); }
        catch { status('Dungeon generato. Salvataggio locale non disponibile: esporta i dati per conservarlo.'); }
    };
    form.onsubmit = e => { e.preventDefault(); generate(); };
    root.querySelector('[data-random]').onclick = () => { form.elements.seed.value = crypto.randomUUID(); generate(); };
    root.querySelectorAll('[data-player], [data-grid], [data-style]').forEach(control => { control.onchange = preview; });
    root.querySelector('[data-svg]').onclick = () => download(svg(), 'image/svg+xml', `dungeon-${options().player ? 'giocatori' : 'master'}.svg`);
    root.querySelector('[data-json]').onclick = () => download(JSON.stringify(dungeon, null, 2), 'application/json', 'dungeon-master.json');
    root.querySelector('[data-notes]').onclick = () => download(dungeonNotes(dungeon), 'text/plain;charset=utf-8', 'dungeon-master.txt');
    root.querySelector('[data-png]').onclick = async () => {
        try { const link = document.createElement('a'); link.href = await mapPng(svg()); link.download = `dungeon-${options().player ? 'giocatori' : 'master'}.png`; link.click(); }
        catch { status('Impossibile esportare il PNG. Puoi scaricare la versione SVG.'); }
    };
    const prepare = root.querySelector('[data-prepare]');
    if (prepare) prepare.onclick = async () => {
        prepare.disabled = true;
        try {
            // Only the player map goes onto the shared tabletop.
            const map_url = await mapPng(dungeonSvg(dungeon, { ...options(), player: true }));
            await onPrepareSession({ name: dungeon.name, map_url, map_grid_size: 20, map_notes: dungeonNotes(dungeon) });
        } catch { status('Preparazione non riuscita. Il dungeon resta disponibile: riprova o esportalo.'); }
        finally { prepare.disabled = false; }
    };
    generate();
}

export function renderDonjonCatalog(root, { onBack, onOpenTool } = {}) {
    const groups = [...new Set(catalog.map(item => item.group))];
    root.innerHTML = `<section class="dnd-tool-view"><header class="dnd-tool-view-head"><button type="button" class="dnd-tool-back" data-back aria-label="Torna agli strumenti">←</button><div><small>Risorse esterne</small><h2>Donjon · strumenti per il Master</h2><p>Gli strumenti ufficiali si aprono in una nuova scheda. Per lavorare nella Taverna usa le funzioni locali qui sotto.</p></div></header>
        <div class="dnd-tool-actions">${[['dungeon','Dungeon locale'],['reference','Archivio regole'],['encounter','Incontri'],['loot','Bottino'],['initiative','Iniziativa']].map(([id,title]) => `<button type="button" data-local="${id}">${title}</button>`).join('')}</div>
        <div class="dnd-workshop-options"><label>Cerca strumento<input type="search" data-search placeholder="Dungeon, weather, town, spell…"></label><label>Sistema<select data-system><option value="all">Tutti i sistemi</option>${groups.map(group => `<option>${escape(group)}</option>`).join('')}</select></label></div>
        <p data-count role="status"></p><div class="dnd-donjon-catalog" data-list></div>
        <p>Catalogo verificato il 16 ottobre 2026. <a href="https://donjon.bin.sh/" target="_blank" rel="noopener noreferrer">Sito ufficiale Donjon ↗</a></p>
    </section>`;
    root.querySelector('[data-back]').onclick = onBack;
    root.querySelectorAll('[data-local]').forEach(button => { button.onclick = () => onOpenTool(button.dataset.local); });
    const filter = () => {
        const query = root.querySelector('[data-search]').value.trim().toLowerCase();
        const system = root.querySelector('[data-system]').value;
        const items = catalog.filter(item => (system === 'all' || item.group === system) && `${item.title} ${item.group}`.toLowerCase().includes(query));
        root.querySelector('[data-count]').textContent = items.length ? `${items.length} strumenti disponibili su Donjon` : 'Nessuno strumento trovato. Prova un altro nome o sistema.';
        root.querySelector('[data-list]').innerHTML = items.map(item => `<a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer"><small>${escape(item.group)}</small><strong>${escape(item.title)}</strong><span>Apri su Donjon ↗</span></a>`).join('');
    };
    root.querySelector('[data-search]').oninput = filter;
    root.querySelector('[data-system]').onchange = filter;
    root.querySelector('[data-system]').value = 'D&D 5e';
    filter();
}
