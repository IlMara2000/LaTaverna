import { account } from '../services/appwrite.js';
import { showDashboard } from './dashboard.js';

/**
 * Visualizza la schermata di Login
 * @param {HTMLElement} container - Il contenitore UI principale
 */
export function showLogin(container) {
    document.title = "LaTaverna - Accesso";
    
    // Rendering HTML con struttura ottimizzata per il CSS Glassmorphism
    container.innerHTML = `
        <div class="glass-box">
            <h2 style="text-align:center; margin-bottom:25px; letter-spacing:3px; font-weight:900;">ACCEDI</h2>
            
            <div id="login-msg" style="margin-bottom:15px; font-size:14px; min-height:22px; text-align:center; font-weight:600;"></div>
            
            <form id="login-form">
                <div class="form-group">
                    <input type="email" id="email" placeholder="Email" required autocomplete="email" />
                </div>
                <div class="form-group">
                    <input type="password" id="password" placeholder="Password" required autocomplete="current-password" />
                </div>
                
                <button type="submit" class="btn-primary" id="login-submit">ENTRA NELLA TAVERNA</button>
                
                <div style="text-align:center; margin: 20px 0; color: rgba(255,255,255,0.2); font-size: 11px; letter-spacing:2px;">OPPURE</div>
                
                <button type="button" id="discord-login" style="width:100%; padding:16px; background:#5865F2; border:none; border-radius:16px; color:white; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px;">
                    <span style="font-size:1.2rem;">👾</span> LOGIN CON DISCORD
                </button>
                
                <div style="text-align:center; margin-top:30px; font-size:14px; color:#ccc;">
                    Nuovo viandante? <a id="toRegister" style="color:#a953ec; cursor:pointer; font-weight:bold; text-decoration:none; margin-left:5px;">Registrati qui</a>
                </div>
            </form>
        </div>
    `;

    const msg = container.querySelector('#login-msg');
    const form = container.querySelector('#login-form');

    // --- LOGICA LOGIN EMAIL/PASSWORD ---
    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = container.querySelector('#email').value.trim();
        const password = container.querySelector('#password').value;
        const btn = container.querySelector('#login-submit');

        // Feedback visivo immediato
        msg.style.color = "#a953ec";
        msg.textContent = "Verifica in corso...";
        btn.disabled = true;
        btn.style.opacity = "0.7";

        try {
            // Tentativo di login
            await account.createEmailPasswordSession(email, password);
            const user = await account.get();
            
            msg.style.color = "#00ff88";
            msg.textContent = "Accesso autorizzato!";
            
            // Transizione alla Dashboard
            setTimeout(() => showDashboard(container, user), 800);
            
        } catch (err) {
            btn.disabled = false;
            btn.style.opacity = "1";
            msg.style.color = "#ff4444";
            
            // Messaggi di errore user-friendly
            if (err.type === 'user_invalid_credentials') {
                msg.textContent = "Email o password errate.";
            } else {
                msg.textContent = "Errore di connessione. Riprova.";
            }
            console.error("Login Error:", err);
        }
    };

    // --- LOGICA DISCORD ---
    container.querySelector('#discord-login').onclick = () => {
        const redirect = window.location.origin; 
        // Nota: Assicurati che l'URL di redirect sia autorizzato su Appwrite Console
        account.createOAuth2Session('discord', redirect, redirect);
    };

    // --- SPOSTAMENTO A REGISTRAZIONE ---
    // Uso l'import dinamico per evitare il crash dei file che si importano a vicenda
    container.querySelector('#toRegister').onclick = async (e) => {
        e.preventDefault();
        try {
            const { showRegister } = await import('./register.js');
            showRegister(container);
        } catch (err) {
            console.error("Errore nel caricamento della registrazione:", err);
        }
    };
}
