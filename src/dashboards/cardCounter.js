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
    root.innerHTML=`<header class="counter-header"><button type="button" class="app-back-button" data-home>← Torna alla Taverna</button><span class="counter-seal" aria-hidden="true">♠ + ✦</span><p class="crystal-eyebrow">IL TUO ALLEATO AL TAVOLO</p><h1>Il Segnapunti<span>.</span></h1><p>Tu pensa alla prossima mossa.<br>Vite, premi e segnalini restano qui.</p></header>
    <form class="counter-setup"><label>Gioco<select name="preset">${Object.entries(PRESETS).map(([id,p])=>`<option value="${id}" ${state.preset===id?'selected':''}>${p.name}</option>`).join('')}</select></label><label>Giocatori<select name="players">${[2,3,4,5,6].map(n=>`<option ${n===state.players.length?'selected':''}>${n}</option>`).join('')}</select></label><label>Valore iniziale<input name="initial" type="number" min="0" max="999999" step="1" required value="${state.initial}"></label><button type="submit">Nuova partita ↗</button></form>
    <p class="counter-note">Un tavolo condiviso su questo dispositivo. Puoi personalizzare i valori e aggiungere segnalini per qualsiasi gioco.</p>
    <div class="counter-toolbar"><strong data-match-label></strong><button type="button" data-next>Passa il turno →</button><button type="button" data-undo>↶ Annulla</button><button type="button" data-coin>Testa o croce</button><button type="button" data-die>Tira d6</button></div>
    <p class="counter-status" role="status" aria-live="polite"></p><div class="counter-players"></div>
    <details class="counter-history"><summary>Cronologia della partita</summary><ol></ol></details><p class="counter-save-note"></p>`;
    const find=s=>root.querySelector(s), form=find('form');
    const announce=text=>find('.counter-status').textContent=text;
    const persist=()=>find('.counter-save-note').textContent=saveMatch(state,storage)?'Partita salvata su questo browser. La ritrovi qui quando torni.':'Salvataggio non disponibile: tieni aperta questa pagina per conservare la partita.';
    function render(focusKey) {
        const preset=PRESETS[state.preset];
        find('[data-match-label]').textContent=`${preset.name} · Turno ${state.turn}`;
        find('[data-undo]').disabled=!undo.length;
        find('.counter-players').innerHTML=state.players.map((p,i)=>`<article class="counter-player ${i===state.active?'is-active':''}" data-player="${i}">
            <div class="counter-player-top"><label><span>GIOCATORE ${i+1}${i===state.active?' · DI TURNO':''}</span><input data-name maxlength="40" aria-label="Nome giocatore ${i+1}" value="${escape(p.name)}"></label><span class="counter-player-number" aria-hidden="true">0${i+1}</span></div>
            <span class="counter-value-label">${preset.label}</span><output class="counter-value" aria-label="${escape(p.name)}: ${preset.label}">${p.value.toLocaleString('it-IT')}</output>
            <div class="counter-quick">${preset.steps.map(n=>`<div><button type="button" data-delta="${-n}" data-focus="p${i}minus${n}" aria-label="Sottrai ${n} a ${escape(p.name)}">−${n}</button><button type="button" data-delta="${n}" data-focus="p${i}plus${n}" aria-label="Aggiungi ${n} a ${escape(p.name)}">+${n}</button></div>`).join('')}</div>
            <form class="counter-adjust"><label>Importo<input type="number" name="amount" min="1" max="999999" step="1" required placeholder="Es. ${preset.steps[0]}" aria-label="Importo per ${escape(p.name)}"></label><button type="submit" name="sign" value="-1">Sottrai</button><button type="submit" name="sign" value="1">Aggiungi</button>${state.preset==='yugioh'?'<button type="button" data-half>Dimezza LP</button>':''}</form>
            <div class="counter-token-heading"><h2>Segnalini</h2><button type="button" data-add-token>+ Aggiungi</button></div>
            <ul class="counter-tokens">${p.counters.map(c=>`<li data-token="${escape(c.id)}"><span>${escape(c.name)}<small>Passo ${c.step}</small></span><button type="button" data-token-delta="${-c.step}" data-focus="p${i}${escape(c.id)}minus" aria-label="Riduci ${escape(c.name)} di ${c.step}" ${c.value===0?'disabled':''}>−</button><output>${c.value}</output><button type="button" data-token-delta="${c.step}" data-focus="p${i}${escape(c.id)}plus" aria-label="Aumenta ${escape(c.name)} di ${c.step}">+</button><button type="button" data-remove-token aria-label="Rimuovi ${escape(c.name)}" title="Rimuovi segnalino">×</button></li>`).join('')||'<li class="counter-token-empty">Mana, danni, cariche… aggiungi il tuo primo segnalino.</li>'}</ul>
        </article>`).join('');
        find('.counter-history ol').innerHTML=state.log.length?state.log.slice().reverse().map(line=>`<li>${escape(line)}</li>`).join(''):'<li>La partita comincia adesso.</li>';
        persist();
        if(focusKey) [...root.querySelectorAll('[data-focus]')].find(e=>e.dataset.focus===focusKey)?.focus({preventScroll:true});
    }
    function commit(next,focusKey) { undo.push(structuredClone(state));if(undo.length>100)undo.shift();state=next;render(focusKey); }
    function modal(title,content,onSubmit) {
        const d=document.createElement('dialog');d.className='counter-dialog';d.innerHTML=`<form><h2>${escape(title)}</h2>${content}<div><button type="button" data-cancel>Annulla</button><button type="submit">Conferma</button></div></form>`;
        d.setAttribute('aria-label',title);root.append(d);d.querySelector('[data-cancel]').onclick=()=>d.close();d.onclose=()=>d.remove();
        d.querySelector('form').onsubmit=e=>{e.preventDefault();onSubmit(new FormData(e.currentTarget));d.close();};d.showModal();d.querySelector('[data-cancel]').focus();
    }
    form.elements.preset.onchange=()=>{form.elements.initial.value=PRESETS[form.elements.preset.value].initial;};
    form.onsubmit=e=>{e.preventDefault();const preset=form.elements.preset.value,count=Number(form.elements.players.value),initial=Number(form.elements.initial.value);
        modal('Iniziare una nuova partita?','<p>I contatori attuali saranno azzerati. Puoi recuperare la partita precedente con “Annulla”.</p>',()=>{commit(createMatch(preset,count,initial));announce('Nuova partita pronta.');});};
    find('[data-home]').onclick=()=>navigateTo('home',container);
    find('[data-next]').onclick=()=>{const next=structuredClone(state);next.active=(next.active+1)%next.players.length;next.turn++;next.log.push(`Turno ${next.turn} · ${next.players[next.active].name}`);next.log=next.log.slice(-50);commit(next);announce(`È il turno di ${state.players[state.active].name}.`);};
    find('[data-undo]').onclick=()=>{if(undo.length){state=undo.pop();render();announce('Ultima modifica annullata.');}};
    function randomResult(sides,label){const bytes=new Uint32Array(1);let n;const limit=Math.floor(4294967296/sides)*sides;do{crypto.getRandomValues(bytes);n=bytes[0];}while(n>=limit);const result=label(n%sides);const next=structuredClone(state);next.log.push(result);next.log=next.log.slice(-50);commit(next);announce(result);}
    find('[data-coin]').onclick=()=>randomResult(2,n=>`Moneta: ${n?'croce':'testa'}.`);
    find('[data-die]').onclick=()=>randomResult(6,n=>`Dado: ${n+1}.`);
    find('.counter-players').onchange=e=>{if(!e.target.matches('[data-name]'))return;const next=structuredClone(state);const i=Number(e.target.closest('[data-player]').dataset.player);next.players[i].name=e.target.value.trim().slice(0,40)||`Giocatore ${i+1}`;commit(next);};
    find('.counter-players').onsubmit=e=>{e.preventDefault();if(!e.target.matches('.counter-adjust'))return;const i=Number(e.target.closest('[data-player]').dataset.player),amount=Number(e.target.elements.amount.value)*Number(e.submitter?.value||1);try{commit(changeScore(state,i,amount));announce(state.log.at(-1));}catch(error){announce(error.message);}};
    find('.counter-players').onclick=e=>{
        const b=e.target.closest('button');if(!b||b.disabled)return;const i=Number(b.closest('[data-player]').dataset.player),token=b.closest('[data-token]')?.dataset.token;
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
