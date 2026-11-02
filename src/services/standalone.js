const standaloneDisplay = window.matchMedia('(display-mode: standalone)');
const syncDisplayMode = () => {
    document.documentElement.classList.toggle('standalone-app', standaloneDisplay.matches || window.navigator.standalone === true);
};
syncDisplayMode();
standaloneDisplay.addEventListener('change', syncDisplayMode);
window.addEventListener('pageshow', syncDisplayMode);

const syncVisualViewportVars = () => {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const offsetTop = viewport?.offsetTop || 0;
    document.documentElement.style.setProperty('--visual-viewport-height', `${height}px`);
    document.documentElement.style.setProperty('--visual-viewport-top', `${offsetTop}px`);
};

syncVisualViewportVars();
window.addEventListener('resize', syncVisualViewportVars, { passive: true });
window.addEventListener('orientationchange', () => {
    window.setTimeout(syncVisualViewportVars, 80);
}, { passive: true });
window.visualViewport?.addEventListener('resize', syncVisualViewportVars, { passive: true });
window.visualViewport?.addEventListener('scroll', syncVisualViewportVars, { passive: true });
