/**
 * LO SCIPPATORE: mano guantata, occhi da triglia e carta rubata.
 * L'SVG è inline per poter cambiare espressione e animare i singoli pezzi.
 */

const EYES = {
    felice: `
        <ellipse cx="100" cy="145" rx="15" ry="18" fill="#f6edd9"/>
        <ellipse cx="154" cy="145" rx="15" ry="18" fill="#f6edd9"/>
        <circle cx="104" cy="148" r="7" fill="#141018"/>
        <circle cx="158" cy="148" r="7" fill="#141018"/>
        <circle cx="106" cy="145" r="2.4" fill="#fff"/>`,
    arrabbiata: `
        <path d="M82 132 L118 142" stroke="#141018" stroke-width="7" stroke-linecap="round"/>
        <path d="M172 132 L136 142" stroke="#141018" stroke-width="7" stroke-linecap="round"/>
        <ellipse cx="102" cy="151" rx="11" ry="12" fill="#ff3d7f"/>
        <ellipse cx="152" cy="151" rx="11" ry="12" fill="#ff3d7f"/>
        <circle cx="102" cy="152" r="4" fill="#141018"/>
        <circle cx="152" cy="152" r="4" fill="#141018"/>`,
    scioccata: `
        <circle cx="100" cy="145" r="21" fill="#f6edd9" stroke="#141018" stroke-width="5"/>
        <circle cx="154" cy="145" r="21" fill="#f6edd9" stroke="#141018" stroke-width="5"/>
        <circle cx="100" cy="145" r="7" fill="#141018"/>
        <circle cx="154" cy="145" r="7" fill="#141018"/>`,
    umiliata: `
        <path d="M84 150 Q100 132 116 150" fill="none" stroke="#141018" stroke-width="6" stroke-linecap="round"/>
        <path d="M138 150 Q154 132 170 150" fill="none" stroke="#141018" stroke-width="6" stroke-linecap="round"/>
        <path d="M62 122 Q70 140 62 154 Q52 138 62 122" fill="#63e3ff"/>`,
    esaltata: `
        <path d="M100 125 L106 140 L122 142 L110 152 L113 168 L100 159 L87 168 L90 152 L78 142 L94 140 Z" fill="#d9ff3f" stroke="#141018" stroke-width="4"/>
        <path d="M154 125 L160 140 L176 142 L164 152 L167 168 L154 159 L141 168 L144 152 L132 142 L148 140 Z" fill="#d9ff3f" stroke="#141018" stroke-width="4"/>`,
    disperata: `
        <circle cx="100" cy="145" r="17" fill="#f6edd9"/>
        <circle cx="154" cy="145" r="17" fill="#f6edd9"/>
        <path d="M91 145 Q100 132 109 145 Q100 158 91 145" fill="none" stroke="#141018" stroke-width="4"/>
        <path d="M145 145 Q154 132 163 145 Q154 158 145 145" fill="none" stroke="#141018" stroke-width="4"/>
        <path d="M82 165 Q74 192 84 202 Q94 190 88 168" fill="#63e3ff"/>
        <path d="M172 165 Q180 192 170 202 Q160 190 166 168" fill="#63e3ff"/>`
};

const MOUTHS = {
    felice: `<path d="M96 184 Q122 206 158 178" fill="none" stroke="#141018" stroke-width="8" stroke-linecap="round"/><path d="M102 188 Q120 196 146 184" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
    arrabbiata: `<path d="M98 198 Q122 174 156 196" fill="none" stroke="#141018" stroke-width="8" stroke-linecap="round"/><path d="M114 194 L120 202 M132 190 L138 198" stroke="#f6edd9" stroke-width="4" stroke-linecap="round"/>`,
    scioccata: `<ellipse cx="128" cy="194" rx="19" ry="24" fill="#141018"/><ellipse cx="128" cy="203" rx="11" ry="9" fill="#ff3d7f"/>`,
    umiliata: `<path d="M100 198 Q112 188 124 198 Q136 208 150 196" fill="none" stroke="#141018" stroke-width="7" stroke-linecap="round"/>`,
    esaltata: `<path d="M92 182 Q128 226 166 180 Z" fill="#141018"/><path d="M106 196 Q128 214 152 194" fill="#ff3d7f"/><path d="M104 184 L108 194 L120 188 L128 198 L138 188 L150 196 L156 184" fill="#fff"/>`,
    disperata: `<path d="M98 202 Q112 186 126 202 Q140 218 156 198" fill="none" stroke="#141018" stroke-width="7" stroke-linecap="round"/>`
};

const LABELS = {
    felice: 'Lo Scippatore ride male',
    arrabbiata: 'Lo Scippatore è furioso',
    scioccata: 'Lo Scippatore è scioccato',
    umiliata: 'Lo Scippatore è umiliato',
    esaltata: 'Lo Scippatore esulta',
    disperata: 'Lo Scippatore è disperato'
};

export const SCIPPO_MASCOT_EXPRESSIONS = Object.keys(EYES);

export function scippoMascot(expression = 'felice', className = '') {
    const face = EYES[expression] ? expression : 'felice';
    return `
        <svg class="sc-mascot ${className}" data-expression="${face}" viewBox="0 0 256 280" role="img" aria-label="${LABELS[face]}">
            <g class="sc-mascot-stolen" aria-hidden="true">
                <rect x="154" y="26" width="84" height="118" rx="10" transform="rotate(13 196 85)" fill="#d9ff3f" stroke="#07060a" stroke-width="7"/>
                <rect x="164" y="38" width="64" height="94" rx="6" transform="rotate(13 196 85)" fill="none" stroke="#07060a" stroke-width="3" stroke-dasharray="5 5"/>
                <text x="196" y="92" transform="rotate(13 196 85)" text-anchor="middle" font-family="Bangers, Impact, sans-serif" font-size="38" fill="#141018">SC!</text>
            </g>
            <g class="sc-mascot-hand" aria-hidden="true">
                <rect x="47" y="91" width="25" height="75" rx="12" fill="#f6edd9" stroke="#07060a" stroke-width="8"/>
                <rect x="76" y="64" width="27" height="106" rx="13" fill="#f6edd9" stroke="#07060a" stroke-width="8"/>
                <rect x="108" y="55" width="27" height="115" rx="13" fill="#f6edd9" stroke="#07060a" stroke-width="8"/>
                <rect x="140" y="68" width="26" height="102" rx="13" fill="#f6edd9" stroke="#07060a" stroke-width="8"/>
                <rect x="166" y="94" width="24" height="76" rx="12" fill="#f6edd9" stroke="#07060a" stroke-width="8"/>
                <path d="M52 146 Q130 172 194 146 L198 226 Q128 250 48 226 Z" fill="#f6edd9" stroke="#07060a" stroke-width="8" stroke-linejoin="round"/>
                <path d="M48 226 Q128 250 198 226 L198 252 Q128 274 48 252 Z" fill="#ff3d7f" stroke="#07060a" stroke-width="8" stroke-linejoin="round"/>
                <path d="M64 218 Q128 236 182 216" fill="none" stroke="#07060a" stroke-width="4" opacity=".35"/>
            </g>
            <g class="sc-mascot-face" aria-hidden="true">
                ${EYES[face]}
                ${MOUTHS[face]}
                <path d="M86 116 Q128 102 170 116" fill="none" stroke="#141018" stroke-width="4" opacity=".25"/>
            </g>
            <g class="sc-mascot-spark" aria-hidden="true">
                <path d="M30 74 L36 88 L50 90 L40 100 L42 114 L30 106 L18 114 L20 100 L10 90 L24 88 Z" fill="#ff3d7f"/>
                <path d="M222 196 L226 206 L238 208 L230 216 L232 228 L222 221 L212 228 L214 216 L206 208 L218 206 Z" fill="#63e3ff"/>
            </g>
        </svg>
    `;
}

export function mascotForOutcome(outcome) {
    if (outcome === 'win') return 'esaltata';
    if (outcome === 'loss') return 'umiliata';
    if (outcome === 'draw') return 'scioccata';
    return 'felice';
}

export function mascotForTurn(turn, seat = 0) {
    if (!turn) return 'felice';
    if (turn.winnerSeat === null) return 'scioccata';
    if (turn.winnerSeat === seat) return turn.scippo ? 'esaltata' : 'felice';
    return turn.scippo ? 'disperata' : 'arrabbiata';
}
