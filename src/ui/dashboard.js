export function showDashboard(container,user){

container.innerHTML = `

<div class="dashboard">

<div class="card account">

<div class="avatar">${user.username[0]}</div>

<div class="info">
<div class="name">${user.username}</div>
<div class="email">${user.email}</div>
</div>

</div>

<div class="card menu">

<button>🏠 Dashboard</button>
<button>📝 Note di Viaggio</button>
<button>👥 Personaggi</button>
<button>⚙️ Opzioni</button>

</div>

</div>

`;

}
