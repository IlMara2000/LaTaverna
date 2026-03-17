// Recupero la configurazione dalle Environment Variables di Vite
const aiConfig = {
    // NOTA: Assicurati che su Vercel la variabile si chiami esattamente VITE_GROQ_LLM_API_KEY
    apiKey: import.meta.env.VITE_GROQ_LLM_API_KEY,
    model: import.meta.env.VITE_GROQ_LLM_MODEL || "llama-3.3-70b-versatile",
    temperature: parseFloat(import.meta.env.VITE_GROQ_LLM_TEMPERATURE) || 0.7,
    maxTokens: parseInt(import.meta.env.VITE_GROQ_LLM_MAX_TOKENS) || 1024,
    topP: parseFloat(import.meta.env.VITE_GROQ_LLM_TOP_P) || 1,
};

const API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function getAIResponse(prompt) {
    // 1. Controllo immediato della chiave
    if (!aiConfig.apiKey || aiConfig.apiKey === "") {
        console.error("ERRORE: VITE_GROQ_LLM_API_KEY non trovata nelle variabili d'ambiente.");
        return "L'oste ha perso la voce... (Configurazione mancante)";
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
                        content: "Sei l'Oste della Taverna, un leggendario Dungeon Master. Rispondi in modo epico, immersivo e breve (max 3 frasi). Usa un tono medievale e misterioso. Non uscire mai dal personaggio."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: aiConfig.temperature,
                max_tokens: aiConfig.maxTokens,
                top_p: aiConfig.topP,
                stream: false // Disattiviamo lo streaming per semplicità di gestione UI
            })
        });

        // 2. Controllo stato risposta HTTP
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Errore API: ${response.status}`);
        }

        const data = await response.json();
        
        // 3. Verifica esistenza contenuto
        if (data.choices && data.choices[0]?.message?.content) {
            return data.choices[0].message.content.trim();
        } else {
            throw new Error("Formato risposta API non valido");
        }

    } catch (err) {
        console.error("Errore T.Ai.verna (Groq):", err);
        // Feedback simpatico in caso di errore
        return "L'oste sta sedando una rissa e non può rispondere. Torna quando le acque si saranno calmate, viandante!";
    }
}