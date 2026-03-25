/**
 * Servizio di Intelligenza Artificiale (Powered by Groq)
 * Configurato per l'Oste della Taverna.
 */

const aiConfig = {
    apiKey: import.meta.env.VITE_GROQ_LLM_API_KEY,
    model: import.meta.env.VITE_GROQ_LLM_MODEL || "llama-3.3-70b-versatile",
    temperature: parseFloat(import.meta.env.VITE_GROQ_LLM_TEMPERATURE) || 0.8,
    maxTokens: parseInt(import.meta.env.VITE_GROQ_LLM_MAX_TOKENS) || 250, // Accorciato per risposte fulminee
};

const API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Interroga l'Oste della Taverna
 * @param {string} prompt - La domanda del viandante
 * @returns {Promise<string>} - La risposta epica dell'AI
 */
export async function getAIResponse(prompt) {
    // 1. Validazione Input e Configurazione
    if (!prompt || prompt.trim().length === 0) return "L'oste ti osserva in silenzio, pulendo un boccale con uno straccio sporco...";
    
    if (!aiConfig.apiKey) {
        console.error("⚠️ [Taverna AI]: Manca la chiave API VITE_GROQ_LLM_API_KEY.");
        return "L'oste ha perso la voce... (Problemi magici alla sorgente)";
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: aiConfig.model,
                messages: [
                    {
                        role: "system",
                        content: `Sei l'Oste della Taverna, un leggendario Dungeon Master in pensione. 
                        Rispondi in modo epico, immersivo e conciso. 
                        Usa termini come 'viandante', 'idromele', 'pergamena', 'sortilegio'. 
                        Se ti chiedono aiuto per la sessione, dai consigli criptici ma utili. 
                        Non uscire mai dal personaggio. Limita la risposta a un massimo di 60 parole.`
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: aiConfig.temperature,
                max_tokens: aiConfig.maxTokens,
                top_p: 1,
                stream: false
            })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(errorBody.error?.message || `Errore Portale: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (content) {
            return content.trim();
        } else {
            throw new Error("Risposta vuota dal Grande Oltre");
        }

    } catch (err) {
        console.error("🔥 [Errore AI]:", err);
        return "L'oste sta sedando una rissa tra un nano e un mezzelfo. Torna quando le acque si saranno calmate, viandante!";
    }
}