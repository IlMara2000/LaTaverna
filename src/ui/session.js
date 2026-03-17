import { databases, APPWRITE_CONFIG, account, storage } from '../services/appwrite.js';

const { dbId, collections, bucketId } = APPWRITE_CONFIG;

export async function showSession(container, sessionId) {
    let currentUser;
    try { 
        currentUser = await account.get(); 
    } catch (err) { 
        window.location.reload(); 
        return; 
    }

    // Struttura ottimizzata per Mobile & Desktop
    container.innerHTML = `
        <div class="session-container" style="display: flex; height: 100vh; width: 100vw; overflow: hidden; background: #0f0617; position: fixed; inset: 0;">
            
            <aside id="side-zaino" class="glass-box" style="width: 0; overflow: hidden; transition: 0.3s; border-right: 1px solid var(--accent); display: flex; flex-direction: column;">
                <div style="padding: 20px; min-width: 250px;">
                    <h3 style="color: var(--accent); margin-bottom:15px;">LO ZAINO 🎒</h3>
                    <div id="zaino-list" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;"></div>
                </div>
            </aside>

            <div class="main-game" style="flex-grow: 1; position: relative; overflow: auto; background-image: radial-gradient(rgba(169, 83, 236, 0.1) 1px, transparent 1px); background-size: 40px 40px;" id="game-viewport">
                
                <header class="glass-box" style="position: sticky; top: 10px; margin: 10px; z-index: 100; display: flex; justify-content: space-between; padding: 10px; align-items: center; border-radius: 12px;">
                    <div style="display:flex; gap: 8px;">
                        <button id="btnExit" class="sidebar-btn" style="width:auto; margin:0; padding: 8px 12px; font-size: 12px;">⬅</button>
                        <button id="toggleZaino" class="btn-primary" style="background: #444; border:none; padding: 8px 12px; font-size: 12px;">🎒</button>
                    </div>
                    <h2 id="sessTitle" style="margin:0; font-size:1rem; font-weight:900; text-transform: uppercase;">TAVOLO</h2>
                    <div id="status-info" style="font-size: 10px; color: #00ff00; font-weight: bold; letter-spacing: 1px;">● LIVE</div>
                </header>

                <div id="map-canvas" style="position: relative; min-width: 2500px; min-height: 2500px; touch-action: none;"></div>
            </div>

            <aside class="chat-sidebar glass-box" style="width: 300px; display: flex; flex-direction: column; border-left: 1px solid var(--accent); z-index: 110; background: rgba(15, 6, 23, 0.8);">
                <div id="chat-messages" style="flex-grow: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 8px;"></div>
                
                <div style="padding: 15px; border-top: 1px solid var(--glass-border);">
                    <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                        <button class="dice-btn" data-d="20" style="flex:1; background:var(--accent); border:none; border-radius:8px; color:white; padding: 8px; font-weight:bold;">d20</button>
                        <button class="dice-btn" data-d="6" style="flex:1; background:#333; border:none; border-radius:8px; color:white; padding: 8px; font-weight:bold;">d6</button>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <input type="text" id="chatInput" placeholder="/roll o scrivi..." style="flex-grow: 1; border-radius: 10px;">
                        <button id="btnSend" class="btn-primary" style="width: 50px; padding:0;">🎲</button>
                    </div>
                </div>
            </aside>
        </div>
    `;

    const mapCanvas = container.querySelector('#map-canvas');

    // --- FUNZIONE: RENDERIZZA TOKEN (Ottimizzata Touch) ---
    const renderToken = (token) => {
        let el = document.getElementById(`token-${token.$id}`);
        if (!el) {
            el = document.createElement('div');
            el.id = `token-${token.$id}`;
            el.className = 'token-element';
            el.style.position = 'absolute';
            el.style.width = '80px';
            el.style.zIndex = '10';
            el.style.textAlign = 'center';
            el.style.transition = 'transform 0.1s linear';
            
            el.innerHTML = `
                <div class="hp-container" style="width: 50px; height: 5px; background: #222; margin: 0 auto 4px auto; border-radius: 10px; border: 1px solid #000; overflow: hidden;">
                    <div id="hp-bar-${token.$id}" style="width: 100%; height: 100%; background: #2ecc71; transition: width 0.3s;"></div>
                </div>
                <div class="token-img-wrapper" style="width:60px; height:60px; margin:0 auto; border-radius:50%; border:3px solid var(--accent); overflow:hidden; background:#111; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                    <img src="${storage.getFilePreview(bucketId, token.image_id).href}" style="width:100%; height:100%; object-fit:cover;" draggable="false">
                </div>
                <div style="font-size:9px; background:rgba(0,0,0,0.7); color:white; padding:2px 6px; border-radius:10px; display:inline-block; margin-top:4px; font-weight:bold; white-space: nowrap;">${token.name}</div>
            `;
            mapCanvas.appendChild(el);

            // Logica Drag & Drop (Touch + Mouse)
            let isDragging = false;

            const startDrag = () => { isDragging = true; el.style.zIndex = '100'; el.style.cursor = 'grabbing'; };
            const endDrag = async (finalX, finalY) => {
                isDragging = false;
                el.style.zIndex = '10';
                await databases.updateDocument(dbId, collections.tokens, token.$id, {
                    x: parseInt(finalX),
                    y: parseInt(finalY)
                });
            };

            // Supporto Mouse
            el.onmousedown = (e) => {
                if (e.ctrlKey) return;
                startDrag();
                let sX = e.clientX - el.offsetLeft;
                let sY = e.clientY - el.offsetTop;
                document.onmousemove = (e) => {
                    if(!isDragging) return;
                    el.style.left = (e.clientX - sX) + 'px';
                    el.style.top = (e.clientY - sY) + 'px';
                };
                document.onmouseup = () => {
                    document.onmousemove = null;
                    endDrag(el.style.left, el.style.top);
                };
            };

            // Supporto Touch (per iPhone)
            el.ontouchmove = (e) => {
                if (e.touches.length > 1) return; // Ignora pinch-to-zoom
                const touch = e.touches[0];
                const rect = mapCanvas.getBoundingClientRect();
                const newX = touch.clientX - rect.left - 40;
                const newY = touch.clientY - rect.top - 40;
                el.style.left = newX + 'px';
                el.style.top = newY + 'px';
            };
            el.ontouchend = () => endDrag(el.style.left, el.style.top);

            // Click per HP (Ctrl+Click o Tap prolungato simulato)
            el.onclick = async (e) => {
                if (e.ctrlKey || e.metaKey) {
                    const newHp = Math.max(0, (token.hp || 10) - 1);
                    await databases.updateDocument(dbId, collections.tokens, token.$id, { hp: newHp });
                }
            };
        }

        // Sync Posizione e HP
        el.style.left = token.x + 'px';
        el.style.top = token.y + 'px';
        const hpPercent = ((token.hp || 10) / (token.max_hp || 10)) * 100;
        const bar = document.getElementById(`hp-bar-${token.$id}`);
        if(bar) {
            bar.style.width = hpPercent + '%';
            bar.style.background = hpPercent < 30 ? '#ff4444' : hpPercent < 60 ? '#ffbb33' : '#00c851';
        }
    };

    // Gestione uscita e UI
    container.querySelector('#btnExit').onclick = () => window.location.reload();
    
    const sideZaino = container.querySelector('#side-zaino');
    container.querySelector('#toggleZaino').onclick = () => {
        sideZaino.style.width = sideZaino.style.width === '0px' ? '280px' : '0px';
    };

    // Inizializzazione completata (Qui andranno le sottoscrizioni realtime di Appwrite)
}