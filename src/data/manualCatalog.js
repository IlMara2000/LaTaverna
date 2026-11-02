// Catalogo pubblico dei manuali: solo informazioni (metadati, argomenti,
// link ufficiali) e descrizioni scritte da noi. Nessun testo protetto da copyright.
// I PDF non sono e non saranno nel repository: la ricerca nel pannello "Regole"
// usa esclusivamente il SRD 5.1 con licenza aperta (vedi src/data/srd/ATTRIBUTION.md).

export const MANUAL_CATALOG = [
    {
        id: 'phb',
        title: 'Manuale del Giocatore',
        originalTitle: "Player's Handbook",
        edition: 'D&D 5ª edizione (2014)',
        publisher: 'Wizards of the Coast',
        covers: ['Razze', 'Classi', 'Incantesimi', 'Abilità', 'Equipaggiamento'],
        summary: 'Il punto di partenza per creare e far crescere un personaggio: razze, classi, '
            + 'caratteristiche, abilità, vantaggi e l’elenco degli incantesimi di base.',
        officialUrl: 'https://www.dndbeyond.com/sources/phb',
    },
    {
        id: 'dmg',
        title: 'Guida del Dungeon Master',
        originalTitle: "Dungeon Master's Guide",
        edition: 'D&D 5ª edizione (2014)',
        publisher: 'Wizards of the Coast',
        covers: ['Avventure', 'Tesori', 'Oggetti magici', 'Incontri', 'Regole opzionali'],
        summary: 'Gli strumenti per chi guida il gioco: costruire avventure e ambienti, '
            + 'bilanciare le sfide, assegnare tesori e usare le regole opzionali.',
        officialUrl: 'https://www.dndbeyond.com/sources/dmg',
    },
    {
        id: 'mm',
        title: 'Manuale dei Mostri',
        originalTitle: 'Monster Manual',
        edition: 'D&D 5ª edizione (2014)',
        publisher: 'Wizards of the Coast',
        covers: ['Mostri', 'Statistiche', 'Razze bestiali', 'Leggendari'],
        summary: 'Il bestiario ufficiale: statistiche, abilità e comportamenti dei mostri, '
            + 'dalle creature comuni ai boss leggendari.',
        officialUrl: 'https://www.dndbeyond.com/sources/mm',
    },
    {
        id: 'pf-gm',
        title: 'Guida del Maestro Pathfinder',
        originalTitle: 'Pathfinder Gamemastery Guide',
        edition: 'Pathfinder',
        publisher: 'Paizo',
        covers: ['Incontri', 'Tesori', 'Avventure', 'Regole di tavolo'],
        summary: 'La controparte Pathfinder per chi conduce la partita: consigli pratici, '
            + 'strumenti di preparazione e regole per gestire la tavola.',
        officialUrl: 'https://paizo.com/store/pathfinder',
    },
];

export const SRD_INFO = {
    label: 'SRD 5.1 (regole aperte)',
    description: 'Il System Reference Document 5.1 raccoglie le regole base di D&D 5ª edizione '
        + 'rilasciate in licenza Creative Commons BY 4.0: è il testo su cui basa le ricerche il pannello Regole.',
    officialUrl: 'https://www.dndbeyond.com/srd',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/legalcode',
};
