// src/ui/components/aichatpanel.js

export function renderAIChat(container, t) {
    const chatContainer = document.createElement('div');
    chatContainer.className = 'pt-card';
    chatContainer.style.marginTop = '20px';
    chatContainer.innerHTML = `
        <h3 style="font-size:16px; margin-bottom:15px; color:var(--accent-purple);">✨ Assistente della Taverna</h3>
        <div id="chat-messages" style="height:200px; overflow-y:auto; margin-bottom:15px; font-size:13px; color:var(--text-muted);">
            Inizia a scrivere per chiedere consigli sulla tua campagna...
        </div>
        <div style="display:flex; gap:10px;">
            <input type="text" id="chat-input" placeholder="Chiedi all'IA..." style="flex:1; padding:10px; background:#000; border:1px solid var(--border-color); border-radius:8px; color:#fff;">
            <button class="icon-btn" style="padding:10px;">➔</button>
        </div>
    `;
    container.appendChild(chatContainer);
}
