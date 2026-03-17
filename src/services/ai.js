const aiConfig = {
    apiKey: import.meta.env.VITE_GROQ_LLM_API_KEY,
    model: import.meta.env.VITE_GROQ_LLM_MODEL || "llama-3.3-70b-versatile",
    temperature: parseFloat(import.meta.env.VITE_GROQ_LLM_TEMPERATURE) || 0.7,
    maxTokens: parseInt(import.meta.env.VITE_GROQ_LLM_MAX_TOKENS) || 1024,
};

const API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function getAIResponse(prompt) {
    if (!aiConfig.apiKey) {
        console.error("ERRORE: VITE_GROQ_LLM_API_KEY mancante.");
        return "L'oste ha perso la voce... (Configura la chiave magica, viandante!)";
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
                    { role: "user", content: prompt }
                ],
                temperature: aiConfig.temperature,
                max_tokens: aiConfig.maxTokens
            })
        });

        if (!response.ok) throw new Error(`Errore API: ${response.status}`);

        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || "L'oste ti osserva in silenzio...";

    } catch (err) {
        console.error("Errore Oste AI:", err);
        return "L'oste sta sedando una rissa e non può rispondere. Torna più tardi!";
    }
}
