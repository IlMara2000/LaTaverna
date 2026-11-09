import {recordActivity} from '../services/communityMetrics.js';
import {navigateTo} from '../services/appNavigation.js';
import {updateSidebarContext} from '../components/layout/Sidebar.js';
import {postOracle,readOracleImage} from '../services/oracleClient.js';
import {esc,safeUrl} from '../services/communityUi.js';
import {renderOracleMarkdown} from '../services/oracleMarkdown.js';
import {formatOracleQuota} from '../services/oracleQuota.js';
import '../styles/community.css';

// Il robottino della Taverna: stessa sagoma che vive nel menu, qui sta nell'angolo in alto.
const PUPPET='<span class="oracle-halo"></span><span class="oracle-body"><span class="oracle-ear oracle-ear-left"></span><span class="oracle-ear oracle-ear-right"></span><span class="oracle-face"><i></i><i></i><b></b></span></span><span class="oracle-hand oracle-hand-left"></span><span class="oracle-hand oracle-hand-right"></span><span class="oracle-gem"></span>';
const EXAMPLES=[
    ['🎲','La mia prima avventura','Come inizio a giocare a D&D?'],
    ['🃏','Conoscere una carta','Come si distinguono le diverse stampe di una carta?'],
    ['🕯️','Regole al tavolo','Spiegami in due righe come funziona l’iniziativa.']
];
const BADGE_KEY='lataverna.oracle.badge';
// Il robottino si prende con il dito, col mouse o con le frecce e ricorda dove l'hai lasciato.
function makeBadgeDraggable(badge){
    if(!badge) return ()=>{};
    const clamp=(v,min,max)=>Math.min(Math.max(v,min),Math.max(min,max));
    const limit=8;
    const place=(x,y)=>{badge.style.left=x+'px';badge.style.top=y+'px';};
    const save=pos=>{try{localStorage.setItem(BADGE_KEY,JSON.stringify(pos));}catch{/* modalità privata */}};
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem(BADGE_KEY)||'null');}catch{}
    if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)){
        badge.classList.add('is-floating');
        const w=badge.offsetWidth||44,h=badge.offsetHeight||44;
        place(clamp(saved.x,limit,innerWidth-w-limit),clamp(saved.y,limit,innerHeight-h-limit));
    }
    let drag=null;
    const onDown=event=>{
        if(event.pointerType==='mouse'&&event.button!==0)return;
        const box=badge.getBoundingClientRect();
        drag={id:event.pointerId,dx:event.clientX-box.x,dy:event.clientY-box.y,moved:false};
        try{badge.setPointerCapture(event.pointerId);}catch{}
        badge.classList.add('is-dragging');
    };
    const onMove=event=>{
        if(!drag||event.pointerId!==drag.id)return;
        if(!drag.moved){drag.moved=true;badge.classList.add('is-floating');}
        const w=badge.offsetWidth||44,h=badge.offsetHeight||44;
        place(clamp(event.clientX-drag.dx,limit,innerWidth-w-limit),clamp(event.clientY-drag.dy,limit,innerHeight-h-limit));
        event.preventDefault();
    };
    const onUp=event=>{
        if(!drag||(event.pointerId!==undefined&&event.pointerId!==drag.id))return;
        if(drag.moved){const box=badge.getBoundingClientRect();save({x:Math.round(box.x),y:Math.round(box.y)});}
        drag=null;badge.classList.remove('is-dragging');
    };
    const onKey=event=>{
        const step=event.shiftKey?40:10;
        const moves={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
        const move=moves[event.key];
        if(!move)return;
        event.preventDefault();
        badge.classList.add('is-floating');
        const w=badge.offsetWidth||44,h=badge.offsetHeight||44,box=badge.getBoundingClientRect();
        const x=clamp(box.x+move[0],limit,innerWidth-w-limit),y=clamp(box.y+move[1],limit,innerHeight-h-limit);
        place(x,y);save({x:Math.round(x),y:Math.round(y)});
    };
    const onResize=()=>{
        if(!badge.classList.contains('is-floating'))return;
        const w=badge.offsetWidth||44,h=badge.offsetHeight||44,box=badge.getBoundingClientRect();
        place(clamp(box.x,limit,innerWidth-w-limit),clamp(box.y,limit,innerHeight-h-limit));
    };
    badge.addEventListener('pointerdown',onDown);
    badge.addEventListener('pointermove',onMove);
    badge.addEventListener('pointerup',onUp);
    badge.addEventListener('pointercancel',onUp);
    badge.addEventListener('keydown',onKey);
    window.addEventListener('resize',onResize);
    return ()=>{
        badge.removeEventListener('pointerdown',onDown);
        badge.removeEventListener('pointermove',onMove);
        badge.removeEventListener('pointerup',onUp);
        badge.removeEventListener('pointercancel',onUp);
        badge.removeEventListener('keydown',onKey);
        window.removeEventListener('resize',onResize);
    };
}
const EMPTY_HTML=`<p class="oracle-lead">Chiedimi quello che vuoi: una regola, una carta, un’avventura.</p><div class="oracle-suggests">${EXAMPLES.map(([glyph,label,prompt])=>`<button type="button" data-example="${esc(prompt)}"><span class="oracle-suggest-glyph" aria-hidden="true">${glyph}</span><span>${esc(label)}</span></button>`).join('')}</div>`;

export function showOracle(container,options={}){
    updateSidebarContext('oracle');
    let history=[],busy=false,disposed=false;
    const controller=new AbortController();
    container.innerHTML=`<main class="entry-page community-page oracle-console"><header class="oracle-bar"><button type="button" class="oracle-icon-btn" data-home aria-label="Torna alla Taverna">←</button><p class="oracle-bar-title">L’Oracolo</p><span class="oracle-badge" role="button" tabindex="0" aria-label="Oracolo: trascinalo con il dito o spostalo con le frecce"><span class="oracle-puppet" aria-hidden="true">${PUPPET}</span></span></header><section id="oracle-chat" class="oracle-chat" role="log" aria-label="Conversazione con l’Oracolo" aria-live="polite">${EMPTY_HTML}</section><button type="button" id="oracle-clear" class="oracle-clear" hidden>Nuova conversazione</button><form class="oracle-composer"><label class="oracle-field"><span class="oracle-field-label">La tua domanda</span><textarea name="prompt" rows="1" maxlength="3000" required placeholder="Chiedi all’Oracolo">${esc(options.prompt||'')}</textarea></label><div class="oracle-composer-row"><label class="oracle-attach"><span class="oracle-attach-glyph" aria-hidden="true">+</span><span class="oracle-sr">Allega la foto di una carta (facoltativa, fino a 2 MB)</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label><button type="submit" class="oracle-send" aria-label="Invia la domanda">↑</button></div><p id="oracle-status" class="community-status oracle-status" role="status"></p></form></main>`;
    const root=container.firstElementChild,form=root.querySelector('form'),status=root.querySelector('#oracle-status'),stream=root.querySelector('#oracle-chat'),textarea=form.elements.prompt,clearButton=root.querySelector('#oracle-clear');
    const releaseBadge=makeBadgeDraggable(root.querySelector('.oracle-badge'));
    const showEmpty=()=>{stream.innerHTML=EMPTY_HTML;bindExamples();clearButton.hidden=true;};
    const addMessage=(role,text)=>{
        stream.querySelectorAll('.oracle-lead, .oracle-suggests').forEach(el=>el.remove());
        const article=document.createElement('article');
        article.className='oracle-msg';article.dataset.role=role;
        const body=document.createElement('div');body.className='oracle-msg-body';
        if(role==='assistant'){
            // L'Oracolo risponde in Markdown: grassetti, elenchi e tabelle diventano carta da taverna.
            body.classList.add('oracle-md');body.innerHTML=renderOracleMarkdown(text);
        }else{
            // Le domande restano testo semplice: solo i link HTTPS diventano cliccabili.
            const expression=/https?:\/\/[^\s<>"\])]+/g;let start=0;
            for(const match of text.matchAll(expression)){body.append(document.createTextNode(text.slice(start,match.index)));const link=document.createElement('a');link.textContent=match[0];link.href=safeUrl(match[0]);link.target='_blank';link.rel='noopener noreferrer';body.append(link);start=match.index+match[0].length;}
            body.append(document.createTextNode(text.slice(start)));
        }
        article.append(body);
        stream.append(article);
        stream.scrollTop=stream.scrollHeight;
        clearButton.hidden=false;
    };
    function bindExamples(){root.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{textarea.value=b.dataset.example;textarea.focus();});}
    bindExamples();
    root.querySelector('[data-home]').onclick=()=>navigateTo('home',container);
    clearButton.onclick=()=>{if(busy)return;history=[];showEmpty();status.textContent='Conversazione svuotata.';textarea.focus();};
    form.onsubmit=async event=>{
        event.preventDefault();if(busy||!form.reportValidity())return;
        busy=true;const button=form.querySelector('[type=submit]');button.disabled=true;clearButton.disabled=true;status.textContent='L’Oracolo sta consultando i suoi appunti…';
        try{
            const prompt=textarea.value.trim(),file=form.elements.image.files[0],image=file?await readOracleImage(file):undefined;
            const result=await postOracle('/api/oracle/chat',{prompt,image,history},{signal:controller.signal});
            if(disposed)return;
            void recordActivity('oracle_answered');
            addMessage('user',prompt+(file?'\n[Foto allegata]':''));addMessage('assistant',result.reply);
            history.push({role:'user',content:prompt},{role:'assistant',content:result.reply});history=history.slice(-8);
            textarea.value='';form.elements.image.value='';status.textContent=formatOracleQuota(result.remaining);
            textarea.focus();
        }catch(error){if(!disposed)status.textContent=error.message;}
        finally{busy=false;if(!disposed){button.disabled=false;clearButton.disabled=false;}}
    };
    window.__communityCleanup=()=>{disposed=true;controller.abort();history=[];releaseBadge();};
}
