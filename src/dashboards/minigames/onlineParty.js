import { connectOnlineGame } from './onlineGameSession.js';
import { getRoomParticipants } from '../../services/minigameMultiplayer.js';
import { createPartyGame, partyAction } from './onlinePartyEngine.js';
const esc = text => String(text).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function startOnlineParty(container, gameId, room, config = {}) {
    const root = container.querySelector('.master-wrapper');
    root.innerHTML = `<header><button type="button" class="game-btn-action" id="party-exit">← ESCI</button><h1>${gameId==='impostore'?'Impostore':'Numeri'} online</h1><p>Codice ${esc(room.code)} · tutti i partecipanti sono persone reali</p></header><section id="party-view"></section><form id="party-chat-form" hidden><label>Discussione <input id="party-message" maxlength="240" autocomplete="off" placeholder="Scrivi un indizio o una proposta"></label><button type="submit" class="game-btn-action">INVIA</button></form><ol id="party-chat" aria-live="polite"></ol>`;
    const control = {};
    let revealed=false, snapshot=null, seat=0, round=0;
    const send = action => control.onlineSync.commit((current, index)=>partyAction(current,index,action));
    function render(next,index) {
        snapshot=next;seat=index;
        if(round!==next.round) {round=next.round;revealed=false;}
        const mine=gameId==='numeri'?next.numbers[seat].join(' · '):next.roles[seat]==='impostor'?'Sei l’impostore: scopri la parola.':`${next.roles[seat]==='undercover'?'Undercover':'Civile'} · ${next.words[next.roles[seat]==='undercover'?1:0]}`;
        let html=`<p>Round ${next.round} · Tu sei Giocatore ${seat+1}</p>`;
        if(next.phase==='reveal') html+=`<h2>Il tuo segreto</h2><p>${revealed?esc(mine):'Leggilo senza mostrarlo agli altri.'}</p><button class="game-btn-action" data-party="reveal">${revealed?'NASCONDI':'SCOPRI'}</button><button class="game-btn-action" data-party="ready" ${!revealed||next.ready[seat]?'disabled':''}>${next.ready[seat]?'PRONTO':'HO MEMORIZZATO'}</button><p>${next.ready.filter(Boolean).length}/${next.count} pronti</p>`;
        if(next.phase==='discuss') {
            html+=`<h2>${gameId==='numeri'?'Ordinate i giocatori dalla media più piccola alla più grande':'Discutete e votate l’impostore'}</h2>`;
            if(gameId==='numeri') {
                html+=next.order.map((id,i)=>`<p>Giocatore ${id+1} ${seat===0?`<button class="game-btn-action" data-up="${i}" ${!i?'disabled':''}>↑</button>`:''}</p>`).join('');
                html+=seat===0?'<button class="game-btn-action" data-party="check">CONFERMA ORDINE</button>':'<p>L’host conferma l’ordine concordato.</p>';
            } else html+=next.alive.map((alive,i)=>`<p>Giocatore ${i+1} ${!alive?'· eliminato':next.votes[i]!==null?'· ha votato':''} ${alive&&i!==seat&&next.alive[seat]?`<button class="game-btn-action" data-vote="${i}" ${next.votes[seat]!==null?'disabled':''}>VOTA</button>`:''}</p>`).join('');
        }
        if(next.phase==='guess') html+=`<h2>L’impostore ha una possibilità</h2>${seat===next.guessSeat?'<label>Parola segreta <input id="party-guess" maxlength="80"></label><button class="game-btn-action" data-party="guess">CONFERMA</button>':`<p>Giocatore ${next.guessSeat+1} sta provando a indovinare.</p>`}`;
        if(next.phase==='result') {
            html+=`<h2>${gameId==='numeri'?(next.correct?'Ordine corretto!':'Ordine errato'):next.winner==='civil'?'Vincono i civili!':'Vincono gli impostori!'}</h2>`;
            html+=gameId==='numeri'?next.numbers.map((nums,i)=>`<p>Giocatore ${i+1}: ${nums.join(', ')}</p>`).join(''):`<p>Parola: ${esc(next.words[0])}</p>`+next.roles.map((role,i)=>`<p>Giocatore ${i+1}: ${role}</p>`).join('');
            if(seat===0) html+='<button class="game-btn-action" data-party="next">PROSSIMO ROUND</button>';
        }
        root.querySelector('#party-view').innerHTML=html;
        root.querySelector('#party-chat-form').hidden=!['discuss','guess'].includes(next.phase);
        root.querySelector('#party-chat').innerHTML=next.chat.map(entry=>`<li>${entry.seat<0?'Tavolo':`Giocatore ${entry.seat+1}`}: ${esc(entry.text)}</li>`).join('');
    }
    const stop=connectOnlineGame(container,control,{gameId,room,maxPlayers:8,mode:'independent',read:()=>createPartyGame(gameId,getRoomParticipants(room).length,1,config),apply:render});
    root.querySelector('#party-exit').onclick=async()=>{stop();const {showMinigamesList}=await import('../../minigamelist.js');showMinigamesList(container);};
    root.querySelector('#party-view').onclick=event=>{
        const button=event.target.closest('button');if(!button||button.disabled||!snapshot)return;
        const type=button.dataset.party;
        if(type==='reveal') {revealed=!revealed;render(snapshot,seat);return;}
        if(type==='guess') {void send({type,text:root.querySelector('#party-guess').value});return;}
        if(button.dataset.vote!==undefined) {void send({type:'vote',target:Number(button.dataset.vote)});return;}
        if(button.dataset.up!==undefined) {const i=Number(button.dataset.up),order=[...snapshot.order];[order[i-1],order[i]]=[order[i],order[i-1]];void send({type:'order',order});return;}
        if(type) void send({type});
    };
    root.querySelector('#party-chat-form').onsubmit=event=>{event.preventDefault();if(!control.onlineReady)return;const input=root.querySelector('#party-message'),text=input.value;input.value='';void send({type:'chat',text});};
    return stop;
}
