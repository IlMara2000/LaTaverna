import React, { useState } from 'react';

export default function AIChatPanel() {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Benvenuto nella Taverna. Sono T.Alverna, la tua guida.' }
  ]);

  return (
    <div className="flex flex-col h-full glass rounded-2xl overflow-hidden border border-white/5">
      <div className="p-4 bg-amber-900/20 border-b border-white/10">
        <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
          T.ALVERNA AI
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
              msg.role === 'user' ? 'bg-amber-600 text-white' : 'bg-white/5 text-gray-300 border border-white/10'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-black/20">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Chiedi alla T.Alverna..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-all"
          />
          <button className="absolute right-3 top-2.5 text-amber-500 hover:text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
