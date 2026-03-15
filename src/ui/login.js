import { account } from '@services/appwrite.js'
import { showDashboard } from '@ui/dashboard.js'
import { showRegister } from '@ui/register.js'

export function showLogin(container){

document.title="LaTaverna - Login"

container.innerHTML=`

<div class="glass-box">

<h2>ACCEDI</h2>

<div id="login-msg"></div>

<form id="login-form">

<input type="email" id="email" placeholder="Email" required>

<input type="password" id="password" placeholder="Password" required>

<button class="btn">Accedi</button>

</form>

<div class="divider"><span>oppure</span></div>

<button id="btn-register" class="btn-alt">Registrati</button>

</div>

`

const form=document.getElementById('login-form')

form.addEventListener('submit',async e=>{

e.preventDefault()

try{

await account.createEmailPasswordSession(
email.value,
password.value
)

const user=await account.get()

showDashboard(container,user)

}catch(err){

document.getElementById('login-msg').innerText=err.message

}

})

document.getElementById('btn-register')
.onclick=()=>showRegister(container)

}