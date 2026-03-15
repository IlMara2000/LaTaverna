import { account } from '@services/appwrite.js'
import { showSession } from '@ui/session.js'

export async function showDashboard(container,user){

if(!user){

try{
user=await account.get()
}catch{

import('@ui/login.js')
.then(m=>m.showLogin(container))

return

}

}

document.title="LaTaverna - Dashboard"

container.innerHTML=`

<div class="dashboard">

<h2>Benvenuto ${user.name}</h2>

<button id="logout">Logout</button>

<button id="create-session">Nuova Sessione</button>

<div id="sessions"></div>

</div>

`

document.getElementById("logout").onclick=async()=>{

await account.deleteSession("current")

location.reload()

}

document.getElementById("create-session")
.onclick=()=>{

showSession(container,"NUOVA")

}

}