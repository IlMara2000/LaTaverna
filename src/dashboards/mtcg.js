import {navigateTo} from '../services/appNavigation.js';
import {updateSidebarContext} from '../components/layout/Sidebar.js';
import '../styles/community.css';
import '../styles/tabletop-hubs.css';
export function showMtcg(container){
 updateSidebarContext('mtcg');
 container.innerHTML=`<main class="community-page mtcg-page"><header><button class="app-back-button" data-go="home">← La Taverna</button><p class="crystal-eyebrow">CARTE COLLEZIONABILI</p><h1>MTCG</h1><p class="community-intro">Il tuo spazio dedicato a Magic: The Gathering. Collezione, mazzi e strumenti per il tavolo.</p></header><div class="community-grid"><section class="community-panel"><h2>Magic: The Gathering</h2><p>Organizza la collezione, prepara i mazzi e ritrova le carte che cerchi.</p><button data-go="magic">Apri Magic</button></section><section class="community-panel"><h2>Segnapunti</h2><p>Vite e segnalini sempre a portata di mano.</p><button data-go="cardCounter">Apri segnapunti</button></section><section class="community-panel"><h2>MTG Proxy Printer</h2><p>Prepara le carte di prova per il tuo tavolo e impagina i fogli da stampare.</p><button data-go="proxyPrinter">Apri Proxy Printer</button></section></div></main>`;
 container.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigateTo(b.dataset.go,container,b.dataset.go==='cardCounter'?{preset:'commander'}:{}));
}
