let globalAudio = new Audio();
globalAudio.loop = true;

// Gestione Toggle ON/OFF
window.addEventListener('musicToggled', (e) => {
    const shouldPlay = e.detail;
    if (shouldPlay && globalAudio.src) {
        globalAudio.play().catch(err => console.log("Interazione richiesta per play"));
    } else {
        globalAudio.pause();
    }
});

// Gestione Caricamento nuovo file
window.addEventListener('musicUploaded', (e) => {
    const { url } = e.detail;
    
    globalAudio.pause();
    globalAudio.src = url;
    
    // Suona solo se la musica è impostata su ON
    if (localStorage.getItem('taverna_music') !== 'off') {
        globalAudio.play();
    }
});