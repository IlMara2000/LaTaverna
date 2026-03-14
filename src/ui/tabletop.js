import { databases, client } from '@services/appwrite.js';

const DB_ID = '69a867cc0018c0a6d700';
const COL_ID = 'tokens';

export function showTabletop(container) {
    document.title = "LaTaverna - Tavolo da Gioco";
    
    // Stile per Token e Pannello
    const style = document.createElement('style');
    style.innerHTML = `
        .token {
            position: absolute;
            border-radius: 50%;
            cursor: move;
            pointer-events: auto;
            z-index: 100;
            transition: transform 0.1s linear;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid rgba(255,255,255,0.5);
            background-size: cover;
            background-position: center;
        }
        .token-hp {
            position: absolute;
            bottom: -20px;
            background: rgba(0,0,0,0.8);
            color: #00ff88;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            white-space: nowrap;
        }
        #token-editor {
            position: fixed;
            right: 20px;
            top: 20px;
            width: 200px;
            background: rgba(15, 6, 23, 0.95);
            border: 1px solid #a953ec;
            padding: 15px;
            border-radius: 12px;
            color: white;
            display: none;
            z-index: 10000;
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <div class="vtt-container" style="display: flex; height: 100vh; width: 100vw; overflow: hidden; background: #050505; position: fixed; top: 0; left: 0;">
            
            <div id="token-editor">
                <h3 id="edit-name" style="margin-top:0">Nome</h3>
                <label>HP Attuali</label>
                <input type="number" id="edit-hp" style="width:100%; margin-bottom:10px;">
                <label>Colore Cerchio</label>
                <input type="color" id="edit-color" style="width:100%; margin-bottom:15px;">
                <button id="save-token" class="btn" style="padding: 5px; font-size:12px;">Salva Modifiche</button>
                <button id="close-editor" style="background:none; border:none; color:gray; cursor:pointer; display:block; margin-top:10px; width:100%">Chiudi</button>
            </div>

            <div id="map-viewport" style="flex: 1; position: relative; overflow: hidden; cursor: grab;">
                <div id="map-container" style="position: absolute; transform-origin: 0 0;">
                    <img src="https://www.cartographersguild.com/attachment.php?attachmentid=101373&d=1510141019" style="display: block; pointer-events: none; min-width: 2500px;" />
                    <div id="token-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
                </div>
            </div>
        </div>
    `;

    initTabletopLogic();
}

async function initTabletopLogic() {
    const viewport = document.getElementById('map-viewport');
    const mapContainer = document.getElementById('map-container');
    const tokenLayer = document.getElementById('token-layer');
    const editor = document.getElementById('token-editor');
    
    let scale = 1, translateX = 0, translateY = 0, currentTokenId = null;

    // --- LOGICA EDITING ---
    const openEditor = (doc) => {
        currentTokenId = doc.$id;
        document.getElementById('edit-name').textContent = doc.name;
        document.getElementById('edit-hp').value = doc.hp_current;
        document.getElementById('edit-color').value = doc.color || '#a953ec';
        editor.style.display = 'block';
    };

    document.getElementById('save-token').onclick = async () => {
        const hp = parseInt(document.getElementById('edit-hp').value);
        const color = document.getElementById('edit-color').value;
        await databases.updateDocument(DB_ID, COL_ID, currentTokenId, { 
            hp_current: hp, 
            color: color 
        });
        editor.style.display = 'none';
    };

    document.getElementById('close-editor').onclick = () => editor.style.display = 'none';

    // --- RENDERING ---
    function renderToken(doc) {
        let el = document.getElementById(`token-${doc.$id}`);
        if (!el) {
            el = document.createElement('div');
            el.id = `token-${doc.$id}`;
            el.className = 'token';
            el.innerHTML = `<div class="token-hp" id="hp-${doc.$id}"></div>`;
            tokenLayer.appendChild(el);
            setupTokenDrag(el, doc);
        }
        
        el.style.width = `${doc.size}px`;
        el.style.height = `${doc.size}px`;
        el.style.borderColor = doc.color || '#a953ec';
        el.style.left = `${doc.x}px`;
        el.style.top = `${doc.y}px`;
        document.getElementById(`hp-${doc.$id}`).textContent = `${doc.name}: ${doc.hp_current}/${doc.hp_max}`;
        
        if(doc.asset_id) el.style.backgroundImage = `url(${doc.asset_id})`;
    }

    function setupTokenDrag(el, doc) {
        let isDragging = false;
        
        el.onmousedown = (e) => {
            if(e.button === 0) { // Click sinistro per drag
                isDragging = true;
                e.stopPropagation();
            }
        };

        el.onclick = (e) => {
            e.stopPropagation();
            openEditor(doc);
        };

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const x = (e.clientX - translateX) / scale - (el.offsetWidth / 2);
            const y = (e.clientY - translateY) / scale - (el.offsetHeight / 2);
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
        });

        window.addEventListener('mouseup', async () => {
            if (!isDragging) return;
            isDragging = false;
            await databases.updateDocument(DB_ID, COL_ID, doc.$id, {
                x: parseInt(el.style.left),
                y: parseInt(el.style.top)
            });
        });
    }

    // --- REALTIME ---
    client.subscribe(`databases.${DB_ID}.collections.${COL_ID}.documents`, res => {
        if (res.events.some(e => e.includes('.update') || e.includes('.create'))) {
            renderToken(res.payload);
        }
    });

    // Zoom & Pan
    viewport.onwheel = (e) => {
        e.preventDefault();
        scale = e.deltaY < 0 ? scale * 1.1 : scale / 1.1;
        mapContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    };

    // Caricamento iniziale
    const res = await databases.listDocuments(DB_ID, COL_ID);
    res.documents.forEach(renderToken);
}
