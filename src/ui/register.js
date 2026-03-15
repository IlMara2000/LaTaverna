import { account } from "../services/appwrite.js"

import { showLogin } from "./login.js"

export function showRegister(container){

document.title="Registrazione - La Taverna"

container.innerHTML=`

<div class="glass-box">

<h2>Crea Personaggio</h2>

<div id="reg-msg"></div>

<form id="register-form">

<input id="reg-username" placeholder="Nome Avventuriero" required>

<input id="reg-email" type="email" placeholder="Email" required>

<input id="reg-password" type="password" placeholder="Password" required>

<button class="btn">
Crea Personaggio
</button>

</form>

<div class="divider">
<span>oppure</span>
</div>

<button id="btn-login" class="btn-alt">
Hai già un account?
</button>

</div>
`

const msg=document.getElementById("reg-msg")

document.getElementById("register-form")
.onsubmit=async e=>{

e.preventDefault()

try{

await account.create(

"unique()",
reg_email.value,
reg_password.value,
reg_username.value

)

msg.textContent="Personaggio creato!"

setTimeout(()=>{

showLogin(container)

},1500)

}catch(err){

msg.textContent=err.message

}

}

document.getElementById("btn-login")
.onclick=()=>showLogin(container)

}