import { connectOnlineGame } from './onlineGameSession.js';
import { getRoomParticipants } from '../../services/minigameMultiplayer.js';

export function seededRandom(seed) {
    let value = seed >>> 0;
    return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}

export function challengeWinners(results) {
    if (!results.every(result => result?.finished)) return [];
    const sorted = results.map((result, seat) => ({result, seat})).sort((a,b) =>
        Number(b.result.won) - Number(a.result.won) || b.result.score - a.result.score || (a.result.moves || 0) - (b.result.moves || 0));
    return sorted.filter(({result}) => Number(result.won) === Number(sorted[0].result.won) && result.score === sorted[0].result.score && (result.moves || 0) === (sorted[0].result.moves || 0)).map(item => item.seat);
}

export function connectOnlineChallenge(container, control, {gameId, room, create, start, result, finish}) {
    const root = [...container.children].find(child => child.tagName !== 'STYLE');
    const panel = document.createElement('section');
    panel.className = 'online-challenge-panel';
    panel.style.cssText = 'position:relative;z-index:10;padding:10px 16px;background:#1c1129;color:white;border-radius:12px;font-size:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap';
    panel.innerHTML = '<span class="online-challenge-scores" aria-live="polite"></span><button type="button" class="game-btn-action" data-challenge-finish>CONCLUDI LA SFIDA</button>';
    root.prepend(panel);
    let initialized = false, ended = false, publishing = false, last = '';
    const count = getRoomParticipants(room).length;
    const stop = connectOnlineGame(container, control, {
        gameId, room, maxPlayers: 8, mode: 'independent', allowInputWhileSyncing: true,
        read: () => ({ initial: create(), results: Array.from({length:count}, () => ({score:0,finished:false,won:false,moves:0})) }),
        apply: (snapshot, seat) => {
            if (!initialized) { initialized = true; start(snapshot.initial); }
            if (snapshot.results[seat]?.finished) { ended = true; finish?.(); }
            const winners = challengeWinners(snapshot.results);
            panel.querySelector('.online-challenge-scores').textContent = (winners.length
                ? `Sfida conclusa · ${winners.includes(seat) ? winners.length > 1 ? 'Pareggio!' : 'Hai vinto!' : 'Vince il giocatore ' + (winners[0]+1)} · ` : 'Stessa partita per tutti · ')
                + snapshot.results.map((entry, i) => `${i === seat ? 'Tu' : `Giocatore ${i+1}`}: ${entry.score}${entry.finished ? ' (finito)' : ''}`).join(' · ');
            panel.querySelector('button').disabled = ended;
        }
    });
    const publish = async () => {
        if (!initialized || publishing || !control.onlineReady || control.onlineDisposed) return;
        const entry = { ...result(), finished: ended || Boolean(result().finished) };
        const signature = JSON.stringify(entry);
        if (signature === last) return;
        publishing = true;
        const success = await control.onlineSync.commit((snapshot, seat) => {
            if (!snapshot.results[seat].finished) snapshot.results[seat] = entry;
            return snapshot;
        });
        if (success) last = signature;
        publishing = false;
    };
    panel.querySelector('button').onclick = () => { ended = true; finish?.(); void publish(); };
    const timer = setInterval(publish, 2000);
    control.finishOnlineChallenge = () => { ended = true; void publish(); };
    const observer = new MutationObserver(() => { if (!root.isConnected) cleanup(); });
    observer.observe(container, {childList:true});
    function cleanup() { clearInterval(timer); observer.disconnect(); stop(); panel.remove(); }
    return cleanup;
}
