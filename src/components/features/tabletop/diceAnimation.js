const getNaturalRoll = (rolls = [], mode = 'normal') => {
    if (!Array.isArray(rolls) || !rolls.length) return null;
    if (mode === 'adv') return Math.max(...rolls);
    if (mode === 'dis') return Math.min(...rolls);
    return rolls[0];
};

export const animateDiceRoll = ({
    display,
    die,
    faceValue,
    totalElement,
    breakdownElement,
    faces = 20,
    count = 1,
    rolls = [],
    total = 0,
    mode = 'normal',
    breakdown = '',
    random = Math.random,
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
} = {}) => {
    if (!display || !die || !faceValue || !totalElement || !breakdownElement) return null;

    const safeFaces = Math.max(2, Math.min(1000, Number(faces) || 20));
    const naturalRoll = getNaturalRoll(rolls, mode);
    const finalFace = count === 1 ? naturalRoll : rolls[rolls.length - 1];
    const settleDelay = reducedMotion ? 0 : 920;
    const randomFace = () => Math.floor(random() * safeFaces) + 1;

    display.setAttribute('aria-hidden', 'false');
    display.setAttribute('aria-busy', 'true');
    display.classList.remove('is-rolling', 'is-settled', 'is-critical', 'is-fumble');
    die.dataset.die = String(safeFaces);
    die.dataset.label = safeFaces === 100 ? 'd%' : `d${safeFaces}`;
    die.setAttribute('aria-label', `Dado da ${safeFaces} facce`);
    void display.offsetWidth;

    faceValue.textContent = String(randomFace());
    totalElement.textContent = '...';
    breakdownElement.textContent = `d${safeFaces === 100 ? '%' : safeFaces} in movimento`;
    display.classList.add('is-visible', 'is-rolling');

    window.clearInterval(display._valueTimer);
    window.clearTimeout(display._settleTimer);
    window.clearTimeout(display._rollTimer);
    if (!reducedMotion) {
        display._valueTimer = window.setInterval(() => {
            faceValue.textContent = String(randomFace());
        }, 64);
    }

    display._settleTimer = window.setTimeout(() => {
        window.clearInterval(display._valueTimer);
        faceValue.textContent = String(finalFace ?? total);
        totalElement.textContent = String(total);
        breakdownElement.textContent = breakdown;
        display.classList.remove('is-rolling');
        display.classList.add('is-settled');
        display.classList.toggle('is-critical', count === 1 && safeFaces === 20 && naturalRoll === 20);
        display.classList.toggle('is-fumble', count === 1 && safeFaces === 20 && naturalRoll === 1);
        display.setAttribute('aria-busy', 'false');
    }, settleDelay);

    display._rollTimer = window.setTimeout(() => {
        display.classList.remove('is-settled');
    }, settleDelay + 560);

    return { naturalRoll, finalFace, settleDelay };
};
