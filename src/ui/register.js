import { account } from '@services/appwrite.js'
import { showLogin } from '@ui/login.js'

export function showRegister(container){

document.title="LaTaverna - Registrati"

container.innerHTML=`

<div class="glass-box">

<h2>REGISTRATI</h2>

<form id="register-form">

<input id="reg-username" placeholder="Username" required>

<input id="reg-email" type="email" placeholder="Email" required>

<input id="reg-password" type="password" placeholder="Password" required>

<button class="btn">Crea Account</button>

</form>

<button id="btn-login">Hai già un account?</button>

</div>

`

document
.getElementById("register-form")
.addEventListener("submit",async e=>{

e.preventDefault()

try{

await account.create(
"unique()",
reg_email.value,
reg_password.value,
reg_username.value
)

showLogin(container)

}catch(err){

alert(err.message)

}

})

document.getElementById("btn-login")
.onclick=()=>showLogin(container)

}