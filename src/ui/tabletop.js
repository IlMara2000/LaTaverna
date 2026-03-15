export function showTabletop(container,session){

container.innerHTML=`

<div class="tabletop">

<h2>${session.name}</h2>

<canvas id="map"></canvas>

<div class="dice-panel">

<button id="roll-d20">
🎲 Lancia D20
</button>

<div id="dice-result"></div>

</div>

</div>

`

document.getElementById("roll-d20")
.onclick=()=>{

const roll=Math.floor(Math.random()*20)+1

document.getElementById("dice-result")
.innerText="Risultato: "+roll

}

}