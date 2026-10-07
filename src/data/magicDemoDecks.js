import callingAllAngels from './magic-demo-decks/calling-all-angels.txt?raw';
import counterBlitz from './magic-demo-decks/counter-blitz-final-fantasy-x.txt?raw';
import tramplesaurusRex from './magic-demo-decks/tramplesaurus-rex.txt?raw';
import multiversoRiforgiato from './magic-demo-decks/multiverso-riforgiato.txt?raw';

export const MAGIC_DEMO_DECKS = [
    { name: 'Calling All Angels', commander: 'Giada, Font of Hope', source: callingAllAngels },
    { name: 'Counter Blitz · Final Fantasy X', commander: "Tidus, Yuna's Guardian", source: counterBlitz },
    { name: 'Tramplesaurus Rex', commander: 'Ghalta, Primal Hunger', source: tramplesaurusRex },
    { name: 'Multiverso Riforgiato', commander: 'Jace, Multiverse Architect', source: multiversoRiforgiato }
];
