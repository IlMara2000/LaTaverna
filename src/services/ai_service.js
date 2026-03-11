export const askTavernaAI = async (userMessage) => {
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_LLM_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    { role: "system", content: "Sei T.Alverna, un saggio locandiere fantasy. Rispondi in modo immersivo." },
                    { role: "user", content: userMessage }
                ]
            })
        });
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        return "Cof cof... la pipa è spenta. Riprova più tardi.";
    }
};
