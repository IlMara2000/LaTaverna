import React, { useState } from 'react';

export default function Sidebar() {
    const [tab, setTab] = useState('ai'); // 'ai' o 'chat'

    return (
        <div className="flex flex-col h-full">
            {/* Tabs */}
            <div className="flex border-b border-white/10">
                <button 
                    onClick={() => setTab('ai')}
                    className={`flex-1 p-4 text-xs font-bold uppercase tracking-widest ${tab === 'ai' ? 'bg-amber-900/20 text-amber-400' : 'text-gray-500'}`}
                >
                    T.Alverna
                </button>
                <button 
                    onClick={() => setTab('chat')}
                    className={`flex-1 p-4 text-xs font-bold uppercase tracking-widest ${tab === 'chat' ? 'bg-amber-900/20 text-amber-400' : 'text-gray-500'}`}
                >
                    Chat Log
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {tab === 'ai' ? (
                    <div className="space-y-4">
                        <div className="bg-white/5 p-3 rounded-lg border border-white/10 italic text-sm text-gray-300">
                            "Benvenuto nella Taverna, Viandante. Chiedimi della campagna..."
                        </div>
                        {/* Lista messaggi AI qui */}
                    </div>
                ) : (
                    <div className="text-sm text-gray-400">
                        {/* Messaggi di sistema e tiri di dado */}
                        <p><span className="text-amber-500 font-bold">Gimmli</span> ha tirato d20: <span className="text-white">18</span></p>
                    </div>
                )}
            </div>

            {/* Input Fisso */}
            <div className="p-4 bg-[#1a1a1a]">
                <input 
                    type="text" 
                    placeholder={tab === 'ai' ? "Chiedi all'AI..." : "Invia un messaggio..."}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500/50"
                />
            </div>
        </div>
    );
}
