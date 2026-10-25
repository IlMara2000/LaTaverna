import { navigateTo } from '../services/appNavigation.js';
import { updateSidebarContext } from '../components/layout/Sidebar.js';
import '../styles/tabletop-hubs.css';
import './proxyPrinter.css';
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function showProxyPrinter(container, options={}) {
    updateSidebarContext('mtcg');
    const root=document.createElement('main');root.className='proxy-printer';container.replaceChildren(root);
    root.innerHTML=`<header><button class="app-back-button" data-back>← MTCG</button><h1>MTG Proxy Printer</h1><p>Incolla una lista, controlla le carte e prepara i fogli A4 per il tuo tavolo.</p></header><form><label>Lista delle carte<textarea name="deck" required rows="8" maxlength="20000" placeholder="1 Sol Ring&#10;4 Lightning Bolt&#10;10 Forest"></textarea></label><label><input type="checkbox" name="backs"> Includi anche il retro delle carte bifronte (su fogli separati)</label><button type="submit">Carica carte</button></form><p data-status role="status" aria-live="polite"></p><div class="proxy-toolbar"><p>9 carte per foglio · 63 × 88 mm. Stampa al 100%, senza intestazioni o piè di pagina.</p><button data-print disabled>Stampa / Salva PDF</button></div><div class="proxy-sheets"></div><footer>Dati e immagini delle carte: Scryfall. Proxy per prove di gioco; non carte ufficiali.</footer>`;
    const form=root.querySelector('form'),status=root.querySelector('[data-status]'),sheets=root.querySelector('.proxy-sheets'),print=root.querySelector('[data-print]');
    if(options.decklist)form.elements.deck.value=String(options.decklist).slice(0,20000);
    root.querySelector('[data-back]').onclick=()=>navigateTo('mtcg',container);
    print.onclick=()=>window.print();
    form.onsubmit=async event=>{
        event.preventDefault();print.disabled=true;sheets.replaceChildren();form.querySelector('button').disabled=true;
        try {
            const rows=form.elements.deck.value.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('//'));
            const entries=rows.map(line=>{const match=line.match(/^(?:(\d+)x?\s+)?(.+)$/);return {count:Number(match[1]||1),name:match[2].trim()};});
            const total=entries.reduce((n,e)=>n+e.count,0);
            if(!entries.length||entries.some(e=>e.count<1||e.count>300)||total>300)throw new Error('Inserisci da 1 a 300 carte, nel formato «4 Lightning Bolt».');
            const fronts=[],backs=[],missing=[];
            for(let i=0;i<entries.length;i++){
                if(!root.isConnected)return;
                status.textContent=`Ricerca ${i+1} di ${entries.length}…`;
                const entry=entries[i];
                const response=await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(entry.name)}`);
                if(response.status===404){missing.push(entry.name);continue;}
                if(!response.ok)throw new Error('Catalogo temporaneamente non disponibile. Riprova tra poco.');
                const card=await response.json(),faces=card.card_faces||[];
                const front=card.image_uris?.png||faces[0]?.image_uris?.png;
                const back=faces[1]?.image_uris?.png;
                const safe=url=>{try{return new URL(url).origin==='https://cards.scryfall.io';}catch{return false;}};
                if(!safe(front)){missing.push(entry.name);continue;}
                for(let n=0;n<entry.count;n++){fronts.push({name:card.name,url:front});if(form.elements.backs.checked&&safe(back))backs.push({name:`${card.name} · retro`,url:back});}
                await new Promise(resolve=>setTimeout(resolve,110));
            }
            if(!root.isConnected)return;
            for(const group of [fronts,backs])for(let i=0;i<group.length;i+=9){
                const page=document.createElement('section');page.className='proxy-sheet';
                page.innerHTML=group.slice(i,i+9).map(c=>`<img src="${esc(c.url)}" alt="${esc(c.name)}" width="238" height="333">`).join('');sheets.append(page);
            }
            status.textContent='Caricamento immagini per la stampa…';
            await Promise.all([...sheets.querySelectorAll('img')].map(img=>img.decode()));
            if(!root.isConnected)return;
            status.textContent=`${fronts.length} carte pronte.${missing.length?` Non trovate: ${missing.join(', ')}. Correggi la lista prima di stampare.`:''}`;
            print.disabled=!fronts.length||missing.length>0;
        }catch(error){status.textContent=error.message==='The source image cannot be decoded.'?'Una o più immagini non sono caricate. Riprova prima di stampare.':error.message;}
        finally{form.querySelector('button').disabled=false;}
    };
}
