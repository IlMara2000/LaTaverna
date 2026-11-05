/**
 * Cartolina verticale 1080×1920 per storie social.
 * Non pubblica nulla: apre solo il foglio di condivisione nativo o scarica il PNG.
 */

const WIDTH = 1080;
const HEIGHT = 1920;

function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text || '').split(/\s+/);
    let line = '';
    let cursor = y;
    words.forEach(word => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, x, cursor);
            line = word;
            cursor += lineHeight;
        } else {
            line = test;
        }
    });
    if (line) ctx.fillText(line, x, cursor);
    return cursor;
}

function loadFonts() {
    if (!document.fonts?.load) return Promise.resolve();
    return Promise.all([
        document.fonts.load('400 190px Bangers'),
        document.fonts.load('800 40px Manrope')
    ]).catch(() => {});
}

function drawMascot(ctx, x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(-0.12);
    ctx.fillStyle = '#f6edd9';
    ctx.strokeStyle = '#07060a';
    ctx.lineWidth = 14;
    roundedRect(ctx, -150, -40, 300, 280, 105);
    ctx.fill();
    ctx.stroke();
    [-116, -58, 0, 58, 116].forEach((offset, index) => {
        const height = index === 0 || index === 4 ? 150 : 215;
        roundedRect(ctx, offset - 25, -height, 50, height + 100, 26);
        ctx.fill();
        ctx.strokeStyle = '#07060a';
        ctx.stroke();
    });
    ctx.fillStyle = '#ff3d7f';
    roundedRect(ctx, -154, 220, 308, 66, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f6edd9';
    [-55, 55].forEach(eye => {
        ctx.beginPath();
        ctx.arc(eye, 70, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });
    ctx.fillStyle = '#141018';
    [-45, 65].forEach(eye => {
        ctx.beginPath();
        ctx.arc(eye, 78, 15, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.strokeStyle = '#141018';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-75, 160);
    ctx.quadraticCurveTo(0, 220, 95, 145);
    ctx.stroke();
    ctx.restore();
}

export async function createScippoShareCard({
    outcome = 'draw',
    scores = [0, 0],
    modeLabel = 'SCIPPO!',
    message = '',
    url = 'https://lataverna.xyz/scippo',
    scippo = false
} = {}) {
    await loadFonts();
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas non disponibile.');

    const win = outcome === 'win';
    const loss = outcome === 'loss';
    const accent = win ? '#d9ff3f' : loss ? '#ff3d7f' : '#c084ff';

    ctx.fillStyle = '#08070b';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = ctx.createRadialGradient(WIDTH * 0.25, 260, 30, WIDTH * 0.25, 260, 900);
    glow.addColorStop(0, win ? '#d9ff3f55' : '#ff3d7f44');
    glow.addColorStop(1, '#08070b00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.translate(-80, 0);
    ctx.rotate(-0.18);
    ctx.fillStyle = '#ff3d7f18';
    for (let y = 0; y < HEIGHT; y += 130) ctx.fillRect(0, y, WIDTH + 200, 22);
    ctx.restore();

    ctx.strokeStyle = '#f6edd922';
    ctx.lineWidth = 6;
    roundedRect(ctx, 42, 42, WIDTH - 84, HEIGHT - 84, 54);
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.font = '800 28px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '8px';
    ctx.fillText(modeLabel.toUpperCase(), WIDTH / 2, 170);
    ctx.letterSpacing = '0px';

    ctx.save();
    ctx.translate(WIDTH / 2, 370);
    ctx.rotate(-0.035);
    ctx.textAlign = 'center';
    ctx.font = '400 235px Bangers, Impact, sans-serif';
    ctx.fillStyle = '#07060a';
    ctx.fillText('SCIPPO!', 12, 14);
    ctx.fillStyle = '#f6edd9';
    ctx.fillText('SCIPPO!', 0, 0);
    ctx.fillStyle = accent;
    ctx.font = '400 235px Bangers, Impact, sans-serif';
    ctx.fillText('!', 330, 0);
    ctx.restore();

    drawMascot(ctx, WIDTH / 2, 790, 1.45);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f6edd9';
    ctx.font = '400 150px Bangers, Impact, sans-serif';
    ctx.fillText(`${scores[0]} – ${scores[1]}`, WIDTH / 2, 1320);

    ctx.fillStyle = accent;
    ctx.font = '400 76px Bangers, Impact, sans-serif';
    const headline = win ? 'SCIPPO LEGALE.' : loss ? 'TI HANNO SCIPPATO.' : 'NESSUN VINCITORE.';
    ctx.fillText(headline, WIDTH / 2, 1425);

    ctx.fillStyle = '#e7d9f2';
    ctx.font = '800 34px Manrope, sans-serif';
    wrapText(ctx, message, WIDTH / 2, 1505, 820, 44);

    if (scippo) {
        ctx.save();
        ctx.translate(WIDTH / 2, 1580);
        ctx.rotate(-0.03);
        ctx.fillStyle = '#d9ff3f';
        ctx.font = '400 58px Bangers, Impact, sans-serif';
        ctx.fillText('SCIPPATA ×2', 0, 0);
        ctx.restore();
    }

    ctx.fillStyle = '#08070b';
    roundedRect(ctx, 90, 1660, WIDTH - 180, 150, 26);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = '800 24px Manrope, sans-serif';
    ctx.fillText('APRI IL LINK. PRENDI IL BOTTINO.', WIDTH / 2, 1712);
    ctx.fillStyle = '#f6edd9';
    ctx.font = '800 29px Manrope, sans-serif';
    ctx.fillText(url.replace(/^https?:\/\//, ''), WIDTH / 2, 1762);

    ctx.fillStyle = '#8f7f9c';
    ctx.font = '700 22px Manrope, sans-serif';
    ctx.fillText('LA TAVERNA · NESSUN PAY-TO-WIN', WIDTH / 2, 1850);

    return canvas;
}

export async function shareScippoResult(data = {}) {
    const canvas = await createScippoShareCard(data);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Immagine non creata.');
    const file = new File([blob], 'scippo-risultato.png', { type: 'image/png' });
    const text = `SCIPPO! ${data.scores?.[0] ?? 0}-${data.scores?.[1] ?? 0}. ${data.message || 'Rivincita?'} ${data.url || ''}`.trim();

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: 'SCIPPO!', text });
            return { method: 'share', blob };
        } catch (error) {
            if (error?.name === 'AbortError') return { method: 'cancelled', blob };
        }
    }

    if (navigator.share) {
        try {
            await navigator.share({ title: 'SCIPPO!', text, url: data.url });
            return { method: 'share-link', blob };
        } catch (error) {
            if (error?.name === 'AbortError') return { method: 'cancelled', blob };
        }
    }

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'scippo-risultato.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    return { method: 'download', blob };
}
