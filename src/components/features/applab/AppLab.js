import { supabase, isSupabaseConfigured } from '../../../services/supabase.js';
import { navigateTo } from '../../../services/appNavigation.js';
import { updateSidebarContext } from '../../layout/Sidebar.js';
import { createAppLabLibrary, appLabErrorMessage, MAX_SOURCE_BYTES } from './appLabLibrary.js';
import { analyzeApk, APK_ACCEPT, formatBytes } from './apk.js';
import { assessPorting, assessSourcePorting, inspectSourceArchive } from './porting.js';
import { openAppSession } from './AppLabPlayer.js';
import { runtimeStatus } from './appLabRunner.js';
import './applab.css';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

const TABS = {
    mine: ['LE MIE APP', 'Le applicazioni caricate nel tuo spazio privato.'],
    online: ['APP ONLINE', 'App pronte per l’esecuzione nel browser tramite runtime Android remoto.'],
    porting: ['PORTING iOS', 'Valutazioni di fattibilità e progetti di migrazione verso iOS.']
};

const COMPATIBILITY = {
    ready: { label: 'ONLINE · PRONTA', tone: 'ok' },
    limited: { label: 'ONLINE · CON LIMITI', tone: 'warn' },
    blocked: { label: 'NON AVVIABILE', tone: 'bad' },
    pending: { label: 'IN ANALISI', tone: 'idle' }
};

const STATUS = {
    ready: 'Pronta',
    analyzing: 'In analisi',
    failed: 'Analisi non riuscita',
    archived: 'Archiviata'
};

const feasibilityLabel = value => ({
    high: 'Alta', medium: 'Media', low: 'Bassa', very_low: 'Molto bassa', unknown: 'Da valutare'
}[value] || 'Da valutare');

const dateLabel = value => value
    ? new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const timeLabel = value => value
    ? new Date(value).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : '';

const searchHaystack = app => [
    app.name, app.package_name, app.version_name,
    ...(app.analysis?.frameworks || []), ...(app.architectures || [])
].filter(Boolean).join(' ').toLowerCase();

function sortApps(list, sort) {
    const items = [...list];
    if (sort === 'name') return items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it'));
    if (sort === 'size') return items.sort((a, b) => (b.size_bytes || 0) - (a.size_bytes || 0));
    if (sort === 'package') return items.sort((a, b) => (a.package_name || '').localeCompare(b.package_name || '', 'it'));
    return items.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
}

export async function showAppLab(container) {
    window.__appLabCleanup?.();
    updateSidebarContext('applab');

    const library = createAppLabLibrary(supabase, {});
    const root = document.createElement('main');
    root.className = 'entry-page applab-page';
    container.replaceChildren(root);

    let alive = true;
    const aliveHere = () => alive && root.isConnected;
    let user = null;
    let apps = [];
    let sessions = [];
    let projects = [];
    let tab = 'mine';
    let search = '';
    let sort = 'recent';
    let filter = 'all';
    let runtime = { configured: false };
    let loading = true;
    const dialogs = new Set();

    root.innerHTML = `
        <header class="applab-header">
            <button type="button" class="applab-back" data-home>← LA TAVERNA</button>
            <div class="applab-hero">
                <div class="applab-hero-copy">
                    <span class="applab-eyebrow">IL BANCO DELLE MACCHINE</span>
                    <h1>APP <span>LAB</span></h1>
                    <p class="applab-lead">Carica un APK, leggine struttura e permessi, avvialo in un ambiente Android remoto.
                       Da iPhone o iPad, senza installare nulla.</p>
                    <div class="applab-hero-actions">
                        <button type="button" class="applab-primary" data-upload>+ CARICA APK</button>
                    </div>
                </div>
                <aside class="applab-aside" aria-label="Stato del runtime e numeri della libreria">
                    <section class="applab-runtime" data-runtime aria-live="polite">
                        <span class="applab-runtime-dot" aria-hidden="true"></span>
                        <div>
                            <strong data-runtime-title>Verifico il runtime Android…</strong>
                            <p data-runtime-text>Controllo se il gateway di esecuzione remota è collegato.</p>
                        </div>
                    </section>
                    <dl class="applab-figures">
                        <div><dt>App</dt><dd><span data-stat-apps>—</span><small>in libreria</small></dd></div>
                        <div><dt>Online</dt><dd><span data-stat-online>—</span><small>avviabili</small></dd></div>
                        <div><dt>Progetti</dt><dd><span data-stat-projects>—</span><small>porting iOS</small></dd></div>
                    </dl>
                </aside>
            </div>
        </header>

        <nav class="applab-tabs" role="tablist" aria-label="Sezioni APP LAB">
            <button type="button" role="tab" data-tab="mine" aria-selected="true">LE MIE APP</button>
            <button type="button" role="tab" data-tab="online" aria-selected="false">APP ONLINE</button>
            <button type="button" role="tab" data-tab="porting" aria-selected="false">PORTING iOS</button>
        </nav>

        <section class="applab-shell">
            <div class="applab-shell-heading">
                <div><h2 data-tab-title>${TABS.mine[0]}</h2><p data-tab-text>${TABS.mine[1]}</p></div>
                <span class="applab-counter" data-counter></span>
            </div>

            <div class="applab-toolbar" data-toolbar>
                <label class="applab-field">
                    <span>CERCA</span>
                    <span class="applab-inputbox">
                        <span aria-hidden="true">⌕</span>
                        <input type="search" data-search maxlength="120" autocomplete="off"
                            placeholder="Nome o package…" aria-label="Cerca applicazione">
                    </span>
                </label>
                <label class="applab-field">
                    <span>FILTRO</span>
                    <select data-filter aria-label="Filtra applicazioni">
                        <option value="all">Tutte</option>
                        <option value="ready">Pronta online</option>
                        <option value="limited">Con limiti</option>
                        <option value="blocked">Non avviabile</option>
                        <option value="flutter">Flutter</option>
                        <option value="react-native">React Native</option>
                        <option value="unity">Unity</option>
                        <option value="native-android">Android nativo</option>
                    </select>
                </label>
                <label class="applab-field">
                    <span>ORDINA</span>
                    <select data-sort aria-label="Ordina applicazioni">
                        <option value="recent">Più recenti</option>
                        <option value="name">Nome A–Z</option>
                        <option value="package">Package</option>
                        <option value="size">Dimensione</option>
                    </select>
                </label>
            </div>

            <p class="applab-feedback" data-feedback role="status" aria-live="polite" hidden></p>
            <div class="applab-grid" data-grid aria-live="polite" aria-busy="true">
                <p class="applab-empty">Apro la libreria…</p>
            </div>
        </section>

        <footer class="applab-footer">
            <p>Gli APK restano in uno storage privato e non vengono mai eseguiti sul server di La Taverna.
               Le applicazioni devono essere tue o modificate con autorizzazione del titolare dei diritti.</p>
            <p>Su iPhone e iPad Safari non consente il fullscreen di un elemento: APP LAB usa la migliore modalità immersiva disponibile.</p>
        </footer>
    `;

    const find = selector => root.querySelector(selector);
    const grid = find('[data-grid]');
    const feedbackBox = find('[data-feedback]');

    const feedback = (message = '', error = false) => {
        if (!aliveHere()) return;
        feedbackBox.textContent = message;
        feedbackBox.hidden = !message;
        feedbackBox.classList.toggle('is-error', error);
    };

    function dialog(title, content, { className = '', onClose = () => {} } = {}) {
        const element = document.createElement('dialog');
        element.className = `applab-dialog ${className}`;
        const titleId = `applab-dialog-${dialogs.size}`;
        element.innerHTML = `
            <div class="applab-dialog-top">
                <h2 id="${titleId}" tabindex="-1">${escapeHTML(title)}</h2>
                <button type="button" class="applab-dialog-close" aria-label="Chiudi">×</button>
            </div>
            <div class="applab-dialog-body">${content}</div>
            <p class="applab-dialog-error" role="alert" hidden></p>
        `;
        element.setAttribute('aria-labelledby', titleId);
        root.append(element);
        dialogs.add(element);
        element.querySelector('.applab-dialog-close').onclick = () => element.close();
        element.addEventListener('close', () => {
            dialogs.delete(element);
            element.remove();
            onClose();
        }, { once: true });
        element.showModal();
        return {
            element,
            body: element.querySelector('.applab-dialog-body'),
            error(message = '') {
                const box = element.querySelector('.applab-dialog-error');
                box.textContent = message;
                box.hidden = !message;
            },
            close: () => element.close(),
            busy(flag) {
                element.querySelectorAll('button, input').forEach(control => { control.disabled = flag; });
            }
        };
    }

    /* ---------------------------- caricamento ---------------------------- */

    async function loadAll() {
        loading = true;
        try {
            const current = await library.getUser();
            user = current;
            if (current) {
                [apps, sessions, projects] = await Promise.all([
                    library.listApps(current.id),
                    library.listSessions(current.id),
                    library.listPortingProjects(current.id)
                ]);
            } else {
                apps = [];
                sessions = [];
                projects = [];
            }
        } catch (error) {
            feedback(appLabErrorMessage(error), true);
            apps = [];
        } finally {
            loading = false;
            render();
        }
    }

    async function refresh() {
        try {
            if (!user) return;
            [apps, sessions, projects] = await Promise.all([
                library.listApps(user.id),
                library.listSessions(user.id),
                library.listPortingProjects(user.id)
            ]);
            render();
        } catch (error) {
            feedback(appLabErrorMessage(error), true);
        }
    }

    const checkRuntime = async () => {
        runtime = await runtimeStatus();
        if (!aliveHere()) return;
        const box = find('[data-runtime]');
        box.dataset.state = runtime.configured ? 'ok' : 'idle';
        find('[data-runtime-title]').textContent = runtime.configured
            ? 'Runtime Android collegato'
            : 'Runtime Android non collegato';
        find('[data-runtime-text]').textContent = runtime.configured
            ? `Le sessioni vengono eseguite su un host isolato. Durata massima per sessione: ${runtime.maxMinutes || runtime.sessionMinutes || 20} minuti.`
            : 'La libreria, l’analisi APK e il porting funzionano già. Per AVVIA occorre collegare un host Android remoto con gateway WebRTC (vedi docs/app-lab.md).';
    };

    /* ---------------------------- rendering ---------------------------- */

    const visibleApps = () => {
        const term = search.trim().toLowerCase();
        let list = apps.filter(app => {
            if (tab === 'online' && !['ready', 'limited'].includes(app.compatibility)) return false;
            if (filter !== 'all') {
                if (['ready', 'limited', 'blocked'].includes(filter) && app.compatibility !== filter) return false;
                if (['flutter', 'react-native', 'unity', 'native-android'].includes(filter)
                    && !(app.analysis?.frameworks || []).includes(filter)) return false;
            }
            if (term && !searchHaystack(app).includes(term)) return false;
            return true;
        });
        return sortApps(list, sort);
    };

    const cardMarkup = app => {
        const compatibility = COMPATIBILITY[app.compatibility] || COMPATIBILITY.pending;
        const frameworks = (app.analysis?.frameworks || []).map(name => ({
            flutter: 'FLUTTER', 'react-native': 'REACT NATIVE', unity: 'UNITY',
            capacitor: 'CAPACITOR', cordova: 'CORDOVA', 'native-android': 'NATIVO'
        }[name] || name.toUpperCase())).slice(0, 2);
        return `
            <article class="applab-card" data-id="${escapeHTML(app.id)}">
                <div class="applab-card-head">
                    <div class="applab-icon">
                        ${app.icon_data_url
                            ? `<img src="${escapeHTML(app.icon_data_url)}" alt="" aria-hidden="true" loading="lazy">`
                            : `<span aria-hidden="true">${escapeHTML((app.name || 'A').slice(0, 1).toUpperCase())}</span>`}
                    </div>
                    <button type="button" class="applab-card-menu-button" data-menu aria-label="Azioni per ${escapeHTML(app.name)}"
                        aria-expanded="false">⋯</button>
                </div>
                <div class="applab-card-body">
                    <h3 title="${escapeHTML(app.name)}">${escapeHTML(app.name)}</h3>
                    <p class="applab-card-meta">${escapeHTML(app.version_name || 'versione —')} · ${formatBytes(app.size_bytes)}</p>
                    <p class="applab-card-package" title="${escapeHTML(app.package_name)}">${escapeHTML(app.package_name)}</p>
                    <div class="applab-badges">
                        <span class="applab-badge">ANDROID</span>
                        ${frameworks.map(name => `<span class="applab-badge">${escapeHTML(name)}</span>`).join('')}
                        <span class="applab-badge applab-badge--${compatibility.tone}">${compatibility.label}</span>
                    </div>
                    <p class="applab-card-status">${escapeHTML(STATUS[app.status] || app.status)}${app.last_launched_at ? ` · avviata ${dateLabel(app.last_launched_at)}` : ''}</p>
                </div>
                <div class="applab-card-actions">
                    <button type="button" class="applab-launch" data-launch>AVVIA</button>
                    <button type="button" class="applab-secondary" data-details>DETTAGLI</button>
                </div>
                <div class="applab-card-menu" data-card-menu hidden>
                    <button type="button" data-rename>Rinomina</button>
                    <button type="button" data-replace>Sostituisci APK</button>
                    <button type="button" data-porting>Porting iOS</button>
                    <button type="button" data-delete class="is-danger">Elimina</button>
                </div>
            </article>
        `;
    };

    const projectMarkup = project => {
        const app = apps.find(item => item.id === project.app_id);
        const feasibility = feasibilityLabel(project.feasibility);
        return `
            <article class="applab-porting-card" data-project="${escapeHTML(project.id)}">
                <div class="applab-porting-head">
                    <span class="applab-badge">${escapeHTML(project.mode === 'source' ? 'SORGENTI' : 'SOLO APK')}</span>
                    <span class="applab-badge applab-badge--${project.feasibility === 'high' ? 'ok' : project.feasibility === 'medium' ? 'warn' : 'bad'}">iOS · ${escapeHTML(feasibility)}</span>
                </div>
                <h3>${escapeHTML(app?.name || 'Applicazione rimossa')}</h3>
                <p>${escapeHTML(project.framework || 'framework da riconoscere')} · ${dateLabel(project.created_at)}</p>
                <p class="applab-porting-status">${escapeHTML({
                    analysis: 'Analisi salvata',
                    source_uploaded: 'Sorgenti caricati',
                    queued: 'In coda di build',
                    building: 'Build in corso',
                    build_failed: 'Build non riuscita',
                    ipa_ready: 'IPA pronto',
                    not_feasible: 'Non convertibile'
                }[project.status] || project.status)}</p>
                <div class="applab-card-actions">
                    <button type="button" class="applab-secondary" data-project-report>REPORT</button>
                    ${project.status === 'ipa_ready' && project.ipa_path
                        ? '<button type="button" class="applab-launch" data-project-download>SCARICA IPA</button>'
                        : '<button type="button" class="applab-launch" data-project-build>AVVIA BUILD</button>'}
                    <button type="button" class="applab-secondary is-danger" data-project-delete>ELIMINA</button>
                </div>
            </article>
        `;
    };

    function render() {
        if (!aliveHere()) return;
        root.querySelectorAll('[data-tab]').forEach(button => {
            const active = button.dataset.tab === tab;
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        });
        find('[data-tab-title]').textContent = TABS[tab][0];
        find('[data-tab-text]').textContent = TABS[tab][1];
        find('[data-toolbar]').hidden = tab === 'porting';
        find('[data-upload]').disabled = !user;
        grid.setAttribute('aria-busy', String(loading));
        const onlineCount = apps.filter(app => ['ready', 'limited'].includes(app.compatibility)).length;
        find('[data-stat-apps]').textContent = user ? String(apps.length) : '—';
        find('[data-stat-online]').textContent = user ? String(onlineCount) : '—';
        find('[data-stat-projects]').textContent = user ? String(projects.length) : '—';

        if (!isSupabaseConfigured) {
            grid.innerHTML = emptyMarkup('APP LAB non è attivo su questo ambiente', 'Manca la configurazione Supabase. Applica la migrazione app_lab e riavvia l’app.', false);
            find('[data-counter]').textContent = '';
            return;
        }
        if (!user) {
            grid.innerHTML = emptyMarkup('Serve il tuo account', 'Accedi alla Taverna per caricare APK e salvarli nella tua libreria personale.', false);
            find('[data-counter]').textContent = '';
            return;
        }
        if (loading) {
            grid.innerHTML = '<p class="applab-empty">Apro la libreria…</p>';
            return;
        }

        if (tab === 'porting') {
            find('[data-counter]').textContent = `${projects.length} progetti`;
            grid.innerHTML = projects.length
                ? projects.map(projectMarkup).join('')
                : emptyMarkup('Nessun progetto di porting', 'Apri il menu di un’app e scegli “Porting iOS” per una valutazione di fattibilità. Un APK da solo non produce un .ipa: servono codice sorgente, Xcode e firma Apple.', false);
            return;
        }

        const list = visibleApps();
        find('[data-counter]').textContent = `${list.length} ${list.length === 1 ? 'app' : 'app'}`;
        if (!apps.length) {
            grid.innerHTML = emptyMarkup(
                'La tua libreria è vuota',
                'Trascina qui un APK o usa “Carica APK”. L’analisi avviene nel browser e il file resta privato.',
                true
            );
            return;
        }
        if (!list.length) {
            grid.innerHTML = emptyMarkup('Nessun risultato', 'Nessuna app corrisponde ai filtri attuali.', false);
            return;
        }
        grid.innerHTML = list.map(cardMarkup).join('');
    }

    const emptyMarkup = (title, text, upload) => `
        <div class="applab-empty-card">
            <span class="applab-empty-glyph" aria-hidden="true">▤</span>
            <h3>${escapeHTML(title)}</h3>
            <p>${escapeHTML(text)}</p>
            ${upload ? '<button type="button" class="applab-primary" data-upload-inline>+ CARICA APK</button>' : ''}
        </div>
    `;

    /* ---------------------------- dettagli ---------------------------- */

    const permissionMarkup = app => {
        const permissions = app.analysis?.permissions || [];
        if (!permissions.length) return '<p class="applab-muted">Nessun permesso dichiarato.</p>';
        return `<ul class="applab-permissions">${permissions.map(permission => `
            <li data-severity="${escapeHTML(permission.severity)}">
                <span>${escapeHTML(permission.label)}</span>
                <code>${escapeHTML(permission.name.replace('android.permission.', ''))}</code>
            </li>`).join('')}</ul>`;
    };

    const nativeMarkup = app => {
        const libraries = app.analysis?.nativeLibraries || {};
        const abis = Object.keys(libraries);
        if (!abis.length) return '<p class="applab-muted">Nessuna libreria nativa: l’app gira sulla VM Android.</p>';
        return `<ul class="applab-arch">${abis.map(abi => `
            <li><strong>${escapeHTML(abi)}</strong><span>${libraries[abi].length} librerie .so</span></li>`).join('')}</ul>`;
    };

    const detailsContent = app => {
        const analysis = app.analysis || {};
        return `
            <div class="applab-detail-hero">
                <div class="applab-icon applab-icon--large">
                    ${app.icon_data_url
                        ? `<img src="${escapeHTML(app.icon_data_url)}" alt="" aria-hidden="true">`
                        : `<span aria-hidden="true">${escapeHTML((app.name || 'A').slice(0, 1).toUpperCase())}</span>`}
                </div>
                <div>
                    <p class="applab-detail-package">${escapeHTML(app.package_name)}</p>
                    <p class="applab-detail-meta">${escapeHTML(app.version_name || 'versione sconosciuta')} · codice ${escapeHTML(String(app.version_code ?? '—'))} · ${formatBytes(app.size_bytes)}</p>
                </div>
            </div>
            <dl class="applab-facts">
                <div><dt>File originale</dt><dd>${escapeHTML(app.original_name)}</dd></div>
                <div><dt>Android minimo</dt><dd>API ${escapeHTML(String(app.min_sdk ?? '—'))}${app.target_sdk ? ` · target ${escapeHTML(String(app.target_sdk))}` : ''}</dd></div>
                <div><dt>Framework</dt><dd>${escapeHTML((analysis.frameworks || []).join(', ') || 'n/d')}</dd></div>
                <div><dt>Activity di avvio</dt><dd class="applab-ellipsis">${escapeHTML(analysis.topActivity || '—')}</dd></div>
                <div><dt>Firma APK</dt><dd>${analysis.signatures?.v2OrNewer ? 'v2 o successiva' : analysis.signatures?.v1 ? 'solo v1' : 'non rilevata'}</dd></div>
                <div><dt>DEX</dt><dd>${escapeHTML(String(analysis.dexFiles ?? 0))} file</dd></div>
            </dl>
            <h3 class="applab-detail-title">Compatibilità all’esecuzione remota</h3>
            <p class="applab-muted">${escapeHTML((analysis.compatibility?.notes || []).join(' ') || 'Nessuna nota tecnica.')}</p>
            ${(analysis.compatibility?.reasons || []).length
                ? `<ul class="applab-warnings">${analysis.compatibility.reasons.map(reason => `<li>${escapeHTML(reason)}</li>`).join('')}</ul>`
                : ''}
            <h3 class="applab-detail-title">Permessi richiesti (${(analysis.permissions || []).length})</h3>
            ${permissionMarkup(app)}
            <h3 class="applab-detail-title">Librerie native</h3>
            ${nativeMarkup(app)}
            <div class="applab-detail-actions">
                <button type="button" class="applab-primary" data-detail-launch>AVVIA</button>
                <button type="button" class="applab-secondary" data-detail-porting>PORTING iOS</button>
            </div>
        `;
    };

    function openDetails(app, trigger) {
        const modal = dialog(app.name || 'Dettagli applicazione', detailsContent(app), { className: 'applab-dialog--wide' });
        modal.body.querySelector('[data-detail-launch]').onclick = () => { modal.close(); launch(app); };
        modal.body.querySelector('[data-detail-porting]').onclick = () => { modal.close(); openPorting(app); };
        trigger?.focus?.();
    }

    /* ---------------------------- avvio ---------------------------- */

    function launch(app) {
        if (!user) {
            feedback('Accedi per avviare un’app.', true);
            return;
        }
        if (app.compatibility === 'blocked') {
            feedback('Questa app non può essere avviata: apri DETTAGLI per il motivo tecnico.', true);
            return;
        }
        openAppSession({
            app,
            onLaunched: () => {
                void library.rememberLaunch({ id: app.id, userId: user.id }).catch(() => {});
            },
            onClose: () => {
                void refresh();
            }
        });
    }

    /* ---------------------------- upload ---------------------------- */

    const stageLabel = (stage, percent, label) => `
        <div class="applab-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
            <div class="applab-progress-track"><span style="width:${percent}%"></span></div>
            <p><span data-stage-label>${escapeHTML(label)}</span><strong data-stage-percent>${percent}%</strong></p>
        </div>
    `;

    const uploadDialog = replaceOf => {
        const modal = dialog(replaceOf ? 'Sostituisci APK' : 'Carica un APK', `
            <label class="applab-dropzone" data-dropzone>
                <input type="file" accept="${APK_ACCEPT}" data-file>
                <span class="applab-dropzone-icon" aria-hidden="true">⇪</span>
                <strong>Trascina qui l’APK oppure tocca per sceglierlo</strong>
                <span>Max 200 MB · l’analisi avviene nel browser, prima del caricamento</span>
            </label>
            <div data-stage></div>
            <div data-preview hidden></div>
            <label class="applab-consent" data-consent hidden>
                <input type="checkbox" data-rights>
                <span>Confermo di avere i diritti necessari per caricare, analizzare ed eseguire questa applicazione
                    (software mio, open source o modificato con autorizzazione del titolare).</span>
            </label>
            <div class="applab-dialog-actions">
                <button type="button" class="applab-secondary" data-cancel>ANNULLA</button>
                <button type="button" class="applab-primary" data-save disabled>${replaceOf ? 'SOSTITUISCI' : 'SALVA NELLA LIBRERIA'}</button>
            </div>
        `, { className: 'applab-dialog--wide' });

        const fileInput = modal.body.querySelector('[data-file]');
        const dropzone = modal.body.querySelector('[data-dropzone]');
        const stage = modal.body.querySelector('[data-stage]');
        const preview = modal.body.querySelector('[data-preview]');
        const consent = modal.body.querySelector('[data-consent]');
        const rights = modal.body.querySelector('[data-rights]');
        const saveButton = modal.body.querySelector('[data-save]');
        let selected = null;
        let analyzed = null;
        let busy = false;

        const setProgress = (percent, label) => {
            stage.innerHTML = stageLabel('upload', percent, label);
        };

        const runAnalysis = async file => {
            if (busy) return;
            busy = true;
            selected = file;
            analyzed = null;
            saveButton.disabled = true;
            preview.hidden = true;
            consent.hidden = true;
            modal.error('');
            stage.innerHTML = stageLabel('analysis', 0, 'Avvio l’analisi…');
            try {
                const result = await analyzeApk(file, {
                    onProgress: ({ percent, label }) => setProgress(percent, label)
                });
                analyzed = result;
                const compatibility = COMPATIBILITY[result.compatibility] || COMPATIBILITY.pending;
                preview.innerHTML = `
                    <div class="applab-preview">
                        <div class="applab-icon applab-icon--large">
                            ${result.iconDataUrl ? `<img src="${escapeHTML(result.iconDataUrl)}" alt="" aria-hidden="true">` : '<span aria-hidden="true">▤</span>'}
                        </div>
                        <div>
                            <h3>${escapeHTML(result.name)}</h3>
                            <p>${escapeHTML(result.packageName)}</p>
                            <p>${escapeHTML(result.versionName || 'versione —')} · ${formatBytes(result.sizeBytes)} · API ${escapeHTML(String(result.minSdk ?? '—'))}</p>
                            <div class="applab-badges">
                                <span class="applab-badge applab-badge--${compatibility.tone}">${compatibility.label}</span>
                                ${result.architectures.map(abi => `<span class="applab-badge">${escapeHTML(abi)}</span>`).join('')}
                                ${result.frameworks.map(name => `<span class="applab-badge">${escapeHTML(name)}</span>`).join('')}
                            </div>
                            ${result.compatibilityReasons.length
                                ? `<ul class="applab-warnings">${result.compatibilityReasons.map(reason => `<li>${escapeHTML(reason)}</li>`).join('')}</ul>`
                                : ''}
                        </div>
                    </div>
                `;
                preview.hidden = false;
                consent.hidden = false;
                stage.innerHTML = '';
                saveButton.disabled = !rights.checked;
            } catch (error) {
                stage.innerHTML = '';
                modal.error(error.message || 'Analisi non riuscita.');
            } finally {
                busy = false;
            }
        };

        const readFile = files => {
            const file = files?.[0];
            if (file) void runAnalysis(file);
        };

        fileInput.addEventListener('change', () => readFile(fileInput.files));
        ['dragenter', 'dragover'].forEach(eventName => dropzone.addEventListener(eventName, event => {
            event.preventDefault();
            dropzone.classList.add('is-dragging');
        }));
        ['dragleave', 'drop'].forEach(eventName => dropzone.addEventListener(eventName, event => {
            event.preventDefault();
            dropzone.classList.remove('is-dragging');
        }));
        dropzone.addEventListener('drop', event => readFile(event.dataTransfer?.files));
        rights.addEventListener('change', () => { saveButton.disabled = !rights.checked || !analyzed || busy; });
        modal.body.querySelector('[data-cancel]').onclick = () => modal.close();

        saveButton.onclick = async () => {
            if (!analyzed || !selected || !rights.checked || busy) return;
            busy = true;
            saveButton.disabled = true;
            stage.innerHTML = stageLabel('upload', 0, 'Carico l’APK…');
            try {
                if (replaceOf) {
                    await library.replaceApk({
                        app: replaceOf, file: selected, analysis: analyzed, userId: user.id,
                        onProgress: ({ percent, label }) => setProgress(percent, label)
                    });
                } else {
                    await library.createApp({
                        file: selected, analysis: analyzed, userId: user.id,
                        onProgress: ({ percent, label }) => setProgress(percent, label)
                    });
                }
                modal.close();
                await refresh();
                feedback(replaceOf ? 'APK sostituito e rianalizzato.' : 'Applicazione salvata nella tua libreria.');
            } catch (error) {
                modal.error(appLabErrorMessage(error));
                stage.innerHTML = '';
                saveButton.disabled = false;
            } finally {
                busy = false;
            }
        };
    };

    /* ---------------------------- rinomina / elimina ---------------------------- */

    const renameDialog = app => {
        const modal = dialog('Rinomina applicazione', `
            <form class="applab-form" data-rename-form>
                <label>Nome visibile
                    <input type="text" maxlength="120" required value="${escapeHTML(app.name)}" data-rename-input>
                </label>
                <p class="applab-muted">Il package name non cambia: serve all’ambiente Android per installare l’app.</p>
                <div class="applab-dialog-actions">
                    <button type="button" class="applab-secondary" data-cancel>ANNULLA</button>
                    <button type="submit" class="applab-primary">SALVA</button>
                </div>
            </form>
        `, { className: '' });
        modal.body.querySelector('[data-cancel]').onclick = () => modal.close();
        modal.body.querySelector('[data-rename-form]').onsubmit = async event => {
            event.preventDefault();
            const field = modal.body.querySelector('[data-rename-input]');
            try {
                await library.renameApp({ id: app.id, name: field.value, userId: user.id });
                modal.close();
                await refresh();
                feedback('Nome aggiornato.');
            } catch (error) {
                modal.error(appLabErrorMessage(error));
            }
        };
    };

    const deleteDialog = app => {
        const modal = dialog('Eliminare l’applicazione?', `
            <p><strong>${escapeHTML(app.name)}</strong> (${escapeHTML(app.package_name)}) verrà rimossa dalla tua libreria
               insieme al file APK nello storage privato. L’operazione non è reversibile.</p>
            <div class="applab-dialog-actions">
                <button type="button" class="applab-secondary" data-cancel>ANNULLA</button>
                <button type="button" class="applab-primary is-danger" data-confirm>ELIMINA</button>
            </div>
        `);
        modal.body.querySelector('[data-cancel]').onclick = () => modal.close();
        modal.body.querySelector('[data-confirm]').onclick = async () => {
            try {
                await library.deleteApp({ id: app.id, userId: user.id });
                modal.close();
                await refresh();
                feedback('Applicazione eliminata.');
            } catch (error) {
                modal.error(appLabErrorMessage(error));
            }
        };
    };

    /* ---------------------------- porting iOS ---------------------------- */

    const reportMarkup = report => `
        <div class="applab-report">
            <div class="applab-report-head">
                <div>
                    <p class="applab-muted">Framework rilevato</p>
                    <h3>${escapeHTML(report.frameworkLabel || 'Non riconosciuto')}</h3>
                </div>
                <div class="applab-score" data-level="${escapeHTML(report.feasibility)}">
                    <strong>${report.score}</strong><span>/100</span>
                    <small>FATTIBILITÀ ${escapeHTML(feasibilityLabel(report.feasibility).toUpperCase())}</small>
                </div>
            </div>
            ${report.mode === 'source' && report.evidence?.length
                ? `<h4>Elementi riconosciuti</h4><ul>${report.evidence.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>`
                : ''}
            <h4>Riutilizzabile</h4>
            <ul>${(report.reusable || []).map(item => `<li>${escapeHTML(item)}</li>`).join('') || '<li>Nessun elemento riutilizzabile con certezza.</li>'}</ul>
            <h4>Da riscrivere o adattare</h4>
            <ul>${(report.rewrite || []).map(item => `<li>${escapeHTML(item)}</li>`).join('') || '<li>—</li>'}</ul>
            <h4>Blocchi e limiti</h4>
            <ul class="applab-warnings">${(report.blockers || []).map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
            <h4>Requisiti Apple</h4>
            <ul>${(report.requirements || []).map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
            <h4>Stima</h4>
            <p>${escapeHTML(report.estimate || 'Da definire dopo la revisione del progetto.')}</p>
            <p class="applab-report-note">${report.convertible
                ? 'La compilazione richiede un servizio di build macOS con Xcode: finché non viene eseguita con successo non esiste alcun file .ipa.'
                : 'Nessun file .ipa può essere generato da questa analisi. L’esecuzione online Android resta disponibile come alternativa.'}</p>
        </div>
    `;

    const buildRequest = async projectId => {
        const response = await fetch('/api/applab/porting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action: 'build', projectId })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            const missing = payload?.missing?.length ? ` Mancano: ${payload.missing.join(', ')}.` : '';
            throw new Error(`${payload?.error || 'Build non avviata.'}${missing}`);
        }
        return payload;
    };

    const openPorting = app => {
        const report = assessPorting(app);
        const modal = dialog(`Porting iOS · ${app.name}`, `
            ${reportMarkup(report)}
            <div class="applab-dialog-actions applab-dialog-actions--stack">
                <button type="button" class="applab-primary" data-save-report>SALVA ANALISI</button>
                <button type="button" class="applab-secondary" data-source>CARICA PROGETTO SORGENTE (.ZIP)</button>
                <button type="button" class="applab-secondary" data-run-online>ESEGUI ONLINE (ANDROID)</button>
            </div>
            <input type="file" accept=".zip,application/zip" data-source-file hidden>
            <div data-source-stage></div>
        `, { className: 'applab-dialog--wide' });

        const sourceStage = modal.body.querySelector('[data-source-stage]');
        const sourceInput = modal.body.querySelector('[data-source-file]');

        modal.body.querySelector('[data-save-report]').onclick = async () => {
            try {
                await library.savePortingProject({
                    appId: app.id, userId: user.id, mode: 'apk_only', report
                });
                modal.close();
                await refresh();
                tab = 'porting';
                render();
                feedback('Analisi di porting salvata. Ricorda: un APK da solo non produce un .ipa.');
            } catch (error) {
                modal.error(appLabErrorMessage(error));
            }
        };
        modal.body.querySelector('[data-run-online]').onclick = () => { modal.close(); launch(app); };
        modal.body.querySelector('[data-source]').onclick = () => sourceInput.click();
        sourceInput.onchange = async () => {
            const file = sourceInput.files?.[0];
            if (!file) return;
            if (file.size > MAX_SOURCE_BYTES) {
                modal.error('L’archivio supera il limite di 500 MB.');
                return;
            }
            modal.busy(true);
            sourceStage.innerHTML = '<p class="applab-muted">Leggo la struttura del progetto…</p>';
            try {
                const source = await inspectSourceArchive(file);
                const sourceReport = { ...assessSourcePorting(source), evidence: source.evidence };
                const project = await library.savePortingProject({
                    appId: app.id, userId: user.id, mode: 'source', report: sourceReport
                });
                const path = await library.uploadSourceArchive({
                    file, projectId: project.id, userId: user.id,
                    onProgress: ({ percent }) => {
                        sourceStage.innerHTML = stageLabel('source', percent, 'Carico il progetto sorgente…');
                    }
                });
                await library.updatePortingProject({
                    id: project.id, userId: user.id,
                    patch: { source_path: path, status: sourceReport.convertible ? 'source_uploaded' : 'not_feasible' }
                });
                modal.close();
                await refresh();
                tab = 'porting';
                render();
                feedback(`Progetto riconosciuto: ${source.frameworkLabel}. Build iOS disponibile solo con servizio macOS/Xcode configurato.`);
            } catch (error) {
                sourceStage.innerHTML = '';
                modal.error(appLabErrorMessage(error));
            } finally {
                modal.busy(false);
            }
        };
    };

    const projectReportDialog = project => {
        const report = project.report || {};
        const app = apps.find(item => item.id === project.app_id);
        const modal = dialog(`Report porting · ${app?.name || 'applicazione'}`, `
            ${reportMarkup({ ...report, frameworkLabel: report.frameworkLabel || project.framework })}
        `, { className: 'applab-dialog--wide' });
        if (project.status !== 'ipa_ready') return;
        const note = document.createElement('p');
        note.className = 'applab-muted';
        note.textContent = 'Il file .ipa è stato prodotto da una build firmata: puoi scaricarlo per installarlo tramite i canali Apple autorizzati.';
        modal.body.append(note);
    };

    /* ---------------------------- eventi ---------------------------- */

    root.addEventListener('click', async event => {
        const target = event.target.closest('button, [data-home]');
        if (!target) {
            root.querySelectorAll('[data-card-menu]').forEach(menu => { menu.hidden = true; });
            return;
        }
        if (target.matches('[data-home]')) {
            void navigateTo('home', container);
            return;
        }
        if (target.matches('[data-upload], [data-upload-inline]')) {
            if (!user) {
                feedback('Accedi alla Taverna per caricare un APK.', true);
                return;
            }
            uploadDialog(null);
            return;
        }
        if (target.matches('[data-tab]')) {
            tab = target.dataset.tab;
            search = '';
            find('[data-search]').value = '';
            render();
            return;
        }
        const card = target.closest('.applab-card');
        if (card) {
            const app = apps.find(item => item.id === card.dataset.id);
            if (!app) return;
            if (target.matches('[data-menu]')) {
                const menu = card.querySelector('[data-card-menu]');
                const open = menu.hidden;
                root.querySelectorAll('[data-card-menu]').forEach(item => { item.hidden = true; });
                menu.hidden = !open;
                target.setAttribute('aria-expanded', String(open));
                return;
            }
            if (target.matches('[data-launch]')) { launch(app); return; }
            if (target.matches('[data-details]')) { openDetails(app, target); return; }
            if (target.matches('[data-rename]')) { renameDialog(app); return; }
            if (target.matches('[data-replace]')) { uploadDialog(app); return; }
            if (target.matches('[data-porting]')) { openPorting(app); return; }
            if (target.matches('[data-delete]')) { deleteDialog(app); return; }
        }
        const projectCard = target.closest('[data-project]');
        if (projectCard) {
            const project = projects.find(item => item.id === projectCard.dataset.project);
            if (!project) return;
            if (target.matches('[data-project-report]')) { projectReportDialog(project); return; }
            if (target.matches('[data-project-build]')) {
                try {
                    const result = await buildRequest(project.id);
                    feedback(result?.message || 'Build accodata. Il servizio Xcode aggiornerà lo stato del progetto.');
                    await refresh();
                } catch (error) {
                    feedback(error.message, true);
                }
                return;
            }
            if (target.matches('[data-project-download]')) {
                try {
                    const url = await library.createIpaLink(project.ipa_path);
                    if (url) window.open(url, '_blank', 'noopener');
                    else feedback('Il file IPA non è più disponibile.', true);
                } catch (error) {
                    feedback(appLabErrorMessage(error), true);
                }
                return;
            }
            if (target.matches('[data-project-delete]')) {
                try {
                    await library.deletePortingProject({ id: project.id, userId: user.id });
                    await refresh();
                    feedback('Progetto di porting eliminato.');
                } catch (error) {
                    feedback(appLabErrorMessage(error), true);
                }
            }
        }
    });

    root.addEventListener('input', event => {
        if (event.target.matches('[data-search]')) {
            search = event.target.value;
            render();
        }
    });
    root.addEventListener('change', event => {
        if (event.target.matches('[data-filter]')) { filter = event.target.value; render(); }
        if (event.target.matches('[data-sort]')) { sort = event.target.value; render(); }
    });

    const cleanup = () => {
        alive = false;
        dialogs.forEach(element => element.remove());
        dialogs.clear();
        window.__appLabCleanup = null;
    };
    window.__appLabCleanup = cleanup;

    render();
    await checkRuntime();
    void loadAll();
}
