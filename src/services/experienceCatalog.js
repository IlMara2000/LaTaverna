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
    {
        id: 'briscola',
        name: 'Briscola',
        category: 'cards',
        icon: '⚔️',
        players: '1 giocatore',
        duration: '5-10 min',
        description: 'La classica sfida italiana contro il tavolo.',
        color: 'linear-gradient(135deg, #2a0a4a, #4a1a6a)',
        initFn: 'initBriscola'
    },
    {
        id: 'solo',
        name: 'Solo',
        category: 'cards',
        icon: '🃏',
        players: '1 giocatore',
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
        players: '1 giocatore',
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
        players: '3+ giocatori',
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
        players: '2+ giocatori',
        duration: '5-10 min',
        description: 'Un gioco immediato per sfidarsi senza preparazione.',
        color: 'linear-gradient(135deg, #0f766e, #134e4a)',
        initFn: 'initNumeri'
    },
    {
        id: 'scacchi',
        name: 'Scacchi',
        category: 'strategy',
        icon: '♟️',
        players: '1 giocatore',
        duration: '10-30 min',
        description: 'La sfida piu pura per chi ama pensare qualche mossa avanti.',
        color: 'linear-gradient(135deg, #333333, #000000)',
        initFn: 'initScacchi'
    }
];

export const APP_DESTINATIONS = {
    minigames: {
        name: 'Sala giochi',
        description: 'Carte, party game e strategia.'
    },
    dnd5e: {
        name: 'Dungeons & Dragons',
        description: 'Campagne, personaggi e sessioni D&D 5e.'
    },
    pathfinder2e: {
        name: 'Pathfinder 2e',
        description: 'Tavoli, personaggi e manuali Pathfinder.'
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
