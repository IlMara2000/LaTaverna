import './style.css'

import { account } from '@services/appwrite.js'
import { setupDiscordRedirect } from '@services/redirectDiscord.js'

import { showLogin } from '@ui/login.js'
import { showDashboard } from '@ui/dashboard.js'

const heroScreen = document.getElementById('hero-screen')
const heroBtn = document.querySelector('.hero-btn')

const appContent = document.getElementById('app-content')
const ui = document.getElementById('ui')

async function initApp(){

    await setupDiscordRedirect(ui)

    let user = null

    try{

        user = await account.get()

    }catch(err){

        console.log("Utente non loggato")

    }

    if(user){

        showDashboard(ui,user)

    }else{

        showLogin(ui)

    }

}

heroBtn.addEventListener('click',()=>{

    heroScreen.classList.add('hidden')

    appContent.classList.remove('hidden')

    appContent.style.visibility="visible"
    appContent.style.opacity="1"

    initApp()

})