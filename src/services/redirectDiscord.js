import { client } from './appwrite.js'

function getQueryParam(name){

const params = new URLSearchParams(window.location.search)

return params.get(name)

}

export async function setupDiscordRedirect(container){

const code = getQueryParam('code')

if(!code) return

const messageEl = document.createElement('div')
container.appendChild(messageEl)

messageEl.innerText="Accesso Discord in corso..."

try{

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT
const project = import.meta.env.VITE_APPWRITE_PROJECT

const functionUrl = `${endpoint}/functions/verifyDiscord/executions`

await fetch(functionUrl,{
method:"POST",
headers:{
'Content-Type':'application/json'
},
body:JSON.stringify({
code,
project
})
})

messageEl.innerText="Login Discord completato"

}catch(err){

messageEl.innerText="Errore login Discord"

console.error(err)

}

}