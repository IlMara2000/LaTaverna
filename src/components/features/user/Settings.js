export function showSettings(container) {
    container.innerHTML = `
        <div class="fade-in" style="padding: 20px; max-width: 600px; margin: 0 auto;">
            <button onclick="window.location.reload()" style="background:none; border:none; color:var(--amethyst-bright); cursor:pointer; margin-bottom:20px; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">← Torna alla Libreria</button>
            
            <h1 style="font-weight: 900; letter-spacing: -1px; margin-bottom: 30px;">IMPOSTAZIONI</h1>
            
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
                    <span>Effetti Grafici (Glow)</span>
                    <input type="checkbox" checked style="accent-color: var(--amethyst-bright); width:20px; height:20px;">
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
                    <span>Notifiche Lancio Dadi</span>
                    <input type="checkbox" checked style="accent-color: var(--amethyst-bright); width:20px; height:20px;">
                </div>
                <p style="text-align:center; opacity:0.3; font-size:11px; margin-top:20px; letter-spacing:1px;">VERSIONE APP: 1.1.0 - LA TAVERNA VTT</p>
            </div>
        </div>
    `;
}
