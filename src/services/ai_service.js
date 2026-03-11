export const askTavernaAI = async (userMessage) => {
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GROQ_LLM_KEY || process.env.GROQ_LLM_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192", // Modello open source veloce e cattivo
                messages: [
                    { 
                        role: "system", 
                        content: "Sei T.Alverna, l'oste di una taverna fantasy. Sei saggio, un po' rozzo ma accogliente. Conosci tutto su D&D. Rispondi brevemente e in modo immersivo." 
                    },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.8
            })
        });

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Errore Groq:", error);
        return "Maledizione... la nebbia magica impedisce i miei pensieri. Riprova tra un attimo, straniero.";
    }
};
