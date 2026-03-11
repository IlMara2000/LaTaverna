import { databases, ID } from '../api/appwrite';

export const rollDice = async (diceType, modifier = 0, username, sessionId) => {
    const roll = Math.floor(Math.random() * diceType) + 1;
    const total = roll + modifier;
    const resultString = `d${diceType} (${roll}) ${modifier >= 0 ? '+' : ''}${modifier} = ${total}`;

    const messageData = {
        sender: username,
        text: resultString,
        type: 'roll',
        session_id: sessionId,
        timestamp: new Date().toISOString()
    };

    try {
        await databases.createDocument(
            'IL_TUO_DB_ID', 
            'COLLECTION_MESSAGES_ID', 
            ID.unique(), 
            messageData
        );
        return total;
    } catch (error) {
        console.error("Errore nel salvataggio del tiro:", error);
    }
};
