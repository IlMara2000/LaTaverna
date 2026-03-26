import { supabase, SUPABASE_CONFIG } from '../../../services/supabase.js';

const buckets = SUPABASE_CONFIG?.buckets || { zaino: 'zaino' };

export async function showAssets(container) {
    let files = [];
    
    container.innerHTML = `
        <div class="dashboard-content" style="display: flex; justify-content: center; align-items: center; height: 100vh;">
            <p style="opacity:0.5; letter-spacing:2px; font-size: 12px;">APRENDO LO ZAINO... 🎒</p>
        </div>
    `;

    try {
        const { data, error } = await supabase.storage.from(buckets.zaino).list();
        if (error) throw error;
        files = data || [];
    } catch (err) { 
        console.error("Errore zaino:", err);
    }

    container.innerHTML = `
        <div class="dashboard-content" style="display: flex; flex-direction: column; align-items: center; width: 100%; height: 100vh; overflow-y: auto; padding-top: 40px;">
            <div style="width: 100%; max-width: 400px; padding: 0 20px; display: flex; flex-direction: column; gap: 30px; padding-bottom: 100px;">
                
                <header style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h1 style="font-size: 1.8rem; font-weight: 900; margin:0;">LO ZAINO 🎒</h1>
                        <p style="font-size: 10px; opacity: 0.5; margin:0; text-transform: uppercase; letter-spacing: 1px;">Equipaggiamento & Mappe</p>
                    </div>
                    <button id="assetBack" class="sidebar-btn" style="width:auto; margin:0; padding:8px 15px; font-size:12px; border-radius:100px;">ESCI</button>
                </header>

                <div class="glass-box" style="text-align:center; padding: 20px; border-style: dashed; border-width: 2px;">
                    <p id="uploadMsg" style="font-size: 12px; margin-bottom: 15px; opacity: 0.7;">Nuovo oggetto?</p>
                    <input type="file" id="fileInput" style="display:none;" accept="image/*,application/pdf">
                    <button id="btnUpload" class="btn-primary" style="width: 100%;">CARICA</button>
                </div>

                <div id="assetsGrid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    ${files.length === 0 ? `<p style="grid-column:1/-1; text-align:center; opacity:0.3;">Vuoto.</p>` : 
                    files.map(file => {
                        const isImg = ['png','jpg','jpeg','webp'].includes(file.name.split('.').pop().toLowerCase());
                        const url = supabase.storage.from(buckets.zaino).getPublicUrl(file.name).data.publicUrl;
                        return `
                            <div class="glass-box asset-card" style="padding: 10px; text-align:center;">
                                <div style="height: 100px; background: rgba(255,255,255,0.03); border-radius: 12px; display:flex; align-items:center; justify-content:center; margin-bottom:10px; overflow:hidden;">
                                    ${isImg ? `<img src="${url}" style="width:100%; height:100%; object-fit:cover;">` : `<span>📜</span>`}
                                </div>
                                <p style="font-size: 10px; overflow: hidden; text-overflow: ellipsis;">${file.name}</p>
                            </div>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    container.querySelector('#assetBack').onclick = () => window.location.reload();
    const btnUpload = container.querySelector('#btnUpload');
    const fileInput = container.querySelector('#fileInput');
    
    if (btnUpload) btnUpload.onclick = () => fileInput.click();
    if (fileInput) {
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const fileName = `${Math.random().toString(36).substring(7)}_${file.name}`;
                await supabase.storage.from(buckets.zaino).upload(fileName, file);
                showAssets(container);
            } catch (err) { alert(err.message); }
        };
    }
}