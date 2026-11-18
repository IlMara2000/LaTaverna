/**
 * Ingresso/uscita dal modo immersivo (fullscreen + lock orizzontale).
 *
 * Riscritto nell'idioma del progetto (moduli .js) a partire dal piano
 * pacchetto.md §1 (immersive.ts). Il lock dell'orientamento non è
 * disponibile su tutti i browser: in quel caso resta il gate di rotazione.
 */

export async function enterImmersive(element) {
  const target = element || document.documentElement;
  try {
    if (!document.fullscreenElement && target.requestFullscreen) {
      await target.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch {
    return false;
  }
  try {
    const orientation = screen.orientation;
    await orientation?.lock?.('landscape');
  } catch {
    /* il lock non è disponibile: resta il gate di rotazione */
  }
  return true;
}

export function exitImmersive() {
  if (!document.fullscreenElement) return;
  void document.exitFullscreen().catch(() => {});
}
