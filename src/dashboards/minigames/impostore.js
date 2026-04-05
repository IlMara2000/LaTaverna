function renderGameField(container) {
    const wrapper = container.querySelector('.impostore-wrapper');
    
    // --- CALCOLO DI CHI INIZIA LA DISCUSSIONE ---
    // Troviamo l'indice del primo impostore
    const impostorIndex = gameData.players.findIndex(p => p.role === 'impostor');
    
    // Troviamo chi sta "3 posti dopo" l'impostore (saltando a inizio lista se necessario)
    let starterIndex = 0;
    if (impostorIndex !== -1 && gameData.players.length >= 3) {
        starterIndex = (impostorIndex + 3) % gameData.players.length;
        
        // Se per caso c'è più di un impostore e il "terzo" capita di essere l'altro impostore,
        // andiamo avanti di uno finché non peschiamo un civile o un undercover
        while (gameData.players[starterIndex].role === 'impostor') {
            starterIndex = (starterIndex + 1) % gameData.players.length;
        }
    }
    const startingPlayerName = gameData.players[starterIndex].name;
    // ---------------------------------------------

    wrapper.innerHTML = `
        <div class="fade-in" style="flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 70vh;">
            <h1 class="main-title" style="font-size: 2.2rem; margin-bottom: 5px;">DISCUSSIONE</h1>
            <p style="opacity: 0.5; text-align: center; margin-bottom: 20px; font-size: 13px;">Parlate e votate chi eliminare!</p>
            
            <div style="background: rgba(157, 78, 221, 0.15); border: 1px solid var(--amethyst-bright); padding: 12px; border-radius: 12px; text-align: center; margin-bottom: 30px; box-shadow: 0 0 15px rgba(157, 78, 221, 0.2);">
                <span style="font-size: 11px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px;">Inizia la discussione:</span><br>
                <span style="font-size: 1.2rem; font-weight: 900; color: var(--text-primary); text-shadow: 0 0 10px var(--amethyst-glow);">${startingPlayerName}</span>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${gameData.players.map((p, i) => `
                    <div style="background: var(--glass-surface); padding: 15px 20px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--glass-border); box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                        <span style="font-weight: 700; font-size: 1.1rem;">${p.name}</span>
                        <button class="vote-btn" data-index="${i}" style="background: var(--amethyst-bright); border: none; color: white; padding: 10px 18px; border-radius: 12px; font-weight: 800; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px var(--amethyst-glow);">SVELA</button>
                    </div>
                `).join('')}
            </div>
            
            <div id="impostor-guess-panel" style="display: none; flex-direction: column; gap: 10px; margin-top: 20px; background: rgba(255, 65, 108, 0.1); border: 1px solid rgba(255, 65, 108, 0.3); padding: 20px; border-radius: 16px; animation: fadeInUp 0.4s ease-out;">
                <p style="text-align: center; font-weight: 800; font-size: 13px; color: #ff416c; margin: 0;">L'IMPOSTORE HA UN'ULTIMA CHANCE!</p>
                <p style="text-align: center; font-size: 11px; opacity: 0.7; margin: 0 0 10px 0;">Se indovina la parola segreta dei civili, ruba la vittoria.</p>
                <input type="text" id="impostor-guess-input" placeholder="Scrivi la parola qui..." style="width: 100%; padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.5); color: white; outline: none; font-size: 14px; font-family: 'Poppins', sans-serif;">
                <button id="submit-guess" class="btn-primary" style="background: #ff416c; box-shadow: 0 4px 15px rgba(255,65,108,0.4); border: none; margin-bottom: 0;">TENTA IL FURTO</button>
            </div>
            
            <button id="end-round" class="btn-primary" style="margin-top: 40px; background: var(--danger); border-color: var(--danger); border-left: 3px solid transparent; box-shadow: 0 4px 15px rgba(255, 68, 68, 0.4);">TERMINA PARTITA</button>
        </div>
    `;

    container.querySelectorAll('.vote-btn').forEach(btn => {
        btn.onclick = () => {
            const p = gameData.players[parseInt(btn.getAttribute('data-index'))];
            
            // Sostituiamo il tasto con il ruolo svelato
            btn.outerHTML = `<span style="font-weight: 900; color: ${p.role === 'impostor' ? '#ff416c' : (p.role === 'civil' ? '#00d2ff' : '#ffbd00')}">${p.role.toUpperCase()}</span>`;
            
            // FIX: Meccanica tentativo impostore
            if (p.role === 'impostor') {
                container.querySelector('#impostor-guess-panel').style.display = 'flex';
                // Disabilitiamo il pulsante di fine normale, ora bisogna passare dal tentativo
                container.querySelector('#end-round').style.display = 'none';
            }
        };
    });

    const submitGuessBtn = container.querySelector('#submit-guess');
    if (submitGuessBtn) {
        submitGuessBtn.onclick = () => {
            const guess = container.querySelector('#impostor-guess-input').value.trim().toLowerCase();
            const actualWord = gameData.wordObj.word.toLowerCase();
            
            if (guess === actualWord) {
                renderResult(container, true); // Impostore vince
            } else {
                renderResult(container, false); // Civili vincono
            }
        };
    }
    
    container.querySelector('#end-round').onclick = () => renderResult(container, null);
}
