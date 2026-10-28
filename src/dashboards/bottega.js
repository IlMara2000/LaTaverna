import { navigateTo } from '../services/appNavigation.js';
import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { shopStore, productFromRow, formatPrice } from '../services/shopStore.js';
import { initShopCommerce } from './shopCommerce.js';
import { esc, safeUrl } from '../services/communityUi.js';
import '../styles/community.css';

export function initBottega(container) {
    updateSidebarContext('shop');
    let disposed = false, version = 0;
    const state = {cart:[], products:[], allProducts:[], placingOrder:false};
    container.innerHTML = `<main class="entry-page community-page"><header><button data-home>← La Taverna</button><p class="crystal-eyebrow">LA COMMUNITY, ANCHE FUORI DAL TAVOLO</p><h1>La Bottega</h1><p class="community-intro">Accessori per giocare, oggetti da portare con te e creazioni della Taverna. Stiamo preparando la nuova selezione.</p></header><div class="community-grid"><article class="community-panel"><span class="community-mark" aria-hidden="true">♠</span><h2>Al tuo tavolo</h2><p>Tappetini, portamazzi e accessori per dadi: spazio alle cose che rendono più piacevole giocare.</p><small>Selezione in preparazione</small></article><article class="community-panel"><span class="community-mark" aria-hidden="true">✦</span><h2>Porta la Taverna con te</h2><p>Abbigliamento e piccoli oggetti ispirati alle storie della community.</p><small>Collezione in preparazione</small></article><article class="community-panel"><span class="community-mark" aria-hidden="true">⚑</span><h2>Incontri e partner</h2><p>Uno spazio per autori, artigiani e realtà vicine ai nostri giochi.</p><small>Collaborazioni in preparazione</small></article></div><div class="community-toolbar"><button id="shop-orders" hidden>I miei ordini</button><button id="shop-master" hidden>Gestisci bottega</button><button id="shop-metrics" hidden>Metriche e scenari</button><button id="shop-retry">Aggiorna catalogo</button></div><p class="community-status" role="status" id="shop-status">Caricamento catalogo…</p><section class="community-grid" id="shop-products" aria-label="Prodotti disponibili"></section><div id="shop-cart" class="community-panel" hidden></div></main>`;
    const root = container.firstElementChild;
    const status = message => { if(!disposed) root.querySelector('#shop-status').textContent=message; };
    const render = () => {
        root.querySelector('#shop-products').innerHTML = state.products.map(p=>`<article class="community-panel">${safeUrl(p.image)?`<img class="community-card-image" src="${esc(safeUrl(p.image))}" alt="${esc(p.name)}">`:''}<h2>${esc(p.name)}</h2><p>${esc(p.description)}</p><p>${esc(formatPrice(p.price_cents))}</p><button data-add="${esc(p.id)}" ${p.stock===0?'disabled':''}>${p.stock===0?'Non disponibile':'Aggiungi alla richiesta'}</button></article>`).join('');
        root.querySelectorAll('[data-add]').forEach(button=>button.onclick=()=>{const p=state.products.find(p=>p.id===button.dataset.add);const entry=state.cart.find(x=>x.id===p.id);if(entry)entry.quantity=Math.min(entry.quantity+1,p.stock??9,9);else state.cart.push({id:p.id,quantity:1});renderCart();});
        renderCart();
    };
    const renderCart = () => {
        const el=root.querySelector('#shop-cart');el.hidden=!state.cart.length;
        el.innerHTML=`<h2>La tua richiesta</h2>${state.cart.map(x=>`<p>${esc(state.products.find(p=>p.id===x.id)?.name)} × ${x.quantity} <button data-remove="${esc(x.id)}">Rimuovi</button></p>`).join('')}<p>Pagamento e consegna vengono concordati con la Bottega. Nessun addebito online.</p><button id="shop-checkout">Continua</button>`;
        el.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.cart=state.cart.filter(x=>x.id!==b.dataset.remove);renderCart();});
        el.querySelector('#shop-checkout').onclick=()=>commerce.checkout();
    };
    const refresh = async () => {
        const current=++version;
        const [rows,account]=await Promise.all([shopStore.products(),shopStore.account()]);
        if(disposed||current!==version)return false;
        state.allProducts=rows;state.products=rows.filter(p=>p.status==='active').map(productFromRow);
        const previous=state.cart.length;state.cart=state.cart.filter(x=>state.products.some(p=>p.id===x.id));
        root.querySelector('#shop-master').hidden=!account.master;root.querySelector('#shop-metrics').hidden=!account.master;root.querySelector('#shop-orders').hidden=!account.user;
        status(state.products.length?'':'Il nuovo catalogo non è ancora aperto. Nel frattempo, ci vediamo al tavolo.');render();return previous!==state.cart.length;
    };
    const commerce=initShopCommerce(root,state,{refresh,onOrder:()=>{state.cart=[];renderCart();}});
    const load=()=>refresh().catch(()=>status('Catalogo non raggiungibile. Riprova con “Aggiorna catalogo”.'));
    const subscription=shopStore.onAuthChange(()=>{if(disposed)return;commerce.reset();state.cart=[];root.querySelector('#shop-master').hidden=true;root.querySelector('#shop-metrics').hidden=true;root.querySelector('#shop-orders').hidden=true;void load();});
    root.querySelector('[data-home]').onclick=()=>navigateTo('home',container);
    root.querySelector('#shop-retry').onclick=load;
    root.querySelector('#shop-metrics').onclick=()=>navigateTo('management',container);
    window.__shopCleanup=()=>{disposed=true;subscription?.unsubscribe();commerce.cleanup();};
    void load();
}
