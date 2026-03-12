import{r as c,s}from"./index-D1JVwJSC.js";function u(r){document.title="LaTaverna - Registrati";const e=r.querySelector(".login-container")||r;e.innerHTML=`
    <div class="login-header">
      <h2>Registrati</h2>
    </div>
    <div class="form-group">
      <label for="username">Username</label>
      <input type="text" id="username" placeholder="Inserisci il tuo username" required />
    </div>
    <div class="form-group">
      <label for="email">Email</label>
      <input type="email" id="email" placeholder="Inserisci la tua email" required />
    </div>
    <div class="form-group">
      <label for="password">Password</label>
      <input type="password" id="password" placeholder="Inserisci la tua password" required />
    </div>
    <div class="checkbox-group">
      <input type="checkbox" id="gdpr" />
      <label for="gdpr">Accetto i termini GDPR</label>
    </div>
    <button class="btn" id="register-btn">Registrati</button>
    <div class="footer">
      Hai già un account? <a href="#" id="toLogin">Login</a>
    </div>
    <p id="message" class="message"></p>
  `;const t=e.querySelector("#message");e.querySelector("#register-btn").onclick=async()=>{const i=e.querySelector("#username").value.trim(),o=e.querySelector("#email").value.trim(),l=e.querySelector("#password").value,a=e.querySelector("#gdpr").checked;if(!a){t.textContent="Devi accettare i termini.";return}try{await c({email:o,password:l,username:i,gdprAccepted:a}),t.textContent="Account creato! Reindirizzamento...",setTimeout(()=>s(r),1e3)}catch(n){t.textContent=n.message||"Errore registrazione"}},e.querySelector("#toLogin").onclick=i=>{i.preventDefault(),document.title="LaTaverna - Login",s(r)}}export{u as showRegister};
