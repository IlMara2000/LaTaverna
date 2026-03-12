// Link Registrati SPA
const toRegisterLink = container.querySelector('#toRegister');
if (toRegisterLink) {
  toRegisterLink.onclick = (e) => {
    e.preventDefault();
    document.title = "LaTaverna - Registrati"; // Aggiorna titolo scheda
    import('./register.js').then(module => {
      module.showRegister(container);
    });
  };
}
const clientId = "1478809987357868083";

const redirectUri = encodeURIComponent(
"https://nyc.cloud.appwrite.io/v1/account/sessions/oauth2/callback/discord/69a85edc001553a4b931"
);

const scope = "identify%20email";

function loginWithDiscord() {

    const authUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;

    window.location.href = authUrl;
}

document
.getElementById("discord-login")
.addEventListener("click", loginWithDiscord);
