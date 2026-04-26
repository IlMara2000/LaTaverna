export function showProfile(container, user) {
    const escapeHTML = (value = '') => String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    const avatar = user?.user_metadata?.avatar_url || 'https://placehold.co/100x100?text=V';
    const name = escapeHTML(user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Viandante");
    const email = escapeHTML(user?.email || "Email non disponibile");

    container.innerHTML = `
        <div class="fade-in" style="padding: 20px; max-width: 600px; margin: 0 auto;">
            <button onclick="window.location.reload()" style="background:none; border:none; color:var(--amethyst-bright); cursor:pointer; margin-bottom:20px; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">← Torna alla Libreria</button>
            
            <h1 style="font-weight: 900; letter-spacing: -1px; margin-bottom: 30px;">IL MIO <span style="color:var(--amethyst-bright);">PROFILO</span></h1>
            
            <div style="background: rgba(157, 78, 221, 0.05); border: 1px solid var(--amethyst-glow); border-radius: 24px; padding: 40px; text-align: center; backdrop-filter: blur(10px);">
                <img src="${avatar}" style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid var(--amethyst-bright); margin-bottom: 20px; box-shadow: 0 0 20px var(--amethyst-glow);">
                <h2 style="margin: 0; text-transform: uppercase; letter-spacing: 1px;">${name}</h2>
                <p style="opacity: 0.5; font-size: 14px; margin-top: 5px;">${email}</p>
                
                <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-around;">
                    <div>
                        <span style="display:block; font-size: 20px; font-weight: 900; color: var(--amethyst-bright);">0</span>
                        <span style="font-size: 10px; opacity: 0.5; text-transform: uppercase;">Eroi Creati</span>
                    </div>
                    <div>
                        <span style="display:block; font-size: 20px; font-weight: 900; color: var(--amethyst-bright);">0</span>
                        <span style="font-size: 10px; opacity: 0.5; text-transform: uppercase;">Cronache</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}
