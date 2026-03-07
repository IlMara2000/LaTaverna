import { register } from '../services/auth.js';

export function showRegister(container) {
  container.innerHTML = `
    <div>
      <h2>Register</h2>
      <input id="r_email" placeholder="email"/><br/>
      <input id="r_username" placeholder="username"/><br/>
      <input id="r_password" type="password" placeholder="password"/><br/>
      <label><input id="gdpr" type="checkbox"/> Accetto GDPR</label><br/>
      <button id="btnRegister">Registrati</button>
      <p><a id="toLogin" href="#">Torna al login</a></p>
    </div>
  `;

  container.querySelector('#btnRegister').onclick = async () => {
    const email = container.querySelector('#r_email').value;
    const username = container.querySelector('#r_username').value;
    const password = container.querySelector('#r_password').value;
    const gdpr = container.querySelector('#gdpr').checked;
    await register({ email, password, username, gdprAccepted: gdpr });
    container.innerHTML = '<p>Registrazione completata. Controlla la tua email se richiesto e fai login.</p>';
  };

  container.querySelector('#toLogin').onclick = (e) => {
    e.preventDefault();
    import('./login.js').then(m => m.showLogin(container));
  };
}