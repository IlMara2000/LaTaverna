"use client";
import React, { useState, useEffect } from 'react';
import { databases, ID, DB_CONFIG, client } from '../../api/appwrite';
import { askTavernaAI } from '../../services/ai_service';

export default function AIChatPanel({ user }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');

    // Carica messaggi esistenti e ascolta quelli nuovi
    useEffect(() => {
        const loadMessages = async () => {
            try {
                const res = await databases.listDocuments(DB_CONFIG.dbId, DB_CONFIG.colMessages);
                setMessages(res.documents);
            } catch (err) { console.error("Errore caricamento chat:", err); }
        };

        loadMessages();

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

    const sendMessage = async () => {
        if (!input.trim()) return;
        const text = input;
        setInput('');

        // 1. Salva messaggio utente
        await databases.createDocument(DB_CONFIG.dbId, DB_CONFIG.colMessages, ID.unique(), {
            text: text,
            sender: user?.name || "Viandante",
            timestamp: new Date().toISOString()
        });

        // 2. Risposta dell'AI se il messaggio inizia con /ai
        if (text.startsWith('/ai')) {
            const aiResponse = await askTavernaAI(text.replace('/ai', ''));
            await databases.createDocument(DB_CONFIG.dbId, DB_CONFIG.colMessages, ID.unique(), {
                text: aiResponse,
                sender: "T.Alverna",
                timestamp: new Date().toISOString()
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0d0d0d] border-l border-white/10">
            <div className="p-4 border-b border-white/5 bg-amber-900/10">
                <h2 className="text-amber-500 font-bold uppercase text-xs tracking-widest">Chat della Taverna</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m) => (
                    <div key={m.$id} className={`flex flex-col ${m.sender === 'T.Alverna' ? 'items-start' : 'items-end'}`}>
                        <span className="text-[10px] text-gray-500 uppercase mb-1">{m.sender}</span>
                        <div className={`p-3 rounded-2xl text-sm max-w-[90%] ${
                            m.sender === 'T.Alverna' ? 'bg-white/5 text-amber-100 border border-amber-900/30' : 'bg-amber-600 text-white'
                        }`}>
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 bg-black/50">
                <input 
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-amber-500"
                    placeholder="Scrivi o usa /ai..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                />
            </div>
        </div>
    );
}
