import {supabase} from '../services/supabase.js';
import {shopStore} from '../services/shopStore.js';
import {navigateTo} from '../services/appNavigation.js';
import {updateSidebarContext} from '../components/layout/Sidebar.js';
import {contributionScenario} from '../services/communityMetrics.js';
import {esc,downloadJson} from '../services/communityUi.js';
import '../styles/community.css';
export function showManagement(container){
    updateSidebarContext('shop');let disposed=false;
    container.innerHTML='<main class="community-page"><button data-back>← Bottega</button><h1>La Taverna in numeri</h1><p role="status">Verifica accesso…</p><div id="management-content"></div></main>';
    const root=container.firstElementChild;root.querySelector('[data-back]').onclick=()=>navigateTo('shop',container);
    window.__communityCleanup=()=>{disposed=true;};
    void(async()=>{try{
        const account=await shopStore.account();if(!account.master)throw new Error('Questa pagina è riservata ai gestori della Bottega.');
        const {data,error}=await supabase.rpc('community_metrics');if(error)throw new Error(error.message);if(disposed)return;
        root.querySelector('[role=status]').textContent=`Aggiornato il ${new Date(data.measured_at).toLocaleString('it-IT')}`;
        root.querySelector('#management-content').innerHTML=`<div class="community-grid">${[['Account registrati',data.registered_accounts],['Account ospite',data.guest_accounts],['Partecipanti · ultimi 30 giorni',data.active_30d],['Partecipanti · ultimi 7 giorni',data.active_7d],['Richieste AI · oggi',data.oracle_requests_today]].map(([name,n])=>`<article class="community-panel"><small>${name}</small><h2>${Number(n)}</h2></article>`).join('')}</div><p>Rilevazione dal ${data.first_activity?esc(data.first_activity):'primo evento utile'}. Partecipanti = account con almeno un evento registrato di gioco, carte, lettura, creazione tavolo o risposta dell’Oracolo. Gli ospiti senza sessione account non sono conteggiati. Questi segnali provengono dall’app: non sono certificazioni pubblicitarie.</p><button id="metrics-export">Esporta i dati rilevati</button><section class="community-panel"><h2>Simulatore commissioni partner</h2><p>Ipotesi modificabili, non ricavi reali né valutazione aziendale. Il valore totale degli acquisti è distinto dal ricavo della Taverna.</p><form id="scenario-form">${[['active','Utenti attivi mensili',data.active_30d,1],['conversion','Acquirenti sugli attivi (%)','',0.1],['ordersPerBuyer','Ordini mensili per acquirente','',0.1],['basket','Valore medio ordine (€)','',0.01],['commission','Commissione Taverna (%)','',0.1],['costs','Costi mensili totali, inclusa gestione delegata (€)','',0.01]].map(([name,title,value,step])=>`<label>${title}<input name="${name}" type="number" min="0" ${['conversion','commission'].includes(name)?'max="100"':''} step="${step}" value="${value}" required></label>`).join('')}<button type="submit">Calcola scenario</button></form><p id="scenario-output" role="status"></p></section><p>Per valutare una cessione servono margini verificati, continuità degli utenti, contratti e costo per sostituire il fondatore. Il numero degli iscritti non determina da solo il prezzo della piattaforma.</p>`;
        root.querySelector('#metrics-export').onclick=()=>downloadJson('taverna-metriche.json',data);
        root.querySelector('#scenario-form').onsubmit=e=>{e.preventDefault();const values=Object.fromEntries([...new FormData(e.currentTarget)].map(([k,v])=>[k,Number(v)]));try{const result=contributionScenario(values);const money=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(v);root.querySelector('#scenario-output').textContent=`Acquirenti attesi: ${result.buyers.toFixed(1)}. Vendite partner: ${money(result.gmv)}. Commissioni Taverna: ${money(result.revenue)}. Risultato dopo i costi inseriti: ${money(result.contribution)} al mese.`;}catch(err){root.querySelector('#scenario-output').textContent=err.message;}};
    }catch(e){if(!disposed)root.querySelector('[role=status]').textContent=e.message;}})();
}
