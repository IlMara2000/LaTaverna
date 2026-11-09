import {esc,safeUrl} from './communityUi.js';

// L'Oracolo scrive in Markdown: qui lo trasformiamo in HTML sicuro.
// Niente HTML del modello: tutto il testo passa da esc() prima di essere impaginato.

const isSeparatorRow = line => /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line || '');

const cells = line => String(line).trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());

const inline = value => {
    const saved = [];
    const hold = html => `\u0000${saved.push(html) - 1}\u0000`;
    let text = esc(value).replace(/\u0000/g, '');
    // Codice e link prima di tutto: così i loro simboli non finiscono nel resto della formattazione.
    text = text.replace(/`([^`\n]+)`/g, (_, code) => hold(`<code>${code}</code>`));
    text = text.replace(/!\[([^\]]*)\]\([^)\s]*\)/g, '$1');
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
        const href = safeUrl(url.replace(/&amp;/g, '&'));
        return href ? hold(`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`) : label;
    });
    text = text.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[\s(])__([^\n]+?)__(?=[\s).,!?;:<]|$)/g, '$1<strong>$2</strong>');
    text = text.replace(/(^|[\s(])_(?!_)([^_\n]+?)_(?=[\s).,!?;:<]|$)/g, '$1<em>$2</em>');
    text = text.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
    text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    text = text.replace(/https?:\/\/[^\s<>"'\])]+/g, url => {
        const href = safeUrl(url.replace(/&amp;/g, '&'));
        return href ? hold(`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${url}</a>`) : url;
    });
    return text.replace(/\u0000(\d+)\u0000/g, (_, index) => saved[Number(index)] || '');
};

// Emoji contestuali: capiamo di che parla la risposta e decoriamo titoli e sezioni.
const TOPICS = [
    {emoji: '🃏', pattern: /\b(carte?|collezionabili|magic|mtg|pok[eé]mon|yu-?gi-?oh|one piece|mazzo|mana|rarit[aà]|stampa|oracle text)\b/i},
    {emoji: '🎲', pattern: /\b(d&d|dnd|5e|dadi?|d\d+d\d+|tiro salvezza|slot|incantesim\w*|classe armatura|punti ferita|iniziativa)\b/i},
    {emoji: '🗺️', pattern: /\b(avventur\w*|campagn\w*|scen[ae]|storia|narr\w*|missione|dungeon|master|compagno)\b/i},
    {emoji: '📖', pattern: /\b(regol[ae]|manual[ei]|srd|destrezza|costituzione|saggezza|carisma|intelligenza)\b/i}
];
const HEADING_EMOJI = [
    [/effett|descriz|risultat/i, '✨'],
    [/not[ae]|consigl|suggeriment|attenzion|error/i, '📝'],
    [/statistic|parametr|dettagl|scheda|caratteristic/i, '📊'],
    [/incantesim|magia|spell|scuola/i, '🔮'],
    [/combattiment|attacc|dann[oi]|difes/i, '⚔️'],
    [/iniziativ|turno|ordine/i, '🌀'],
    [/oggett|equipagg|inventari|tesoro/i, '🎒'],
    [/prezz|costo|valore|econom|vendit/i, '💰'],
    [/personagg|classe|razza|background|carriera/i, '🧝'],
    [/avventur|storia|scena|campagn|missione/i, '🗺️'],
    [/dado|dadi|tiro|prova/i, '🎲'],
    [/cart[ae]|mazz[oi]|rarit/i, '🃏'],
    [/regol|manual/i, '📖'],
    [/abil|livell|progress/i, '🌟']
];
const hasEmoji = value => /\p{Extended_Pictographic}/u.test(value);
const topicEmoji = text => (TOPICS.find(topic => topic.pattern.test(text)) || {emoji: '🕯️'}).emoji;
const decorateHeading = (text, fallback) => hasEmoji(text) ? text : `${(HEADING_EMOJI.find(([pattern]) => pattern.test(text)) || [null, fallback])[1]} ${text}`;

const buildList = (items, ordered) => {
    const root = [];
    const stack = [{level: -1, children: root}];
    for (const item of items) {
        while (stack.length > 1 && stack[stack.length - 1].level >= item.level) stack.pop();
        const node = {html: item.html, level: item.level, children: []};
        stack[stack.length - 1].children.push(node);
        stack.push(node);
    }
    const tag = ordered ? 'ol' : 'ul';
    const render = nodes => `<${tag}>${nodes.map(node => `<li>${node.html}${node.children.length ? render(node.children) : ''}</li>`).join('')}</${tag}>`;
    return render(root);
};

export function renderOracleMarkdown(value){
    const raw = String(value ?? '');
    const topic = topicEmoji(raw);
    const lines = raw.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    const startsBlock = index => {
        const line = lines[index] || '';
        return !line.trim()
            || /^\s*```/.test(line)
            || /^\s*#{1,6}\s+/.test(line)
            || /^\s*>/.test(line)
            || /^\s*[-*+•]\s+/.test(line)
            || /^\s*\d{1,3}[.)]\s+/.test(line)
            || /^\s*([-*_])(\s*\1){2,}\s*$/.test(line)
            || (line.includes('|') && isSeparatorRow(lines[index + 1] || ''));
    };
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }
        const fence = line.match(/^\s*```\s*([\w+-]*)/);
        if (fence) {
            const code = [];
            i++;
            while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
            i++;
            out.push(`<pre><code${fence[1] ? ` class="language-${esc(fence[1])}"` : ''}>${esc(code.join('\n'))}</code></pre>`);
            continue;
        }
        const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
        if (heading) {
            const level = Math.min(4, heading[1].length);
            out.push(`<h${level}>${inline(decorateHeading(heading[2].trim(), topic))}</h${level}>`);
            i++;
            continue;
        }
        if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
        // Una riga fatta solo di grassetto è una sezione: merita la sua emoji.
        const lead = line.match(/^\s*\*\*((?:(?!\*\*).)+)\*\*\s*$/) || line.match(/^\s*__((?:(?!__).)+)__\s*$/);
        if (lead) {
            out.push(`<p class="oracle-md-sub"><strong>${inline(decorateHeading(lead[1].trim(), topic))}</strong></p>`);
            i++;
            continue;
        }
        if (line.includes('|') && isSeparatorRow(lines[i + 1] || '')) {
            const header = cells(line);
            i += 2;
            const rows = [];
            while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(cells(lines[i++]));
            const width = Math.max(header.length, ...rows.map(row => row.length), 1);
            const rowHtml = row => `<tr>${Array.from({length: width}, (_, index) => `<td>${inline(row[index] || '')}</td>`).join('')}</tr>`;
            out.push(`<div class="oracle-table-wrap"><table><thead><tr>${Array.from({length: width}, (_, index) => `<th>${inline(header[index] || '')}</th>`).join('')}</tr></thead>${rows.length ? `<tbody>${rows.map(rowHtml).join('')}</tbody>` : ''}</table></div>`);
            continue;
        }
        if (/^\s*>/.test(line)) {
            const quoted = [];
            while (i < lines.length && /^\s*>/.test(lines[i])) quoted.push(lines[i++].replace(/^\s*>\s?/, ''));
            out.push(`<blockquote><p>${quoted.map(entry => inline(entry)).join('<br>')}</p></blockquote>`);
            continue;
        }
        const bullet = line.match(/^(\s*)[-*+•]\s+(.*)$/);
        const numbered = line.match(/^(\s*)\d{1,3}[.)]\s+(.*)$/);
        if (bullet || numbered) {
            const ordered = Boolean(numbered && !bullet);
            const pattern = ordered ? /^(\s*)\d{1,3}[.)]\s+(.*)$/ : /^(\s*)[-*+•]\s+(.*)$/;
            const items = [];
            while (i < lines.length) {
                const match = lines[i].match(pattern);
                if (!match) break;
                items.push({level: Math.min(2, Math.floor(match[1].replace(/\t/g, '  ').length / 2)), html: inline(match[2])});
                i++;
                // Le righe rientrate che seguono un punto restano nello stesso punto.
                while (i < lines.length && lines[i].trim() && !startsBlock(i) && /^\s{2,}\S/.test(lines[i])) {
                    items[items.length - 1].html += `<br>${inline(lines[i].trim())}`;
                    i++;
                }
            }
            out.push(buildList(items, ordered));
            continue;
        }
        const paragraph = [];
        while (i < lines.length && !startsBlock(i)) paragraph.push(inline(lines[i++].trim()));
        out.push(`<p>${paragraph.join('<br>')}</p>`);
    }
    return out.join('');
}
