export function showChat(container){

container.innerHTML = `

<div class="chatBox">

<div class="chatHeader">
<button id="menuBtn">☰</button>
<div>Chat Vocale</div>
<button id="exitBtn">Esci</button>
</div>

<div class="chatAi">
<div class="aiTitle">✨ T.AIVERNA</div>
<div class="aiText">Chiedi consigli sulla tua campagna...</div>

<div class="chatInput">
<input placeholder="Invia..." />
<button>➜</button>
</div>

</div>

</div>

`;

}
