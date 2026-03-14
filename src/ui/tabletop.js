// src/ui/tabletop.js

export function showTabletop(container) {
  document.title = "LaTaverna - Tavolo da Gioco";

  container.innerHTML = `
    <div class="vtt-container" style="display: flex; h-screen; overflow: hidden; background: #050505;">
      
      <div class="sidebar" style="width: 60px; background: rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; align-items: center; padding: 20px 0; gap: 20px;">
        <button title="Muovi" style="background: none; border: none; color: #a953ec; cursor: pointer; font-size: 20px;">🖐️</button>
        <button title="Token" style="background: none; border: none; color: white; cursor: pointer; font-size: 20px;">👤</button>
        <button id="btn-logout-vtt" style="margin-top: auto; background: none; border: none; color: #ff4444; cursor: pointer;">🚪</button>
      </div>

      <div id="map-viewport" style="flex: 1; position: relative; overflow: hidden; cursor: grab;">
        <div id="map-container" style="position: absolute; transform-origin: 0 0; transition: transform 0.1s ease-out;">
          <img id="map-img" src="https://www.cartographersguild.com/attachment.php?attachmentid=101373&d=1510141019" style="display: block; user-select: none; pointer-events: none;" />
          
          <div id="token-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></div>
        </div>
      </div>

    </div>
  `;

  initMapLogic();
}

function initMapLogic() {
  const viewport = document.getElementById('map-viewport');
  const mapContainer = document.getElementById('map-container');
  
  let scale = 1;
  let isDragging = false;
  let startX, startY, translateX = 0, translateY = 0;

  // ZOOM con la rotellina
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 0.1;
    if (e.deltaY < 0) scale += zoomSpeed;
    else scale = Math.max(0.2, scale - zoomSpeed);
    
    updateTransform();
  });

  // PAN (Spostamento mappa)
  viewport.addEventListener('mousedown', (e) => {
    isDragging = true;
    viewport.style.cursor = 'grabbing';
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateTransform();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    viewport.style.cursor = 'grab';
  });

  function updateTransform() {
    mapContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }

  // Logout rapido
  document.getElementById('btn-logout-vtt').onclick = () => window.location.reload();
}
