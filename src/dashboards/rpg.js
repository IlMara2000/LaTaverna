import {navigateTo} from '../services/appNavigation.js';
import {updateSidebarContext} from '../components/layout/Sidebar.js';
import {STARTER_CAMPAIGNS} from '../data/starterCampaigns.js';
import {esc} from '../services/communityUi.js';
import '../styles/community.css';
export function showRpg(container){
    updateSidebarContext('rpg');let disposed=false;
    container.innerHTML=`<main class="entry-page community-page"><header><button data-home>← La Taverna</button><p class="crystal-eyebrow">IL TUO POSTO NELLA STORIA</p><h1>Giochi di ruolo</h1><p class="community-intro">Prepara un tavolo con gli amici o entra in una delle nostre avventure. L’Oracolo è al tuo fianco anche sulla board.</p></header><section class="community-panel"><h2>Dungeons &amp; Dragons</h2><p>Personaggi, mappe e sessioni salvate nello stesso spazio. Non distribuiamo manuali ufficiali: stiamo integrando contenuti con licenza.</p><button id="rpg-dnd">Apri D&amp;D e le tue sessioni</button><p class="legal-inline-note">D&amp;D e Dungeons &amp; Dragons sono marchi di Wizards of the Coast. La Taverna non è affiliata e non distribuisce manuali ufficiali.</p></section><h2>Avventure pronte</h2><p>Scenari originali per D&D: l’Oracolo narra e interpreta un compagno. Tu scegli le azioni, lanci i dadi e aggiorni scheda, inventario e note sulla board. Le risposte AI non modificano automaticamente il gioco.</p><div class="community-grid">${STARTER_CAMPAIGNS.map(c=>`<article class="community-panel"><small>${esc(c.duration)}</small><h2>${esc(c.name)}</h2><p>${esc(c.description)}</p><button data-campaign="${c.id}">Crea il mio tavolo</button></article>`).join('')}</div><p id="rpg-status" role="status"></p></main>`;
    rootEvents();
    function rootEvents(){
        container.querySelector('[data-home]').onclick=()=>navigateTo('home',container);
        container.querySelector('#rpg-dnd').onclick=()=>navigateTo('dnd5e',container);
        container.querySelectorAll('[data-campaign]').forEach(b=>b.onclick=async()=>{
            container.querySelectorAll('[data-campaign]').forEach(el=>el.disabled=true);const status=container.querySelector('#rpg-status');status.textContent='Preparo la tua avventura…';
            try{const {createStarterAdventure}=await import('./dnd5e.js');const session=await createStarterAdventure(b.dataset.campaign);if(disposed)return;const {showSession}=await import('../components/features/tabletop/Session.js');if(disposed)return;await showSession(container,session.id,{systemId:'dnd5e',startAdventure:true});}
            catch(e){if(!disposed){status.textContent=e.message;container.querySelectorAll('[data-campaign]').forEach(el=>el.disabled=false);}}
        });
    }
    window.__communityCleanup=()=>{disposed=true;};
}
