import { MINIGAMES } from './experienceCatalog.js';

// The amethyst palette remains global. These attributes select only the material
// and immersion of the current destination; every entry resets the previous one.
const worlds = {
    home: 'home', dnd5e: 'manuscript', reading: 'bohemian', shop: 'prism',
    minigames: 'clay', all: 'clay', cards: 'collage', party: 'clay', strategy: 'clay'
};

export function setExperienceTheme(destination, depth = 'catalog') {
    const game = MINIGAMES.find(item => item.id === destination);
    document.body.dataset.world = worlds[game?.category || destination] || 'amethyst';
    document.body.dataset.worldDepth = destination === 'home' ? 'portal' : depth;
    document.body.dataset.worldGame = game?.id || '';
}
