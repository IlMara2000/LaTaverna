import { databases, client } from '@services/appwrite.js';

const DB_ID = '69a867cc0018c0a6d700';
const COL_ID = 'tokens';

export function showTabletop(container) {
    document.title = "LaTaverna - Tavolo da Gioco";
    
    const style = document.createElement('style');
    style.innerHTML = `
        .token {
            position: absolute;
            border-radius: 50%;
            cursor: move;
            pointer-events: auto;
            z-index: 100;
            transition: border 0.3s ease, box-shadow 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 4px solid #a953ec;
            background-size: cover;
            background-position: center;
            background-color: #222;
        }
        .token:hover {
            filter: brightness(1.2);
            box-shadow: 0 0 15px rgba(169, 83, 236, 0.8);
        }
        .token-hp {
            position: absolute;
            bottom: -22px;
            background: rgba(10, 5, 20, 0.9);
            color: #00ff88;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            white-space: nowrap;
            border: 1px solid rgba(255,255,255,0.1);
            pointer-events: none;
        }
        #token-editor {
            position: fixed;
            right: 20px;
            top: 20px;
            width: 220px;
            background: rgba(15, 6, 23, 0.98);
            border: 1px solid #a953ec;
            padding: 20px;
            border-radius: 16px;
            color: white;
            display: none;
            z-index: 10000;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            backdrop-filter: blur(10px);
        }
        .editor-field { margin-bottom: 15px; }
        .editor-field label { display: block; font-size: 12px; color: #aaa; margin-bottom: 5px; }
        .editor-field input { 
            width: 100%; background: rgba(255,255,255,0.05); border: 1px solid #333; 
            color: white; padding: 8px; border-radius: 6px; outline: none;
        }
        .editor-field input:focus { border-color: #a953ec; }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <div class="vtt-container" style="display: flex; height: 100vh; width: 100vw; overflow: hidden; background: #050505; position: fixed; top: 0; left: 0;">
            
            <div id="token-editor">
                <h3 id="edit-name" style="margin: 0 0 20px 0; color: #a953ec;">Nome Token</h3>
                
                <div class="editor-field">
                    <label>Immagine (URL)</label>
                    <input type="text" id="edit-asset" placeholder="https://image.url/png">
                </div>

                <div class="editor-field">
                    <label>HP Attuali</label>
                    <input type="number" id="edit-hp">
                </div>

                <div class="editor-field">
                    <label>Colore Aura</label>
                    <input type="color" id="edit-color">
                </div>

                <button id="save-token" class="btn" style="width:100%; background: #a953ec; padding: 10px;">Salva</button>
                <button id="close-editor" style="background:none; border:none; color:gray; cursor:pointer; margin-top:15px; width:100%; font-size:12px;">Annulla</button>
            </div>

            <div id="map-viewport" style="flex: 1; position: relative; overflow: hidden; cursor: grab;">
                <div id="map-container" style="position: absolute; transform-origin: 0 0;">
                    <img src="https://www.cartographersguild.com/attachment.php?attachmentid=101373&d=1510141019" style="display: block; pointer-events: none; min-width: 3000px;" />
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

    const openEditor = (doc) => {
        currentTokenId = doc.$id;
        document.getElementById('edit-name').textContent = doc.name;
        document.getElementById('edit-hp').value = doc.hp_current;
        document.getElementById('edit-color').value = doc.color || '#a953ec';
        document.getElementById('edit-asset').value = doc.asset_id || '';
        editor.style.display = 'block';
    };

    document.getElementById('save-token').onclick = async () => {
        const hp = parseInt(document.getElementById('edit-hp').value);
        const color = document.getElementById('edit-color').value;
        const asset = document.getElementById('edit-asset').value;
        
        await databases.updateDocument(DB_ID, COL_ID, currentTokenId, { 
            hp_current: hp, 
            color: color,
            asset_id: asset
        });
        editor.style.display = 'none';
    };

    document.getElementById('close-editor').onclick = () => editor.style.display = 'none';

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
        el.style.boxShadow = `0 0 10px ${doc.color}55`; // Aura sfumata
        el.style.left = `${doc.x}px`;
        el.style.top = `${doc.y}px`;
        
        // Se c'è un URL immagine, lo applichiamo
        if(doc.asset_id) {
            el.style.backgroundImage = `url('${doc.asset_id}')`;
        } else {
            el.style.backgroundImage = 'none';
        }

        document.getElementById(`hp-${doc.$id}`).textContent = `${doc.name}: ${doc.hp_current}/${doc.hp_max}`;
    }

    function setupTokenDrag(el, doc) {
        let isDragging = false;
        
        el.onmousedown = (e) => {
            if(e.button === 0) {
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

    client.subscribe(`databases.${DB_ID}.collections.${COL_ID}.documents`, res => {
        if (res.events.some(e => e.includes('.update') || e.includes('.create'))) {
            renderToken(res.payload);
        }
    });

    viewport.onwheel = (e) => {
        e.preventDefault();
        scale = e.deltaY < 0 ? scale * 1.1 : scale / 1.1;
        scale = Math.min(Math.max(0.2, scale), 4);
        mapContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    };

    const res = await databases.listDocuments(DB_ID, COL_ID);
    res.documents.forEach(renderToken);
}
