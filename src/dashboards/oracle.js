import {recordActivity} from '../services/communityMetrics.js';
import {navigateTo} from '../services/appNavigation.js';
import {updateSidebarContext} from '../components/layout/Sidebar.js';
import {postOracle,readOracleImage} from '../services/oracleClient.js';
import {esc,safeUrl} from '../services/communityUi.js';
import '../styles/community.css';
export function showOracle(container,options={}){
    updateSidebarContext('oracle');
    let history=[],busy=false,disposed=false;
    const controller=new AbortController();
    container.innerHTML=`<main class="entry-page community-page"><header><button data-home>← La Taverna</button><p class="crystal-eyebrow">UNA DOMANDA, UNA NUOVA POSSIBILITÀ</p><h1>L’Oracolo</h1><p class="community-intro">Carte, regole, videogiochi e avventure. Chiedi un chiarimento o porta la foto di una carta al tavolo.</p><small>AI fornita da Groq · Le risposte possono contenere errori.</small></header><div class="community-toolbar"><button data-example="Come inizio a giocare a D&D?">La mia prima avventura</button><button data-example="Come si distinguono le diverse stampe di una carta?">Conoscere una carta</button><button id="oracle-clear">Nuova conversazione</button></div><section id="oracle-chat" class="community-chat" aria-label="Conversazione con l’Oracolo" aria-live="polite"></section><form class="community-panel"><label>La tua domanda<textarea name="prompt" rows="3" maxlength="3000" required placeholder="Che cosa vuoi scoprire?">${esc(options.prompt||'')}</textarea></label><label>Foto di una carta (facoltativa, fino a 2 MB)<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="community-check"><input name="search" type="checkbox">Cerca sul web e indica le fonti</label><p><small>Domande e immagini vengono inviate a Groq. La conversazione resta solo in questa pagina e si svuota quando esci. Per la ricerca web invia una domanda senza foto.</small></p><button type="submit">Chiedi all’Oracolo</button><p id="oracle-status" class="community-status" role="status"></p></form></main>`;
    const root=container.firstElementChild,form=root.querySelector('form'),status=root.querySelector('#oracle-status');
    const addMessage=(role,text)=>{
        const article=document.createElement('article');article.className='community-message';article.dataset.role=role;
        const title=document.createElement('strong');title.textContent=role==='user'?'Tu':'L’Oracolo';article.append(title,document.createElement('br'));
        // Render text only; link plain HTTPS sources without executing model HTML.
        const expression=/https?:\/\/[^\s<>"\])]+/g;let start=0;
        for(const match of text.matchAll(expression)){article.append(document.createTextNode(text.slice(start,match.index)));const link=document.createElement('a');link.textContent=match[0];link.href=safeUrl(match[0]);link.target='_blank';link.rel='noopener noreferrer';article.append(link);start=match.index+match[0].length;}
        article.append(document.createTextNode(text.slice(start)));root.querySelector('#oracle-chat').append(article);
    };
    root.querySelector('[data-home]').onclick=()=>navigateTo('home',container);
    root.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{form.elements.prompt.value=b.dataset.example;form.elements.prompt.focus();});
    root.querySelector('#oracle-clear').onclick=()=>{if(busy)return;history=[];root.querySelector('#oracle-chat').replaceChildren();status.textContent='Conversazione svuotata.';};
    form.onsubmit=async event=>{
        event.preventDefault();if(busy||!form.reportValidity())return;
        busy=true;const button=form.querySelector('[type=submit]');button.disabled=true;root.querySelector('#oracle-clear').disabled=true;status.textContent='L’Oracolo sta consultando i suoi appunti…';
        try{
            const prompt=form.elements.prompt.value.trim(),file=form.elements.image.files[0],image=file?await readOracleImage(file):undefined;
            const result=await postOracle('/api/oracle/chat',{prompt,image,search:form.elements.search.checked,history},{signal:controller.signal});
            if(disposed)return;
            void recordActivity('oracle_answered');
            addMessage('user',prompt+(file?'\n[Foto allegata]':''));addMessage('assistant',result.reply);
            history.push({role:'user',content:prompt},{role:'assistant',content:result.reply});history=history.slice(-8);
            form.elements.prompt.value='';form.elements.image.value='';status.textContent=`${result.remaining} richieste disponibili oggi. ${result.searchRequested?'Ricerca web richiesta. Verifica le fonti riportate nella risposta.':''}`;
        }catch(error){if(!disposed)status.textContent=error.message;}
        finally{busy=false;if(!disposed){button.disabled=false;root.querySelector('#oracle-clear').disabled=false;}}
    };
    window.__communityCleanup=()=>{disposed=true;controller.abort();history=[];};
}
