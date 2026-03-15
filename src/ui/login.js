import { account } from "../services/appwrite.js"

import { showDashboard } from "./dashboard.js"
import { showRegister } from "./register.js"

export function showLogin(container){

document.title="Login - La Taverna"

container.innerHTML=`

<div class="glass-box">

<h2>Accedi alla Taverna</h2>

<div id="login-msg"></div>

<form id="login-form">

<input type="email" id="email" placeholder="Email" required>

<input type="password" id="password" placeholder="Password" required>

<button class="btn">
Entra nella Taverna
</button>

</form>

<div class="divider">
<span>oppure</span>
</div>

<button id="discord-login" class="btn-alt">
Entra con Discord
</button>

<button id="btn-register" class="btn-alt">
Crea Personaggio
</button>

</div>
`

const msg=document.getElementById("login-msg")

document.getElementById("login-form")
.onsubmit=async e=>{

e.preventDefault()

try{

await account.createEmailPasswordSession(

email.value,
password.value

)

const user=await account.get()

showDashboard(container,user)

}catch(err){

msg.textContent=err.message

}

}

document.getElementById("discord-login")
.onclick=async()=>{

await account.createOAuth2Session(

"discord",
window.location.origin,
window.location.origin

)

}

document.getElementById("btn-register")
.onclick=()=>showRegister(container)

}