/**
 * GESTIONE LIVELLI INFINITI - LA TAVERNA
 * Salva i progressi nel browser e genera la UI "a scala" per i minigiochi.
 */

// Recupera il livello massimo raggiunto (parte da 1)
export function getUnlockedLevel(gameName) {
    const level = localStorage.getItem(`taverna_${gameName}_level`);
    return level ? parseInt(level) : 1;
}

// Sblocca il livello successivo se il giocatore ha battuto il suo record
export function unlockNextLevel(gameName, currentLevel) {
    const maxLevel = getUnlockedLevel(gameName);
    if (currentLevel >= maxLevel) {
        localStorage.setItem(`taverna_${gameName}_level`, currentLevel + 1);
    }
}

// Genera i bottoni a "Scala" (il più alto è luminoso, i vecchi sono trasparenti)
export function renderLevelLadder(gameName, containerElement, onLevelSelect) {
    containerElement.innerHTML = '';
    const maxLevel = getUnlockedLevel(gameName);

    // Creiamo la scala: partiamo dal più alto (che starà in cima) scendendo fino all'1
    for (let i = maxLevel; i >= 1; i--) {
        const btn = document.createElement('button');
        btn.className = 'game-btn-action';
        btn.innerText = `LIVELLO ${i}`;
        btn.style.width = '100%';
        btn.style.marginBottom = '10px';
        btn.style.transition = 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
        btn.style.flexShrink = '0';

        if (i === maxLevel) {
            // Lo scalino nuovo: evidenziato e luminoso
            btn.style.background = 'var(--accent-gradient)';
            btn.style.border = 'none';
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = '0 0 20px var(--amethyst-glow)';
            btn.style.zIndex = '2';
        } else {
            // Gli scalini vecchi battuti: opachi, trasparenti e leggermente rimpiccioliti
            btn.style.opacity = '0.4';
            btn.style.background = 'rgba(255,255,255,0.02)';
            btn.style.border = '1px solid rgba(255,255,255,0.1)';
            btn.style.transform = 'scale(0.95)';
        }

        // Effetto hover per far capire che sono tutti cliccabili
        btn.onmouseenter = () => { if(i !== maxLevel) btn.style.opacity = '0.8'; };
        btn.onmouseleave = () => { if(i !== maxLevel) btn.style.opacity = '0.4'; };

        btn.onclick = (e) => {
            e.preventDefault();
            onLevelSelect(i); // Callback per avviare il gioco con il livello scelto
        };

        containerElement.appendChild(btn);
    }
}