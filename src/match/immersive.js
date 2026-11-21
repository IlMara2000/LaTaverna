/**
 * Ingresso/uscita dal modo immersivo (fullscreen + lock orizzontale).
 *
 * Riscritto nell'idioma del progetto (moduli .js) a partire dal piano
 * pacchetto.md §1 (immersive.ts). Il lock dell'orientamento non è
 * disponibile su tutti i browser: in quel caso resta il gate di rotazione.
 */

// In alcuni browser incorporati (pannelli di anteprima, webview) la promessa di
// requestFullscreen non si risolve né si rifiuta mai: senza un limite il tavolo
// resta fermo prima ancora di preparare il mazzo e nessuna partita parte.
const settleWithin = (promise, ms) => Promise.race([
  Promise.resolve(promise).catch(() => false),
  new Promise(resolve => setTimeout(resolve, ms))
]);

export async function enterImmersive(element) {
  const target = element || document.documentElement;
  try {
    if (!document.fullscreenElement && target.requestFullscreen) {
      await settleWithin(target.requestFullscreen({ navigationUI: 'hide' }), 800);
    }
  } catch {
    return false;
  }
  try {
    const orientation = screen.orientation;
    // Anche il lock può restare appeso (browser incorporati): senza limite la
    // partita non parte pur essendo il tavolo già pronto.
    await settleWithin(Promise.resolve(orientation?.lock?.('landscape')), 800);
  } catch {
    /* il lock non è disponibile: resta il gate di rotazione */
  }
  return true;
}

export function exitImmersive() {
  if (!document.fullscreenElement) return;
  void document.exitFullscreen().catch(() => {});
}
