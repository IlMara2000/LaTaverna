import { account, databases, storage } from "../services/appwrite.js"
import { showTabletop } from "./tabletop.js"

const DB_USERS = "users"
const COL_USERS = "users"

const DB_SESSIONS = "sessions"
const COL_SESSIONS = "game_sessions"

export async function showDashboard(container,user){

if(!user){
try{
user = await account.get()
}catch{
location.reload()
}
}

let profile = await getOrCreateProfile(user)

container.innerHTML = `

<div class="dashboard">

<h2>Benvenuto ${profile.username}</h2>

<p>Ruolo: ${profile.role}</p>

<input type="file" id="avatar-upload">

<img id="avatar-preview" style="width:80px;border-radius:50%">

<hr>

<input id="session-name" placeholder="Nome Avventura">

<button id="create-session">Crea Sessione</button>

<div id="session-list"></div>

<button id="logout">Logout</button>

</div>

`

document.getElementById("logout").onclick = async ()=>{

await account.deleteSession("current")
location.reload()

}

document.getElementById("avatar-upload").onchange = async e=>{

const file = e.target.files[0]

const res = await storage.createFile(
"avatars",
"unique()",
file
)

document.getElementById("avatar-preview").src =
storage.getFilePreview("avatars",res.$id)

}

document.getElementById("create-session").onclick = createSession

loadSessions(container)

}

async function getOrCreateProfile(user){

try{

const res = await databases.getDocument(
"users",
"users",
user.$id
)

return res

}catch{

const profile = await databases.createDocument(
"users",
"users",
user.$id,
{
username:user.name,
role:"player",
discord_id:"",
is_active:true
}
)

return profile

}

}

async function createSession(){

const name = document.getElementById("session-name").value

const user = await account.get()

await databases.createDocument(
"sessions",
"game_sessions",
"unique()",
{
name,
master:user.$id,
players:[user.$id],
created:new Date().toISOString()
}
)

loadSessions()

}

async function loadSessions(){

const list = document.getElementById("session-list")

const res = await databases.listDocuments(
"sessions",
"game_sessions"
)

list.innerHTML = ""

res.documents.forEach(s=>{

const el = document.createElement("div")

el.className = "session"

el.innerHTML = `
🎲 ${s.name}
<button>Entra</button>
`

el.querySelector("button").onclick = ()=>{

showTabletop(
document.getElementById("ui"),
s
)

}

list.appendChild(el)

})

}