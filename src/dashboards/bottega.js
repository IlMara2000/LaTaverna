import { navigateTo } from '../services/appNavigation.js';
import { updateSidebarContext } from '../components/layout/Sidebar.js';
import './bottega.css';

export function initBottega(container) {
    updateSidebarContext('shop');
    container.innerHTML = `
        <section class="bottega-hub" aria-labelledby="bottega-title">
            <header class="bottega-hub-top"><a href="/" class="app-back-button">← Torna alla Taverna</a><span>LA TAVERNA · BOTTEGA</span></header>
            <div class="bottega-hub-intro">
                <img src="/assets/shop/bottega-logo.svg" alt="Emblema della Bottega del Viandante" width="120" height="120">
                <p class="crystal-eyebrow">OGGETTI CON UNA STORIA DA RACCONTARE</p>
                <h1 id="bottega-title">La Bottega del Viandante</h1>
                <p>Incontri, materia e piccoli mondi da scoprire. Scegli da quale bottega cominciare.</p>
            </div>
            <div class="bottega-departments">
                <a class="bottega-department is-available" href="/bottega/artigiano-rituale" id="ritual-department">
                    <div class="bottega-department-art"><img src="/assets/shop/product-ametista-regale.jpg" alt="Creazione artigianale ametista" decoding="async"><span class="bottega-department-label">LA PRIMA BOTTEGA · 18+</span></div>
                    <div class="bottega-department-copy"><h2>L’Artigiano Rituale</h2><p>Forme scolpite, finiture materiche e pezzi da personalizzare. Accessori artigianali per adulti.</p><span>Esplora la collezione <b aria-hidden="true">↗</b></span></div>
                </a>
                <article class="bottega-department is-coming"><div class="bottega-coming-art" aria-hidden="true">✦</div><div class="bottega-department-copy"><span class="bottega-coming-label">COMING SOON</span><h2>Nuove creazioni</h2><p>Un nuovo spazio sta prendendo forma. La sua storia arriverà presto.</p></div></article>
                <article class="bottega-department is-coming"><div class="bottega-coming-art" aria-hidden="true">✧</div><div class="bottega-department-copy"><span class="bottega-coming-label">COMING SOON</span><h2>Altri mondi</h2><p>La Bottega continua a crescere. Qui troverai le prossime novità.</p></div></article>
            </div>
        </section>`;
    container.querySelector('#ritual-department').addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        navigateTo('artisanShop', container);
    });
}
