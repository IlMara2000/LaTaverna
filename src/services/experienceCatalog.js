export const MINIGAME_CATEGORIES = [
    {
        id: 'cards',
        name: 'Carte classiche',
        description: 'Partite rapide, tradizione e un pizzico di competizione.'
    },
    {
        id: 'party',
        name: 'Giochi da compagnia',
        description: 'Perfetti quando siete in gruppo e volete iniziare subito.'
    },
    {
        id: 'strategy',
        name: 'Strategia',
        description: 'Per chi preferisce leggere il tavolo e pianificare ogni mossa.'
    }
];

export const MINIGAMES = [
    {id:'scala40',name:'Scala quaranta',category:'cards',icon:'♣',players:'1 giocatore · contro l’Oste',duration:'15–30 min',description:'Tris, scale e un’apertura da 40 punti. Una smazzata contro l’Oste.',color:'linear-gradient(135deg, #174f44, #092920)',initFn:'initScala40'},
    {
        id: 'briscola',
        name: 'Briscola',
        category: 'cards',
        icon: '♠️',
        players: '1–2 giocatori · online',
        duration: '5-10 min',
        description: '40 carte e 120 punti: sfida un amico online oppure l’Oste in locale.',
        color: 'linear-gradient(135deg, #2a0a4a, #4a1a6a)',
        initFn: 'initBriscola'
    },
    {
        id: 'scopa',
        name: 'Scopa',
        category: 'cards',
        icon: '♦️',
        players: '1–2 giocatori · online',
        duration: '10-20 min',
        description: 'Online o contro l’Oste: scope, primiera e settebello fino a 11 punti.',
        color: 'linear-gradient(135deg, #174f44, #092920)',
        initFn: 'initScopa'
    },
    {
        id: 'solitario',
        name: 'Solitario',
        category: 'cards',
        icon: '♥️',
        players: '1–8 giocatori · online',
        duration: '5-20 min',
        description: 'Klondike con 52 carte da poker: completa i quattro semi dall’Asso al Re.',
        color: 'linear-gradient(135deg, #20385f, #111b36)',
        initFn: 'initSolitario'
    },
    {
        id: 'solo',
        name: 'Solo',
        category: 'cards',
        icon: '🃏',
        players: '1–8 giocatori · online',
        duration: '10-20 min',
        description: 'Colori, combo e livelli sempre piu impegnativi.',
        color: 'linear-gradient(135deg, #ff4444, #ffcc00)',
        initFn: 'initSoloGame'
    },
    {
        id: 'burraco',
        name: 'Burraco',
        category: 'cards',
        icon: '♣️',
        players: '1–2 giocatori · online',
        duration: '15-25 min',
        description: 'Costruisci combinazioni e chiudi prima dell avversario.',
        color: 'linear-gradient(135deg, #004d40, #00241a)',
        initFn: 'initBurraco'
    },
    {
        id: 'impostore',
        name: 'Impostore',
        category: 'party',
        icon: '🕵️‍♂️',
        players: '3–8 giocatori · online',
        duration: '5-15 min',
        description: 'Scoprite chi sta bluffando prima che sia troppo tardi.',
        color: 'linear-gradient(135deg, #ff3366, #330011)',
        initFn: 'initImpostore'
    },
    {
        id: 'numeri',
        name: 'Numeri',
        category: 'party',
        icon: '🔢',
        players: '2–8 giocatori · online',
        duration: '5-10 min',
        description: 'Un gioco immediato per sfidarsi senza preparazione.',
        color: 'linear-gradient(135deg, #0f766e, #134e4a)',
        initFn: 'initNumeri'
    },
    {
        id: 'tictactoe',
        name: 'Tic Tac Toe',
        category: 'party',
        icon: '❌',
        players: '1-2 giocatori',
        duration: '2-8 min',
        description: 'Tris espandibile con bot, locale e online.',
        color: 'linear-gradient(135deg, #2b1055, #0f766e)',
        initFn: 'initTicTacToe'
    },
    {
        id: 'scacchi',
        name: 'Scacchi',
        category: 'strategy',
        icon: '♟️',
        players: '1–2 giocatori · online',
        duration: '10-30 min',
        description: 'La sfida piu pura per chi ama pensare qualche mossa avanti.',
        color: 'linear-gradient(135deg, #333333, #000000)',
        initFn: 'initScacchi'
    },
    {
        id: 'dama', name: 'Dama', category: 'strategy', icon: '◉',
        players: '1–2 giocatori · online', duration: '10–20 min',
        description: 'Pedine e catture: contro un amico online oppure il bot in locale.',
        color: 'linear-gradient(135deg, #333333, #000000)', initFn: 'initDama'
    },
    {
        id: 'blocchi',
        name: 'ARCANEUM (TETRIS)',
        category: 'strategy',
        icon: '▦',
        players: '1–8 giocatori · online',
        duration: '5-20 min',
        description: 'Incastra i blocchi, completa le righe e domina la caduta.',
        color: 'linear-gradient(145deg, #37105d, #101b3f 58%, #07111b)',
        initFn: 'initBlocchi'
    }
];

export const APP_DESTINATIONS = {
    multiplayer:{name:'Multiplayer',description:'Un collegamento per tutta la Taverna.'},
    mtcg:{name:'MTCG',description:'Magic e strumenti per il tavolo.'},
    proxyPrinter:{name:'MTG Proxy Printer',description:'Prepara i fogli da stampare.'},
    cardGames: {name:'Giochi di carte',description:'I classici da giocare.'},
    cards: {name:'Carte',description:'I classici da giocare.'},
    rpg: {name:'Giochi di ruolo',description:'D&D e avventure con l’Oracolo.'},
    oracle: {name:'L’Oracolo',description:'Carte, regole e videogiochi.'},
    magic: {name:'Magic / MTG',description:'Collezione e mazzi.'},
    cardCounter: { name: 'Segnapunti carte', description: 'Vite, premi e segnalini per il tuo tavolo.' },
    reading: {
        name: 'Lettura',
        description: 'Libri PDF, bacheca e raccolte personali.'
    },
    minigames: {
        name: 'Minigiochi',
        description: 'Giochi da compagnia e strategia.'
    },
    dnd5e: {
        name: 'Dungeons & Dragons',
        description: 'Campagne, personaggi e sessioni D&D 5e.'
    },
    shop: {
        name: 'Bottega del Viandante',
        description: 'Accessori, merchandise e creazioni della community.'
    }
};

export const getCategory = (categoryId) => (
    MINIGAME_CATEGORIES.find(category => category.id === categoryId) || null
);

export const getGamesByCategory = (categoryId = 'all') => (
    categoryId === 'all'
        ? MINIGAMES
        : MINIGAMES.filter(game => game.category === categoryId)
);
