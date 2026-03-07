import { login } from '../services/auth.js';
import { checkAndRedirectDiscord } from '../services/redirectDiscord.js';

export function showLogin(container) {
  container.innerHTML = `
    <div>
      <h2>Login</h2>
      <input id="email" placeholder="email"/><br/>
      <input id="password" type="password" placeholder="password"/><br/>
      <button id="btnLogin">Login</button>
      <p>Oppure <a id="toRegister" href="#">registrati</a></p>
    </div>
  `;

  container.querySelector('#btnLogin').onclick = async () => {
    const email = container.querySelector('#email').value;
    const password = container.querySelector('#password').value;
    await login(email, password);
    await checkAndRedirectDiscord();
    container.innerHTML = '<p>Login OK — ora sei collegato (se Discord è ok)</p>';
  };

  container.querySelector('#toRegister').onclick = (e) => {
    e.preventDefault();
    import('./register.js').then(m => m.showRegister(container));
  };
}