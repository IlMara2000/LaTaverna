const GROQ_API_KEY = process.env.GROQ_LLM_KEY;

export const askTavernaAI = async (userMessage, context = []) => {
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: {
                model: "llama3-8b-8192", // Modello Open Source velocissimo
                messages: [
                    {
                        role: "system",
                        content: "Sei T.Alverna, un saggio e un po' burbero locandiere di una taverna fantasy. Aiuti i giocatori di D&D con regole, trame e consigli. Parla sempre in modo immersivo."
                    },
                    ...context, // Memoria della conversazione
                    { role: "user", content: userMessage }
                ],
                temperature: 0.7,
                max_tokens: 500
            }
        });

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Errore AI:", error);
        return "Cof cof... la pipa mi fa brutti scherzi. Riprova più tardi, viandante.";
    }
};
