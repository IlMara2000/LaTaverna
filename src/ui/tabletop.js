// src/ui/tabletop.js

export function showTabletop(container) {
  document.title = "LaTaverna - Tavolo da Gioco";

  container.innerHTML = `
    <div class="vtt-container" style="display: flex; height: 100vh; width: 100vw; overflow: hidden; background: #050505; position: fixed; top: 0; left: 0; z-index: 9999;">
      
      <div class="sidebar" style="width: 70px; background: rgba(15, 6, 23, 0.95); border-right: 1px solid rgba(169, 83, 236, 0.3); display: flex; flex-direction: column; align-items: center; padding: 20px 0; gap: 25px; z-index: 10;">
        <button id="tool-move" title="Sposta Mappa" style="background: #a953ec; border: none; color: white; cursor: pointer; font-size: 22px; width: 45px; height: 45px; border-radius: 10px;">🖐️</button>
        <button id="tool-token" title="Aggiungi Token" style="background: rgba(255,255,255,0.1); border: none; color: white; cursor: pointer; font-size: 22px; width: 45px; height: 45px; border-radius: 10px;">👤</button>
        <button id="btn-exit" title="Esci" style="margin-top: auto; background: none; border: none; color: #ff4444; cursor: pointer; font-size: 24px;">🚪</button>
      </div>

      <div id="map-viewport" style="flex: 1; position: relative; overflow: hidden; cursor: grab; touch-action: none;">
        <div id="map-container" style="position: absolute; transform-origin: 0 0; will-change: transform;">
          <img id="map-img" src="https://www.cartographersguild.com/attachment.php?attachmentid=101373&d=1510141019" 
               style="display: block; user-select: none; pointer-events: none; min-width: 2000px;" />
          
          <div id="token-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
        </div>
      </div>
    </div>
  `;

  initTabletopLogic();
}

function initTabletopLogic() {
  const viewport = document.getElementById('map-viewport');
  const mapContainer = document.getElementById('map-container');
  const tokenLayer = document.getElementById('token-layer');
  const btnExit = document.getElementById('btn-exit');
  
  let scale = 1;
  let translateX = 0, translateY = 0;
  let isDraggingMap = false;
  let startX, startY;

  // --- LOGICA ZOOM ---
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 0.1;
    const oldScale = scale;
    if (e.deltaY < 0) scale *= 1.1;
    else scale /= 1.1;
    scale = Math.min(Math.max(0.1, scale), 5);
    updateTransform();
  }, { passive: false });

  // --- LOGICA MOVIMENTO MAPPA (PAN) ---
  viewport.addEventListener('mousedown', (e) => {
    if (e.target === viewport || e.target.id === 'map-img') {
      isDraggingMap = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
      viewport.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingMap) {
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      updateTransform();
    }
  });

  window.addEventListener('mouseup', () => {
    isDraggingMap = false;
    viewport.style.cursor = 'grab';
  });

  function updateTransform() {
    mapContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }

  // --- LOGICA TOKEN (SPAWN & DRAG) ---
  viewport.addEventListener('dblclick', (e) => {
    // Calcola la posizione sulla mappa tenendo conto di zoom e spostamento
    const rect = viewport.getBoundingClientRect();
    const x = (e.clientX - rect.left - translateX) / scale;
    const y = (e.clientY - rect.top - translateY) / scale;
    createToken(x, y);
  });

  function createToken(x, y) {
    const token = document.createElement('div');
    token.className = 'token';
    token.style.cssText = `
      position: absolute;
      width: 50px;
      height: 50px;
      background: url('https://i.pinimg.com/originals/8a/3b/4d/8a3b4d666d6d84956322b7f32958047d.png') center/cover;
      border-radius: 50%;
      border: 3px solid #a953ec;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
      cursor: move;
      pointer-events: auto;
      left: ${x - 25}px;
      top: ${y - 25}px;
      z-index: 100;
      touch-action: none;
    `;

    // Drag del token
    let isTokenDragging = false;
    let tStartX, tStartY;

    token.addEventListener('mousedown', (e) => {
      e.stopPropagation(); // Evita di muovere la mappa
      isTokenDragging = true;
      const tRect = token.getBoundingClientRect();
      tStartX = (e.clientX / scale) - token.offsetLeft;
      tStartY = (e.clientY / scale) - token.offsetTop;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isTokenDragging) return;
      // Calcolo movimento relativo alla scala
      const newX = (e.clientX - translateX) / scale - (token.offsetWidth / 2);
      const newY = (e.clientY - translateY) / scale - (token.offsetHeight / 2);
      
      token.style.left = `${newX}px`;
      token.style.top = `${newY}px`;
    });

    window.addEventListener('mouseup', () => {
      isTokenDragging = false;
    });

    tokenLayer.appendChild(token);
  }

  btnExit.onclick = () => window.location.reload();
}
