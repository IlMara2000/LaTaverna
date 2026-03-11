import React, { useState, useEffect } from 'react';
import { databases, ID, DB_CONFIG, client } from '../../api/appwrite';
import { askTavernaAI } from '../../services/ai_service';

export default function AIChatPanel({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  // 1. Carica la cronologia e ascolta i nuovi messaggi in tempo reale
  useEffect(() => {
    const loadMessages = async () => {
      const res = await databases.listDocuments(DB_CONFIG.dbId, DB_CONFIG.colMessages);
      setMessages(res.documents);
    };

    loadMessages();

    // Sottoscrizione Realtime di Appwrite
    const unsubscribe = client.subscribe(
      `databases.${DB_CONFIG.dbId}.collections.${DB_CONFIG.colMessages}.documents`,
      (response) => {
        if (response.events.includes('*.create')) {
          setMessages((prev) => [...prev, response.payload]);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. Funzione per inviare messaggi
  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input;
    setInput('');

    // Salva messaggio utente su Appwrite
    await databases.createDocument(DB_CONFIG.dbId, DB_CONFIG.colMessages, ID.unique(), {
      text: userText,
      sender: user?.name || 'Viandante',
      timestamp: new Date().toISOString()
    });

    // Se il messaggio è per l'AI (inizia con /ai o lo vuoi sempre attivo)
    if (userText.startsWith('/ai')) {
      const aiResponse = await askTavernaAI(userText.replace('/ai', ''));
      
      // Salva risposta dell'AI su Appwrite
      await databases.createDocument(DB_CONFIG.dbId, DB_CONFIG.colMessages, ID.unique(), {
        text: aiResponse,
        sender: 'T.Alverna',
        type: 'ai_response',
        timestamp: new Date().toISOString()
      });
    }
  };

  return (
    <div className="flex flex-col h-full glass rounded-2xl overflow-hidden border border-white/5">
      {/* Header */}
      <div className="p-4 bg-amber-900/20 border-b border-white/10">
        <h3 className="text-amber-400 font-bold text-xs tracking-widest uppercase">T.Alverna AI</h3>
      </div>

      {/* Area Messaggi */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.$id} className={`flex ${msg.sender === 'T.Alverna' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
              msg.sender === 'T.Alverna' 
                ? 'bg-white/5 text-amber-100 border border-amber-500/20' 
                : 'bg-amber-600 text-white shadow-lg'
            }`}>
              <p className="text-[10px] opacity-50 mb-1 font-bold uppercase">{msg.sender}</p>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input Field */}
      <div className="p-4 bg-black/40">
        <div className="relative flex gap-2">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Scrivi o usa /ai..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
          />
          <button onClick={handleSend} className="bg-amber-600 p-3 rounded-xl hover:bg-amber-500 transition-colors">
            🚀
          </button>
        </div>
      </div>
    </div>
  );
}
