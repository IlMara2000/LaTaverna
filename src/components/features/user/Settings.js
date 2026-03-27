export function showSettings(container) {
    container.innerHTML = `
        <div class="fade-in" style="padding: 20px; max-width: 600px; margin: 0 auto;">
            <button onclick="window.location.reload()" style="background:none; border:none; color:var(--amethyst-bright); cursor:pointer; margin-bottom:20px; font-size:12px; font-weight:800;">← TORNA ALLA LIBRERIA</button>
            
            <h1 style="font-weight: 900; letter-spacing: -1px; margin-bottom: 30px;">IMPOSTAZIONI</h1>
            
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <span>Effetti Grafici (Glow)</span>
                    <input type="checkbox" checked style="accent-color: var(--amethyst-bright);">
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <span>Notifiche Lancio Dadi</span>
                    <input type="checkbox" checked style="accent-color: var(--amethyst-bright);">
                </div>
                <p style="text-align:center; opacity:0.3; font-size:11px; margin-top:20px;">Versione App: 1.1.0 - La Taverna VTT</p>
            </div>
        </div>
    `;
}
