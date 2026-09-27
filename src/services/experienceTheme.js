import { MINIGAMES } from './experienceCatalog.js';

// One shared art direction. Depth and destination are retained for restrained
// variations and game-specific ornaments, never a different visual language.
export function setExperienceTheme(destination, depth = 'catalog') {
    const game = MINIGAMES.find(item => item.id === destination);
    document.body.dataset.world = 'dark-fantasy';
    document.body.dataset.worldSection = game?.category || destination;
    document.body.dataset.worldDepth = destination === 'home' ? 'portal' : depth;
    document.body.dataset.worldGame = game?.id || '';
}
