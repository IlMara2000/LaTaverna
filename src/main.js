window.onerror = function(message, source, lineno, colno, error) {
    alert("ERRORE RILEVATO: " + message + "\nIn: " + source + " riga: " + lineno);
  };
  // src/main.js
  import './style.css'
  import { showLogin } from './ui/login.js'
  import { showDashboard } from './ui/dashboard.js'
  import { setupDiscordRedirect } from './services/redirectDiscord.js'
  import { account } from './services/appwrite.js'
  
  const uiContainer = document.getElementById('ui')
  
  async function initApp() {
      if (!uiContainer) {
          console.error("Container #ui non trovato")
          return
      }
  
      // 1. GESTIONE DISCORD
      try {
          await setupDiscordRedirect(uiContainer)
      } catch (e) {
          console.warn("Discord redirect non riuscito o non necessario:", e)
      }
  
      // 2. CONTROLLO SESSIONE
      let user = null
      try {
          user = await account.get()
      } catch (err) {
          console.log("Nessun utente rilevato.")
      }
  
      // 3. SCHERMATA PORTALE (Percorso corretto: /assets/logo.png)
      uiContainer.innerHTML = `
          <div class="entry-container" id="entry-screen">
              <div class="main-logo-wrapper" id="enter-portal">
                  <img src="/assets/logo.png" 
                       alt="La Taverna" 
                       id="main-logo"
                       style="display: block;"
                       onerror="this.onerror=null; this.src='https://via.placeholder.com/150?text=Logo+Error'; console.error('Logo non trovato in /assets/logo.png');">
              </div>
              <p class="tap-instruction">Tocca la Coppa per Entrare!</p>
          </div>
          <div id="content-overlay" style="display:none; opacity:0; width:100%;"></div>
      `
  
      const entryScreen = document.getElementById('entry-screen')
      const portal = document.getElementById('enter-portal')
      const contentOverlay = document.getElementById('content-overlay')
  
      if (portal) {
          portal.onclick = async () => {
              portal.style.pointerEvents = 'none'
  
              // Animazione fluida
              entryScreen.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s ease'
              entryScreen.style.opacity = '0'
              entryScreen.style.transform = 'scale(0.95)'
  
              setTimeout(() => {
                  entryScreen.style.display = 'none'
                  contentOverlay.style.display = 'block'
  
                  if (user && user.$id) {
                      showDashboard(contentOverlay, user)
                  } else {
                      showLogin(contentOverlay)
                  }
  
                  setTimeout(() => {
                      contentOverlay.style.transition = 'opacity 0.5s ease'
                      contentOverlay.style.opacity = '1'
                  }, 50)
              }, 600)
          }
      }
  }
  
  initApp().catch(err => {
      console.error("Errore fatale:", err)
      // Se crasha tutto, almeno mostriamo un messaggio
      if(uiContainer) uiContainer.innerHTML = `<p style="color:white; text-align:center;">Errore nel caricamento della Taverna.</p>`;
  })