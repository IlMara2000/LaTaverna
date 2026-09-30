import { PRESETS, createMatch, changeScore, loadMatch, saveMatch } from '../services/cardCounter.js';
import { navigateTo } from '../services/appNavigation.js';
import { updateSidebarContext } from '../components/layout/Sidebar.js';
import './cardCounter.css';
const escape = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function showCardCounter(container) {
    updateSidebarContext('cardCounter');
    let storage;try{storage=localStorage;}catch{}
    let state=loadMatch(storage)||createMatch(), undo=[];
    const root=document.createElement('section');root.className='card-counter';container.replaceChildren(root);
    root.innerHTML=`<header class="counter-header"><button type="button" data-home aria-label="Torna alla Taverna">←</button><div><h1>Segnapunti</h1><strong data-match-label></strong></div><button type="button" data-settings aria-label="Impostazioni della partita">⚙ <span>Partita</span></button></header>
    <div class="counter-players"></div>
    <footer class="counter-toolbar"><button type="button" data-undo>↶ Annulla</button><p class="counter-status" role="status" aria-live="polite"></p><button type="button" data-next>Turno →</button></footer>
    <dialog class="counter-dialog counter-settings" aria-label="Gestisci la partita"><button type="button" data-close-settings class="counter-close" aria-label="Chiudi impostazioni">×</button><h2>La tua partita</h2>
    <form class="counter-setup"><label>Gioco<select name="preset">${Object.entries(PRESETS).map(([id,p])=>`<option value="${id}" ${state.preset===id?'selected':''}>${p.name}</option>`).join('')}</select></label><label>Giocatori<select name="players">${[2,3,4,5,6].map(n=>`<option ${n===state.players.length?'selected':''}>${n}</option>`).join('')}</select></label><label>Valore iniziale<input name="initial" type="number" min="0" max="999999" step="1" required value="${state.initial}"></label><button type="submit">Nuova partita ↗</button></form>
    <div class="counter-tools"><button type="button" data-coin>Testa o croce</button><button type="button" data-die>Tira d6</button><p data-tool-result role="status"></p></div>
    <details class="counter-history"><summary>Cronologia della partita</summary><ol></ol></details><p class="counter-save-note"></p></dialog>`;
    const find=s=>root.querySelector(s), form=find('form');
    const announce=text=>find('.counter-status').textContent=text;
    const persist=()=>find('.counter-save-note').textContent=saveMatch(state,storage)?'Partita salvata su questo browser. La ritrovi qui quando torni.':'Salvataggio non disponibile: tieni aperta questa pagina per conservare la partita.';
    function render(focusKey) {
        const openPanel = root.querySelector('.counter-player-dialog[open]');
        const openPlayer = openPanel?.closest('[data-player]').dataset.player;
        const panelScroll = openPanel?.scrollTop || 0;
        root.dataset.players = state.players.length;
        const preset=PRESETS[state.preset];
        find('[data-match-label]').textContent=`${preset.name} · Turno ${state.turn}`;
        find('[data-undo]').disabled=!undo.length;
        find('.counter-players').innerHTML=state.players.map((p,i)=>`<article class="counter-player ${i===state.active?'is-active':''}" data-player="${i}">
            <div class="counter-player-top"><button type="button" data-details><span>${escape(p.name)}</span><small>${i===state.active?'DI TURNO':'GIOCATORE '+(i+1)}</small></button><span class="counter-value-label">${preset.label}</span></div>
            <div class="counter-face"><button type="button" class="counter-tap" data-delta="${-preset.steps[0]}" data-focus="p${i}minus${preset.steps[0]}" aria-label="Sottrai ${preset.steps[0]} a ${escape(p.name)}">−<small>${preset.steps[0]}</small></button><output class="counter-value" aria-label="${escape(p.name)}: ${preset.label}">${p.value.toLocaleString('it-IT')}</output><button type="button" class="counter-tap" data-delta="${preset.steps[0]}" data-focus="p${i}plus${preset.steps[0]}" aria-label="Aggiungi ${preset.steps[0]} a ${escape(p.name)}">+<small>${preset.steps[0]}</small></button></div>
            <div class="counter-quick">${preset.steps.slice(1).map(n=>`<button type="button" data-delta="${-n}" data-focus="p${i}minus${n}" aria-label="Sottrai ${n} a ${escape(p.name)}">−${n}</button><button type="button" data-delta="${n}" data-focus="p${i}plus${n}" aria-label="Aggiungi ${n} a ${escape(p.name)}">+${n}</button>`).join('')}</div>
            <button type="button" class="counter-details-button" data-details aria-label="Dettagli e segnalini di ${escape(p.name)}"><span>Segnalini & dettagli ↗</span><span class="counter-token-preview">${p.counters.filter(c=>c.value).slice(0,2).map(c=>`${escape(c.name)} ${c.value}`).join(' · ') || 'Importo libero, nome e contatori'}</span></button>
            <dialog class="counter-dialog counter-player-dialog" aria-label="Dettagli di ${escape(p.name)}"><button type="button" data-close-player class="counter-close" aria-label="Chiudi dettagli">×</button><h2>Il tuo contatore</h2><label>Nome<input data-name maxlength="40" aria-label="Nome giocatore ${i+1}" value="${escape(p.name)}"></label>
            <form class="counter-adjust"><label>Importo<input type="number" name="amount" min="1" max="999999" step="1" required placeholder="Es. ${preset.steps[0]}" aria-label="Importo per ${escape(p.name)}"></label><button type="submit" name="sign" value="-1">Sottrai</button><button type="submit" name="sign" value="1">Aggiungi</button>${state.preset==='yugioh'?'<button type="button" data-half>Dimezza LP</button>':''}</form>
            <div class="counter-token-heading"><h2>Segnalini</h2><button type="button" data-add-token>+ Aggiungi</button></div>
            <ul class="counter-tokens">${p.counters.map(c=>`<li data-token="${escape(c.id)}"><span>${escape(c.name)}<small>Passo ${c.step}</small></span><button type="button" data-token-delta="${-c.step}" data-focus="p${i}${escape(c.id)}minus" aria-label="Riduci ${escape(c.name)} di ${c.step}" ${c.value===0?'disabled':''}>−</button><output>${c.value}</output><button type="button" data-token-delta="${c.step}" data-focus="p${i}${escape(c.id)}plus" aria-label="Aumenta ${escape(c.name)} di ${c.step}">+</button><button type="button" data-remove-token aria-label="Rimuovi ${escape(c.name)}" title="Rimuovi segnalino">×</button></li>`).join('')||'<li class="counter-token-empty">Mana, danni, cariche… aggiungi il tuo primo segnalino.</li>'}</ul>
        </dialog></article>`).join('');
        find('.counter-history ol').innerHTML=state.log.length?state.log.slice().reverse().map(line=>`<li>${escape(line)}</li>`).join(''):'<li>La partita comincia adesso.</li>';
        persist();
        if(openPlayer !== undefined) {
            const panel=find(`[data-player="${openPlayer}"] .counter-player-dialog`);
            if(panel){panel.showModal();panel.scrollTop=panelScroll;}
        }
        root.querySelectorAll('.counter-player-dialog').forEach(panel=>panel.onclose=()=>panel.closest('[data-player]')?.querySelector('[data-details]')?.focus({preventScroll:true}));
        if(focusKey) [...root.querySelectorAll('[data-focus]')].find(e=>e.dataset.focus===focusKey)?.focus({preventScroll:true});
    }
    function commit(next,focusKey) { undo.push(structuredClone(state));if(undo.length>100)undo.shift();state=next;render(focusKey); }
    function modal(title,content,onSubmit) {
        const d=document.createElement('dialog');d.className='counter-dialog';d.innerHTML=`<form><h2>${escape(title)}</h2>${content}<div><button type="button" data-cancel>Annulla</button><button type="submit">Conferma</button></div></form>`;
        d.setAttribute('aria-label',title);root.append(d);d.querySelector('[data-cancel]').onclick=()=>d.close();d.onclose=()=>d.remove();
        d.querySelector('form').onsubmit=e=>{e.preventDefault();onSubmit(new FormData(e.currentTarget));d.close();};d.showModal();d.querySelector('[data-cancel]').focus();
    }
    find('[data-settings]').onclick=()=>find('.counter-settings').showModal();
    find('[data-close-settings]').onclick=()=>find('.counter-settings').close();
    form.elements.preset.onchange=()=>{form.elements.initial.value=PRESETS[form.elements.preset.value].initial;};
    form.onsubmit=e=>{e.preventDefault();const preset=form.elements.preset.value,count=Number(form.elements.players.value),initial=Number(form.elements.initial.value);
        modal('Iniziare una nuova partita?','<p>I contatori attuali saranno azzerati. Puoi recuperare la partita precedente con “Annulla”.</p>',()=>{commit(createMatch(preset,count,initial));find('.counter-settings').close();announce('Nuova partita pronta.');});};
    find('[data-home]').onclick=()=>navigateTo('home',container);
    find('[data-next]').onclick=()=>{const next=structuredClone(state);next.active=(next.active+1)%next.players.length;next.turn++;next.log.push(`Turno ${next.turn} · ${next.players[next.active].name}`);next.log=next.log.slice(-50);commit(next);announce(`È il turno di ${state.players[state.active].name}.`);};
    find('[data-undo]').onclick=()=>{if(undo.length){state=undo.pop();render();announce('Ultima modifica annullata.');}};
    function randomResult(sides,label){const bytes=new Uint32Array(1);let n;const limit=Math.floor(4294967296/sides)*sides;do{crypto.getRandomValues(bytes);n=bytes[0];}while(n>=limit);const result=label(n%sides);const next=structuredClone(state);next.log.push(result);next.log=next.log.slice(-50);commit(next);announce(result);find('[data-tool-result]').textContent=result;}
    find('[data-coin]').onclick=()=>randomResult(2,n=>`Moneta: ${n?'croce':'testa'}.`);
    find('[data-die]').onclick=()=>randomResult(6,n=>`Dado: ${n+1}.`);
    find('.counter-players').onchange=e=>{if(!e.target.matches('[data-name]'))return;const next=structuredClone(state);const i=Number(e.target.closest('[data-player]').dataset.player);next.players[i].name=e.target.value.trim().slice(0,40)||`Giocatore ${i+1}`;commit(next);};
    find('.counter-players').onsubmit=e=>{e.preventDefault();if(!e.target.matches('.counter-adjust'))return;const i=Number(e.target.closest('[data-player]').dataset.player),amount=Number(e.target.elements.amount.value)*Number(e.submitter?.value||1);try{commit(changeScore(state,i,amount));announce(state.log.at(-1));}catch(error){announce(error.message);}};
    find('.counter-players').onclick=e=>{
        const b=e.target.closest('button');if(!b||b.disabled)return;const i=Number(b.closest('[data-player]').dataset.player),token=b.closest('[data-token]')?.dataset.token;
        if(b.hasAttribute('data-details')){b.closest('[data-player]').querySelector('dialog').showModal();return;}
        if(b.hasAttribute('data-close-player')){b.closest('dialog').close();return;}
        if(b.hasAttribute('data-delta')||b.hasAttribute('data-token-delta')){commit(changeScore(state,i,Number(b.dataset.delta??b.dataset.tokenDelta),token??null),b.dataset.focus);announce(state.log.at(-1));}
        else if(b.hasAttribute('data-half')){commit(changeScore(state,i,Math.ceil(state.players[i].value/2)-state.players[i].value));announce(state.log.at(-1));}
        else if(b.hasAttribute('data-remove-token')){const next=structuredClone(state);next.players[i].counters=next.players[i].counters.filter(c=>c.id!==token);commit(next);announce('Segnalino rimosso. Puoi annullare.');}
        else if(b.hasAttribute('data-add-token')){
            if(state.players[i].counters.length>=30){announce('Puoi usare fino a 30 contatori per giocatore.');return;}
            modal('Un nuovo segnalino',`<label>Nome<input name="name" maxlength="50" required placeholder="Es. danni · Pokémon in panchina"></label><label>Incremento<input name="step" type="number" min="1" max="1000" step="1" value="${state.preset==='pokemon'?10:1}" required></label>`,data=>{const name=String(data.get('name')).trim();if(!name)return;const next=structuredClone(state);next.players[i].counters.push({id:crypto.randomUUID(),name,value:0,step:Number(data.get('step'))});commit(next);announce('Segnalino aggiunto.');});
        }
    };
    render();
}
